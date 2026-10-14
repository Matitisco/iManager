import { lockInventory } from '../deposits/deposits.service.js';
import { saleExchangeRate } from "../../lib/blue-rate.js";
import { assertSeller, recordSaleCommission, refreshSaleCommission, voidSaleCommission } from "../commissions/commission-ledger.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { normalizeCustomFields } from "../../lib/custom-fields.js";
import { formatArDate, formatStoredDate, parseArDateOr } from "../../lib/ar-date.js";
import { allocateDocumentNumber } from "../../lib/store-sequence.js";
import { cancellationStamp, moneyChanged, writeAudit, type Actor } from "../audit/audit.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";
import { decideClientLink, decideInventoryLink, matchOpenTradeIn, matchSellerUserId } from "../import/link-imported-sale.js";
import { normalizeCurrencyToken, normalizeImei, normalizeImportDate, normalizeImportedDni, normalizeImportedPhone, normalizePayment, normalizeTradeIn } from "../import/normalize-import.js";
import { parseMoney } from "../import/sheet-plan.js";
import { saleDaysFromStore } from "../warranty/warranty.js";

export interface SaleInput {
  sellerMemberId?: string | null;
  exchangeRate?: number;
  date: string;
  clientId?: string | null;
  clientName?: string | null;
  productId?: string | null;
  deviceLabel?: string | null;
  amount: number;
  amountCurrency?: string | null;
  paymentMethod: string;
  status: string;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
  warrantyDays?: number;
}

export interface SalePatchInput {
  sellerMemberId?: string | null;
  exchangeRate?: number;
  clientId?: string | null;
  clientName?: string | null;
  productId?: string | null;
  deviceLabel?: string | null;
  paymentMethod?: SaleInput["paymentMethod"];
  status?: SaleInput["status"];
  date?: string;
  amount?: number;
  amountCurrency?: string | null;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
  warrantyDays?: number;
}

export interface SaleResponse {
  depositAppliedAmount?: number;
  openBalance?: number | null;
  sellerMemberId: string | null;
  registeredByUserId: string | null;
  exchangeRate: number | null;
  id: string;
  saleNumber: number;
  date: string;
  clientId: string;
  clientName: string;
  productId: string;
  deviceLabel: string;
  amount: number;
  amountCurrency: string | null;
  paymentMethod: SaleInput["paymentMethod"];
  status: SaleInput["status"];
  categoryId: string | null;
  customFields: Record<string, unknown>;
  tradeInId: string | null;
  integratedOperation: boolean;
  cancelledBy: string | null;
  cancelledAt: string | null;
  warrantyDays: number | null;
}

type SaleRecord = {
  depositAppliedAmount?: Decimal;
  openBalance?: Decimal | null;
  sellerMemberId?: string | null;
  registeredByUserId?: string | null;
  exchangeRate?: Decimal | null;
  id: string;
  saleNumber: number;
  clientId: string | null;
  clientName: string;
  inventoryItemId: string | null;
  deviceLabel: string | null;
  dateLabel: string;
  amount: Decimal;
  amountCurrency?: string | null;
  paymentMethod: string;
  status: string;
  categoryId: string | null;
  soldAt: Date;
  customFields: Prisma.JsonValue | null;
  tradeInId: string | null;
  integratedOperation: boolean;
  cancelledBy?: string | null;
  cancelledAt?: Date | null;
  warrantyDays?: number | null;
  inventoryItem?: { model: string; capacity: string; condition?: string } | null;
};

export interface SaleCategoryResponse {
  id: string;
  name: string;
}

class SalesError extends DomainError {}

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
    sellerMemberId: sale.sellerMemberId ?? null,
    registeredByUserId: sale.registeredByUserId ?? null,
    exchangeRate: sale.exchangeRate == null ? null : Number(sale.exchangeRate),
    date: formatStoredDate(sale.dateLabel, sale.soldAt),
    clientId: sale.clientId ?? "",
    clientName: sale.clientName ?? "",
    productId: sale.inventoryItemId ?? "",
    deviceLabel: sale.deviceLabel || [sale.inventoryItem?.model, sale.inventoryItem?.capacity].filter(Boolean).join(" "),
    depositAppliedAmount: Number(sale.depositAppliedAmount ?? 0),
    openBalance: sale.openBalance == null ? null : Number(sale.openBalance),
    amount: sale.amount.toNumber(),
    amountCurrency: sale.amountCurrency ?? null,
    paymentMethod: sale.paymentMethod as SaleResponse["paymentMethod"],
    status: sale.status as SaleResponse["status"],
    categoryId: sale.categoryId ?? null,
    customFields: toCustomFields(sale.customFields),
    tradeInId: sale.tradeInId ?? null,
    integratedOperation: sale.integratedOperation,
    cancelledBy: sale.cancelledBy ?? null,
    cancelledAt: sale.cancelledAt ? sale.cancelledAt.toISOString() : null,
    warrantyDays: sale.warrantyDays ?? null,
  };
}

export async function listSales(storeId: string) {
  const sales = await prisma.sale.findMany({
    where: { storeId },
    orderBy: { soldAt: "desc" },
    include: { inventoryItem: { select: { model: true, capacity: true } } },
  });

  return sales.map(serializeSale);
}

export async function createSale(storeId: string, input: SaleInput, actor?: Actor) {
  return prisma.$transaction(async (tx) => {
    await assertCategoryBelongsToStore(tx, storeId, input.categoryId);

    const client = input.clientId
      ? await tx.client.findFirst({
          where: { id: input.clientId, storeId },
        })
      : null;

    if (input.clientId && !client) {
      throw new SalesError("Client not found", 404);
    }

    const productId = input.productId?.trim() || "";
    const deviceLabel = input.deviceLabel?.trim() || null;
    if (productId) await lockInventory(tx, storeId, productId);
    const inventoryItem = productId
      ? await tx.inventoryItem.findFirst({
          where: { id: productId, storeId },
        })
      : null;

    if (productId && !inventoryItem) {
      throw new SalesError("Inventory item not found", 404);
    }

    if (inventoryItem && inventoryItem.status && inventoryItem.status !== "DISPONIBLE") {
      throw new SalesError("Inventory item is not available", 409);
    }

    if (!inventoryItem && !deviceLabel) {
      throw new SalesError("Indicá el equipo", 400);
    }

    const soldAt = parseArDateOr(input.date);
    const dateLabel = formatArDate(soldAt);
    const warrantyStore = await tx.store.findUnique({
      where: { id: storeId },
      select: { usedWarrantyDays: true, sealedWarrantyDays: true },
    });
    const warrantyDays = saleDaysFromStore(input.warrantyDays, inventoryItem?.condition, warrantyStore);
    const saleNumber = await allocateDocumentNumber(tx, storeId, "sale");
    const amountCurrency = currencyOnWrite(input.amountCurrency, true, await storeCurrency(storeId, tx));

    await assertSeller(tx, storeId, input.sellerMemberId);
    const exchangeRate = await saleExchangeRate(input.exchangeRate);
    const sale = await tx.sale.create({
      data: {
        saleNumber,
        sellerMemberId: input.sellerMemberId ?? null,
        registeredByUserId: actor?.userId ?? null,
        exchangeRate,
        storeId,
        clientId: client?.id ?? null,
        clientName: input.clientName?.trim() || client?.name || "",
        inventoryItemId: inventoryItem?.id ?? null,
        deviceLabel,
        dateLabel,
        amount: toDecimal(input.amount),
        amountCurrency,
        paymentMethod: input.paymentMethod,
        status: input.status,
        categoryId: input.categoryId ?? null,
        customFields: normalizeCustomFields(input.customFields),
        soldAt,
        warrantyDays,
      },
    });

    if (input.sellerMemberId) await recordSaleCommission(tx, storeId, sale.id);
    if (inventoryItem) {
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { status: "VENDIDO" },
      });
    }

    if (client) {
      await tx.client.update({
        where: { id: client.id },
        data: {
          totalSpent: new Decimal(client.totalSpent.toString()).add(input.amount),
          lastPurchaseAt: soldAt,
        },
      });
    }

    return serializeSale(sale as SaleRecord);
  });
}

export async function updateSale(
  storeId: string,
  id: string,
  input: SalePatchInput,
  actor?: Actor | null,
) {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return null;
    }
    if (existing.integratedOperation || existing.tradeInId) {
      throw new SalesError("Esta venta está vinculada a una operación. Editala desde Operaciones.", 409);
    }

    const nextClientId = input.clientId === undefined ? existing.clientId : (input.clientId || null);
    const nextInventoryItemId = input.productId === undefined
      ? existing.inventoryItemId
      : (input.productId?.trim() || null);
    const nextDeviceLabel = input.deviceLabel === undefined
      ? existing.deviceLabel
      : (input.deviceLabel?.trim() || null);

    await assertCategoryBelongsToStore(tx, storeId, input.categoryId);

    if (input.clientId) {
      const client = await tx.client.findFirst({
        where: { id: input.clientId, storeId },
      });

      if (!client) {
        throw new SalesError("Client not found", 404);
      }
    }

    if (!nextInventoryItemId && !nextDeviceLabel) {
      throw new SalesError("Indicá el equipo", 400);
    }

    if (nextInventoryItemId && nextInventoryItemId !== existing.inventoryItemId) {
      await lockInventory(tx, storeId, nextInventoryItemId);
      const inventoryItem = await tx.inventoryItem.findFirst({
        where: { id: nextInventoryItemId, storeId },
      });

      if (!inventoryItem) {
        throw new SalesError("Inventory item not found", 404);
      }

      if (inventoryItem.status && inventoryItem.status !== "DISPONIBLE") {
        throw new SalesError("Inventory item is not available", 409);
      }
    }

    const newSoldAt = input.date ? parseArDateOr(input.date, existing.soldAt) : existing.soldAt;
    const newDateLabel = input.date ? formatArDate(newSoldAt) : existing.dateLabel;
    const newAmount = input.amount !== undefined ? toDecimal(input.amount) : existing.amount;
    const amountChanges = input.amount !== undefined && moneyChanged(existing.amount, input.amount);
    const nextCurrency = currencyOnWrite(input.amountCurrency, amountChanges, amountChanges ? await storeCurrency(storeId, tx) : "ARS");
    const cancelling = input.status === "CANCELADA" && existing.status !== "CANCELADA";

    await assertSeller(tx, storeId, input.sellerMemberId);
    if (cancelling) await voidSaleCommission(tx, storeId, id, "CANCELLED");
    const updated = await tx.sale.update({
      where: { id },
      data: {
        ...(input.sellerMemberId !== undefined ? { sellerMemberId: input.sellerMemberId } : {}),
        ...(input.exchangeRate !== undefined ? { exchangeRate: await saleExchangeRate(input.exchangeRate) } : {}),
        paymentMethod: input.paymentMethod ?? existing.paymentMethod,
        status: input.status ?? existing.status,
        ...(cancelling ? cancellationStamp(actor) : {}),
        dateLabel: newDateLabel,
        soldAt: newSoldAt,
        amount: newAmount,
        ...(existing.status === "PENDIENTE" && (input.status ?? existing.status) === "COMPLETADA" && existing.openBalance != null ? { openBalance: new Decimal(0) } : {}),
        ...(nextCurrency ? { amountCurrency: nextCurrency } : {}),
        clientId: nextClientId,
        clientName: input.clientName !== undefined ? (input.clientName?.trim() ?? "") : existing.clientName,
        inventoryItemId: nextInventoryItemId,
        deviceLabel: nextDeviceLabel,
        categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
        ...(input.warrantyDays !== undefined ? { warrantyDays: input.warrantyDays } : {}),
        customFields:
          input.customFields !== undefined
            ? normalizeCustomFields(input.customFields)
            : ((existing.customFields ?? {}) as Prisma.InputJsonValue),
      },
    });

    if (!cancelling) await refreshSaleCommission(tx, storeId, id);
    if (actor && input.sellerMemberId !== undefined && input.sellerMemberId !== existing.sellerMemberId) await writeAudit(tx, { storeId, actor, action: "sale.seller.changed", entityType: "sale", entityId: id });
    if (cancelling && actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "sale.cancelled",
        entityType: "sale",
        entityId: id,
      });
    }

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

    const nextStatus = input.status ?? existing.status;
    if (existing.status === "PENDIENTE" && nextStatus === "COMPLETADA" && nextClientId) {
      const payer = await tx.client.findFirst({ where: { id: nextClientId, storeId } });
      if (payer) {
        const owed = existing.openBalance != null ? new Decimal(existing.openBalance.toString()) : new Decimal(newAmount);
        const nextBalance = new Decimal(payer.pendingBalance.toString()).minus(owed);
        await tx.client.update({
          where: { id: payer.id },
          data: { pendingBalance: nextBalance.lessThan(0) ? new Decimal(0) : nextBalance },
        });
      }
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

export async function deleteSale(storeId: string, id: string, actor?: Actor | null) {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return false;
    }
    const cancelled = existing.status === "CANCELADA";
    if (!cancelled && (existing.integratedOperation || existing.tradeInId)) {
      throw new SalesError("Esta venta está vinculada a una operación. Gestioná la operación desde su origen.", 409);
    }

    // Cancellation already restored the operation. Its stock may have been sold again.
    if (!cancelled && existing.inventoryItemId) {
      await tx.inventoryItem.updateMany({
        where: { id: existing.inventoryItemId, storeId },
        data: { status: "DISPONIBLE" },
      });
    }

    if (!cancelled && existing.clientId) {
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

    if (actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "sale.deleted",
        entityType: "sale",
        entityId: id,
        detail: existing.deviceLabel || existing.clientName || null,
      });
    }

    await voidSaleCommission(tx, storeId, id, "DELETED");
    // A prior cancellation already voided the snapshot. Preserve its date/adjustment month.
    await tx.commissionAccrual.updateMany({ where: { storeId, sourceSaleId: id, voidReason: "CANCELLED" }, data: { voidReason: "DELETED" } });
    await tx.sale.delete({
      where: { id },
    });

    return true;
  });
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface SaleImportRow {
  sellerMemberId?: string | null;
  exchangeRate?: number;
  date?: string;
  clientName?: string;
  clientDni?: string;
  clientPhone?: string;
  device?: string;
  productImei?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
  tradeIn?: string;
  seller?: string;
  status?: string;
}

export interface SaleImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

type ImportClient = {
  id: string;
  name: string;
  dni: string | null;
  phone: string | null;
  email: string | null;
  totalSpent: Decimal;
  lastPurchaseAt: Date | null;
};

export async function importSales(
  storeId: string,
  rows: SaleImportRow[],
  actor?: Actor,
): Promise<SaleImportResult> {
  let imported = 0;
  const errors: { row: number; message: string }[] = [];
  const clients: ImportClient[] = await prisma.client.findMany({
    where: { storeId },
    select: { id: true, name: true, dni: true, phone: true, email: true, totalSpent: true, lastPurchaseAt: true },
  });
  const members = await prisma.storeMember.findMany({
    where: { storeId },
    select: { id: true, userId: true, user: { select: { displayName: true } } },
  });
  const sellers = members.map((member) => ({ userId: member.userId, displayName: member.user.displayName }));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    try {
      const clientName = r.clientName?.trim().replace(/\s+/g, " ") ?? "";
      const device = r.device?.trim().replace(/\s+/g, " ") ?? "";
      const imei = normalizeImei(r.productImei);
      const dni = normalizeImportedDni(r.clientDni);
      const phone = normalizeImportedPhone(r.clientPhone);
      const tradeIn = normalizeTradeIn(r.tradeIn);
      const seller = r.seller?.trim() ?? "";
      const amount = parseMoney(r.amount ?? "");
      if (amount == null) {
        errors.push({ row: rowNum, message: "Importe inválido" });
        continue;
      }
      if (!clientName && !device && !imei) {
        errors.push({ row: rowNum, message: "La venta no tiene cliente ni equipo" });
        continue;
      }

      const paymentMethod = normalizePayment(r.paymentMethod);
      const status = r.status?.trim() === "PENDIENTE" ? "PENDIENTE" : "COMPLETADA";
      const soldAt = parseArDateOr(normalizeImportDate(r.date) || r.date);
      const dateLabel = formatArDate(soldAt);
      const rowCurrency = normalizeCurrencyToken(r.currency);

      await prisma.$transaction(async (tx) => {
        const clientLink = clientName || dni || phone
          ? decideClientLink(clients, { name: clientName, dni, phone })
          : { action: "skip" as const };
        let clientId: string | null = null;
        if (clientLink.action === "use") clientId = clientLink.clientId;
        if (clientLink.action === "create" && clientName) {
          const created = await tx.client.create({
            data: {
              storeId,
              name: clientName.slice(0, 120),
              dni: dni || null,
              phone: phone || null,
            },
            select: { id: true, name: true, dni: true, phone: true, email: true, totalSpent: true, lastPurchaseAt: true },
          });
          clients.push(created);
          clientId = created.id;
        }

        const item = imei
          ? await tx.inventoryItem.findFirst({
            where: { storeId, imei },
            select: { id: true, status: true, archivedAt: true, reservedDepositId: true },
          })
          : null;
        if (item?.reservedDepositId) throw new SalesError("El equipo está reservado. Registrá la venta aplicando la seña desde Nueva venta", 409);
        if (item) await lockInventory(tx, storeId, item.id);
        const activeSale = item
          ? await tx.sale.findFirst({
            where: { storeId, inventoryItemId: item.id, status: { not: "CANCELADA" } },
            select: { id: true },
          })
          : null;
        const stock = decideInventoryLink(item, Boolean(activeSale));
        const inventoryItemId = stock.action === "link" ? stock.inventoryItemId : null;
        const openTrades = clientId && tradeIn
          ? await tx.tradeIn.findMany({
            where: { storeId, clientId, sale: { is: null } },
            select: { id: true, deviceReceived: true },
          })
          : [];
        const tradeInId = matchOpenTradeIn(openTrades, tradeIn);
        const sellerUserId = matchSellerUserId(sellers, seller);
        const customFields: Record<string, string> = {};
        if (seller) customFields.vendedor = seller;
        if (sellerUserId) customFields.sellerUserId = sellerUserId;
        if (tradeIn) customFields.canje = tradeIn;
        if (imei && !inventoryItemId) customFields.imei = imei;
        const deviceLabel = [device, !inventoryItemId && imei ? imei : ""].filter(Boolean).join(" · ").slice(0, 120) || null;
        const linkedClient = clientId ? clients.find((client) => client.id === clientId) : undefined;
        const saleNumber = await allocateDocumentNumber(tx, storeId, "sale");
        const amountCurrency = currencyOnWrite(rowCurrency, true, await storeCurrency(storeId, tx));

        const sellerMemberId = r.sellerMemberId !== undefined ? r.sellerMemberId : (sellerUserId ? members.find(member => member.userId === sellerUserId)?.id ?? null : null);
        await assertSeller(tx, storeId, sellerMemberId);
        const exchangeRate = await saleExchangeRate(r.exchangeRate);
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            sellerMemberId,
            registeredByUserId: actor?.userId ?? null,
            exchangeRate,
            storeId,
            clientId,
            clientName: clientName || linkedClient?.name || "",
            inventoryItemId,
            tradeInId,
            deviceLabel,
            dateLabel,
            amount: toDecimal(amount),
            ...(amountCurrency ? { amountCurrency } : {}),
            paymentMethod,
            status,
            customFields: normalizeCustomFields(customFields),
            soldAt,
            warrantyDays: null,
          },
        });

        if (sellerMemberId) await recordSaleCommission(tx, storeId, sale.id);
        if (inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: inventoryItemId },
            data: { status: "VENDIDO" },
          });
        }

        if (linkedClient) {
          const nextSpent = new Decimal(linkedClient.totalSpent.toString()).add(amount);
          const nextPurchase = !linkedClient.lastPurchaseAt || soldAt > linkedClient.lastPurchaseAt
            ? soldAt
            : linkedClient.lastPurchaseAt;
          await tx.client.update({
            where: { id: linkedClient.id },
            data: { totalSpent: nextSpent, lastPurchaseAt: nextPurchase },
          });
          linkedClient.totalSpent = nextSpent;
          linkedClient.lastPurchaseAt = nextPurchase;
        }
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
