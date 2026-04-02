import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../plugins/prisma.js";

export interface SaleInput {
  date: string;
  clientId: string;
  productId: string;
  amount: number;
  paymentMethod: "TRANSFERENCIA" | "EFECTIVO" | "TARJETA" | "CANJE / PAGO" | "T. Crédito";
  status: "COMPLETADA" | "PENDIENTE";
}

export interface SalePatchInput {
  paymentMethod?: SaleInput["paymentMethod"];
  status?: SaleInput["status"];
}

export interface SaleResponse {
  id: string;
  date: string;
  clientId: string;
  productId: string;
  amount: number;
  paymentMethod: SaleInput["paymentMethod"];
  status: SaleInput["status"];
}

type SaleRecord = {
  id: string;
  clientId: string | null;
  inventoryItemId: string | null;
  dateLabel: string;
  amount: Decimal;
  paymentMethod: string;
  status: string;
  soldAt: Date;
};

class SalesError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const monthMap: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  set: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

const toDecimal = (value: number) => new Decimal(value);

function normalizeDateLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseDateLabel(value: string) {
  const normalized = normalizeDateLabel(value).toLowerCase().replace(/\./g, "");
  const match = normalized.match(/^(\d{1,2})\s+([a-zñ]{3,4})\s+(\d{4})$/i);

  if (!match) {
    return new Date();
  }

  const day = Number(match[1]);
  const monthKey = match[2].slice(0, 3);
  const month = monthMap[monthKey];
  const year = Number(match[3]);

  if (
    Number.isNaN(day) ||
    month === undefined ||
    Number.isNaN(year)
  ) {
    return new Date();
  }

  const parsed = new Date(year, month, day, 12, 0, 0, 0);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function serializeSale(sale: SaleRecord): SaleResponse {
  return {
    id: sale.id,
    date: sale.dateLabel || formatDateLabel(sale.soldAt),
    clientId: sale.clientId ?? "",
    productId: sale.inventoryItemId ?? "",
    amount: sale.amount.toNumber(),
    paymentMethod: sale.paymentMethod as SaleResponse["paymentMethod"],
    status: sale.status as SaleResponse["status"],
  };
}

export async function listSales(storeId: string) {
  const sales = await prisma.sale.findMany({
    where: { storeId },
    orderBy: { soldAt: "desc" },
  });

  return sales.map(serializeSale);
}

export async function createSale(storeId: string, input: SaleInput) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: input.clientId, storeId },
    });

    if (!client) {
      throw new SalesError("Client not found", 404);
    }

    const inventoryItem = await tx.inventoryItem.findFirst({
      where: { id: input.productId, storeId },
    });

    if (!inventoryItem) {
      throw new SalesError("Inventory item not found", 404);
    }

    if (inventoryItem.status !== "DISPONIBLE") {
      throw new SalesError("Inventory item is not available", 409);
    }

    const soldAt = parseDateLabel(input.date);
    const dateLabel = normalizeDateLabel(input.date) || formatDateLabel(soldAt);

    const sale = await tx.sale.create({
      data: {
        storeId,
        clientId: client.id,
        inventoryItemId: inventoryItem.id,
        dateLabel,
        amount: toDecimal(input.amount),
        paymentMethod: input.paymentMethod,
        status: input.status,
        soldAt,
      },
    });

    await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { status: "VENDIDO" },
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        totalSpent: new Decimal(client.totalSpent.toString()).add(input.amount),
        lastPurchaseAt: soldAt,
      },
    });

    return serializeSale(sale as SaleRecord);
  });
}

export async function updateSale(
  storeId: string,
  id: string,
  input: SalePatchInput
) {
  const existing = await prisma.sale.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.sale.update({
    where: { id },
    data: {
      paymentMethod: input.paymentMethod ?? existing.paymentMethod,
      status: input.status ?? existing.status,
    },
  });

  return serializeSale(updated as SaleRecord);
}

export async function deleteSale(storeId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return false;
    }

    if (existing.inventoryItemId) {
      await tx.inventoryItem.updateMany({
        where: { id: existing.inventoryItemId, storeId },
        data: { status: "DISPONIBLE" },
      });
    }

    if (existing.clientId) {
      const aggregate = await tx.sale.aggregate({
        where: {
          storeId,
          clientId: existing.clientId,
          id: { not: id },
        },
        _sum: { amount: true },
        _max: { soldAt: true },
      });

      await tx.client.updateMany({
        where: { id: existing.clientId, storeId },
        data: {
          totalSpent: aggregate._sum.amount ?? new Decimal(0),
          lastPurchaseAt: aggregate._max.soldAt ?? null,
        },
      });
    }

    await tx.sale.delete({
      where: { id },
    });

    return true;
  });
}

export function getSalesErrorStatus(error: unknown) {
  if (error instanceof SalesError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}
