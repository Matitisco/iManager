import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export interface SaleInput {
  date: string;
  clientId: string;
  productId: string;
  amount: number;
  paymentMethod: string;
  status: string;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface SalePatchInput {
  clientId?: string;
  productId?: string;
  paymentMethod?: SaleInput["paymentMethod"];
  status?: SaleInput["status"];
  date?: string;
  amount?: number;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface SaleResponse {
  id: string;
  saleNumber: number;
  date: string;
  clientId: string;
  productId: string;
  amount: number;
  paymentMethod: SaleInput["paymentMethod"];
  status: SaleInput["status"];
  categoryId: string | null;
  customFields: Record<string, unknown>;
}

type SaleRecord = {
  id: string;
  saleNumber: number;
  clientId: string | null;
  inventoryItemId: string | null;
  dateLabel: string;
  amount: Decimal;
  paymentMethod: string;
  status: string;
  categoryId: string | null;
  soldAt: Date;
  customFields: Prisma.JsonValue | null;
};

export interface SaleCategoryResponse {
  id: string;
  name: string;
}

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

async function assertCategoryBelongsToStore(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  storeId: string,
  categoryId?: string | null
) {
  if (categoryId === undefined || categoryId === null) {
    return;
  }

  const category = await tx.saleCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

  if (!category) {
    throw new SalesError("Category not found", 404);
  }
}

const toCustomFields = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

function normalizeCustomFields(customFields?: Record<string, unknown> | null) {
  if (!customFields) {
    return {} as Prisma.InputJsonValue;
  }

  return (Object.keys(customFields).length > 0 ? customFields : {}) as Prisma.InputJsonValue;
}

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

async function recomputeClientStats(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  storeId: string,
  clientId: string
) {
  const aggregate = await tx.sale.aggregate({
    where: { storeId, clientId },
    _sum: { amount: true },
    _max: { soldAt: true },
  });

  await tx.client.updateMany({
    where: { id: clientId, storeId },
    data: {
      totalSpent: aggregate._sum.amount ?? new Decimal(0),
      lastPurchaseAt: aggregate._max.soldAt ?? null,
    },
  });
}

function serializeSale(sale: SaleRecord): SaleResponse {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    date: sale.dateLabel || formatDateLabel(sale.soldAt),
    clientId: sale.clientId ?? "",
    productId: sale.inventoryItemId ?? "",
    amount: sale.amount.toNumber(),
    paymentMethod: sale.paymentMethod as SaleResponse["paymentMethod"],
    status: sale.status as SaleResponse["status"],
    categoryId: sale.categoryId ?? null,
    customFields: toCustomFields(sale.customFields),
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
    await assertCategoryBelongsToStore(tx, storeId, input.categoryId);

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
        categoryId: input.categoryId ?? null,
        customFields: normalizeCustomFields(input.customFields),
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

  return prisma.$transaction(async (tx) => {
    const nextClientId = input.clientId ?? existing.clientId ?? undefined;
    const nextInventoryItemId = input.productId ?? existing.inventoryItemId ?? undefined;

    await assertCategoryBelongsToStore(tx, storeId, input.categoryId);

    if (input.clientId) {
      const client = await tx.client.findFirst({
        where: { id: input.clientId, storeId },
      });

      if (!client) {
        throw new SalesError("Client not found", 404);
      }
    }

    if (input.productId && input.productId !== existing.inventoryItemId) {
      const inventoryItem = await tx.inventoryItem.findFirst({
        where: { id: input.productId, storeId },
      });

      if (!inventoryItem) {
        throw new SalesError("Inventory item not found", 404);
      }

      if (inventoryItem.status !== "DISPONIBLE") {
        throw new SalesError("Inventory item is not available", 409);
      }
    }

    const newSoldAt = input.date ? parseDateLabel(input.date) : existing.soldAt;
    const newDateLabel = input.date
      ? normalizeDateLabel(input.date) || formatDateLabel(newSoldAt)
      : existing.dateLabel;
    const newAmount = input.amount !== undefined ? toDecimal(input.amount) : existing.amount;

    const updated = await tx.sale.update({
      where: { id },
      data: {
        paymentMethod: input.paymentMethod ?? existing.paymentMethod,
        status: input.status ?? existing.status,
        dateLabel: newDateLabel,
        soldAt: newSoldAt,
        amount: newAmount,
        clientId: nextClientId,
        inventoryItemId: nextInventoryItemId,
        categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
        customFields:
          input.customFields !== undefined
            ? normalizeCustomFields(input.customFields)
            : ((existing.customFields ?? {}) as Prisma.InputJsonValue),
      },
    });

    if (existing.inventoryItemId && existing.inventoryItemId !== nextInventoryItemId) {
      await tx.inventoryItem.updateMany({
        where: { id: existing.inventoryItemId, storeId },
        data: { status: "DISPONIBLE" },
      });
    }

    if (nextInventoryItemId && nextInventoryItemId !== existing.inventoryItemId) {
      await tx.inventoryItem.updateMany({
        where: { id: nextInventoryItemId, storeId },
        data: { status: "VENDIDO" },
      });
    }

    if (
      input.amount !== undefined ||
      input.date !== undefined ||
      input.clientId !== undefined
    ) {
      const affectedClientIds = new Set<string>();
      if (existing.clientId) affectedClientIds.add(existing.clientId);
      if (nextClientId) affectedClientIds.add(nextClientId);

      for (const clientId of affectedClientIds) {
        await recomputeClientStats(tx, storeId, clientId);
      }
    }

    return serializeSale(updated as SaleRecord);
  });
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

// ── Import ────────────────────────────────────────────────────────────────────

export interface SaleImportRow {
  date?: string;
  clientName?: string;
  productImei?: string;
  amount?: string;
  paymentMethod?: string;
  status?: string;
}

export interface SaleImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const VALID_PAYMENT_METHODS = [
  "TRANSFERENCIA",
  "EFECTIVO",
  "TARJETA",
  "CANJE / PAGO",
  "T. Crédito",
] as const;

export async function importSales(
  storeId: string,
  rows: SaleImportRow[]
): Promise<SaleImportResult> {
  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    try {
      // Resolve client by name
      const clientName = r.clientName?.trim();
      if (!clientName) {
        errors.push({ row: rowNum, message: "Nombre de cliente requerido" });
        continue;
      }
      const client = await prisma.client.findFirst({
        where: { storeId, name: { equals: clientName, mode: "insensitive" } },
        select: { id: true },
      });
      if (!client) {
        errors.push({ row: rowNum, message: `Cliente no encontrado: "${clientName}"` });
        continue;
      }

      // Resolve inventory item by IMEI
      const imei = r.productImei?.trim();
      if (!imei) {
        errors.push({ row: rowNum, message: "IMEI del producto requerido" });
        continue;
      }
      const item = await prisma.inventoryItem.findFirst({
        where: { storeId, imei },
        select: { id: true },
      });
      if (!item) {
        errors.push({ row: rowNum, message: `Producto no encontrado (IMEI): "${imei}"` });
        continue;
      }

      const rawAmount = (r.amount ?? "").replace(",", ".");
      const amount = parseFloat(rawAmount) || 0;

      const pm = (r.paymentMethod ?? "").trim();
      const paymentMethod = (VALID_PAYMENT_METHODS as readonly string[]).includes(pm)
        ? (pm as typeof VALID_PAYMENT_METHODS[number])
        : "EFECTIVO";

      const status = r.status?.trim() === "PENDIENTE" ? "PENDIENTE" : "COMPLETADA";

      const dateStr = r.date?.trim() || "";
      const soldAt  = parseDateLabel(dateStr) || new Date();
      const dateLabel = dateStr || formatDateLabel(soldAt);

      await prisma.$transaction(async (tx) => {
        await tx.sale.create({
          data: {
            storeId,
            clientId: client.id,
            inventoryItemId: item.id,
            dateLabel,
            amount: toDecimal(amount),
            paymentMethod,
            status,
            soldAt,
          },
        });

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { status: "VENDIDO" },
        });

        await recomputeClientStats(tx, storeId, client.id);
      });

      imported++;
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return { imported, updated: 0, errors };
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(storeId: string): Promise<SaleCategoryResponse[]> {
  const cats = await prisma.saleCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  return cats;
}

export async function createCategory(storeId: string, name: string): Promise<SaleCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new SalesError("Category name required", 400);
  const existing = await prisma.saleCategory.findFirst({ where: { storeId, name: trimmed } });
  if (existing) throw new SalesError("Category already exists", 409);
  const count = await prisma.saleCategory.count({ where: { storeId } });
  const cat = await prisma.saleCategory.create({ data: { storeId, name: trimmed, sortOrder: count }, select: { id: true, name: true } });
  return cat;
}

export async function reorderCategories(storeId: string, categoryIds: string[]): Promise<void> {
  await prisma.$transaction(
    categoryIds.map((id, idx) =>
      prisma.saleCategory.updateMany({ where: { id, storeId }, data: { sortOrder: idx } })
    )
  );
}

export async function renameCategory(storeId: string, id: string, name: string): Promise<SaleCategoryResponse | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new SalesError("Category name required", 400);
  const existing = await prisma.saleCategory.findFirst({ where: { id, storeId } });
  if (!existing) return null;
  const updated = await prisma.saleCategory.update({ where: { id }, data: { name: trimmed }, select: { id: true, name: true } });
  return updated;
}

export async function deleteCategory(storeId: string, id: string): Promise<boolean> {
  const existing = await prisma.saleCategory.findFirst({ where: { id, storeId } });
  if (!existing) return false;

  await prisma.$transaction(async (tx) => {
    await tx.sale.updateMany({ where: { storeId, categoryId: id }, data: { categoryId: null } });
    await tx.saleCategory.delete({ where: { id } });
  });

  return true;
}

export async function bulkMoveCategory(storeId: string, ids: string[], categoryId: string | null): Promise<number> {
  if (categoryId !== null) {
    const cat = await prisma.saleCategory.findFirst({ where: { id: categoryId, storeId } });
    if (!cat) throw new SalesError("Category not found", 404);
  }

  const result = await prisma.sale.updateMany({
    where: { storeId, id: { in: ids } },
    data: { categoryId },
  });

  return result.count;
}
