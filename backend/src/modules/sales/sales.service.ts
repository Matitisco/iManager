import { saleUnits, takeStock, releaseStock } from '../inventory/stock-units.js';
import { captureSaleCancellation } from '../operations/sale-restoration.js';
import { addSaleReview, prepareSaleReviewRows, type SaleReviewRow } from '../import/sale-import-row.js';
import { priceSaleReviewRows } from '../import/sale-import-rate.js';
import { saleImportNotes } from '../import/sale-import-preview.js';
import { importErrorCollector, type ImportDiagnostics } from "../import/import-diagnostics.js";
import { trackFirstSale } from '../analytics/first-sale.js';
import { lockTransactionKey } from '../../lib/advisory-lock.js';
import { recordCash, reverseCashSource } from '../cash/service.js';
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
import { cleanReason, saleCode, type ArchiveMeta } from "../audit/archive.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";
import { decideClientLink, decideInventoryLink, matchOpenTradeIn, matchSellerUserId } from "../import/link-imported-sale.js";
import { normalizeCurrencyToken, normalizeImei, normalizeImportDate, normalizeImportedDni, normalizeImportedPhone, normalizePayment, normalizeTradeIn } from "../import/normalize-import.js";
import { parseMoney } from "../import/sheet-plan.js";
import { saleDaysFromStore } from "../warranty/warranty.js";

export interface SaleInput {
  cantidad?: number;
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
  cantidad: number;
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
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  warrantyDays: number | null;
  soldAt: string;
}

type SaleRecord = {
  cantidad?: number;
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
  voidedAt?: Date | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  warrantyDays?: number | null;
  inventoryItem?: { model: string; capacity: string; condition?: string } | null;
};

export interface SaleCategoryResponse {
  id: string;
  name: string;
  archived?: boolean;
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
    where: { storeId, clientId, voidedAt: null, status: { notIn: ["CANCELADA", "ANULADA"] } },
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
    cantidad: sale.cantidad ?? 1,
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
    voidedAt: sale.voidedAt ? sale.voidedAt.toISOString() : null,
    voidedBy: sale.voidedBy ?? null,
    voidReason: sale.voidReason ?? null,
    warrantyDays: sale.warrantyDays ?? null,
    soldAt: sale.soldAt.toISOString(),
  };
}

export async function listSales(storeId: string, options?: { voided?: boolean }) {
  const sales = await prisma.sale.findMany({
    where: { storeId, voidedAt: options?.voided ? { not: null } : null },
    orderBy: { soldAt: "desc" },
    include: { inventoryItem: { select: { model: true, capacity: true } } },
  });

  return sales.map(serializeSale);
}

export async function createSale(storeId: string, input: SaleInput, actor?: Actor) {
  const result = await prisma.$transaction(async (tx) => {
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

    if (inventoryItem?.price === null && !(input.amount > 0)) throw new SalesError("Cargá el precio de venta del equipo con precio a definir", 400);
    if (inventoryItem && inventoryItem.status && inventoryItem.status !== "DISPONIBLE") {
      throw new SalesError("Inventory item is not available", 409);
    }

    if (!inventoryItem && !deviceLabel) {
      throw new SalesError("Indicá el equipo", 400);
    }

    const cantidad = saleUnits(input.cantidad ?? 1, inventoryItem);
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
        cantidad,
        stockDeducted: Boolean(inventoryItem),
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

    if (sale.status === 'COMPLETADA') await recordCash(tx, { storeId, amount: Number(sale.amount), currency: amountCurrency ?? 'ARS', method: sale.paymentMethod, sourceType: 'sale', sourceId: sale.id, note: 'Cobro de venta', actor });
    if (input.sellerMemberId) await recordSaleCommission(tx, storeId, sale.id);
    if (inventoryItem) {
      await takeStock(tx, inventoryItem, cantidad);
      if (inventoryItem.price === null) await tx.inventoryItem.update({ where: { id: inventoryItem.id }, data: { price: toDecimal(input.amount / cantidad), currency: amountCurrency } });
    }

    if (client && !["CANCELADA", "ANULADA"].includes(input.status)) {
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
  void trackFirstSale(storeId, result.id, 'form', actor?.userId);
  return result;
}

export async function updateSale(
  storeId: string,
  id: string,
  input: SalePatchInput,
  actor?: Actor | null,
  reason?: string | null,
) {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return null;
    }
    if (existing.voidedAt || ['CANCELADA', 'ANULADA'].includes(existing.status)) {
      throw new SalesError('Revertí la anulación antes de editar esta venta', 409);
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

      if (inventoryItem.price === null && !((input.amount ?? Number(existing.amount)) > 0)) throw new SalesError("Cargá el precio de venta del equipo con precio a definir", 400);
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
    const saveCancellation = cancelling ? await captureSaleCancellation(tx, existing) : null;

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

    if (cancelling) await reverseCashSource(tx, storeId, 'sale', id, actor);
    else {
      if (existing.status === 'PENDIENTE' && updated.status === 'COMPLETADA') await recordCash(tx, { storeId, amount: Number(existing.openBalance ?? updated.amount), currency: updated.amountCurrency ?? await storeCurrency(storeId, tx), method: updated.paymentMethod, sourceType: 'sale', sourceId: id, note: 'Saldo de venta cobrado', actor });
    }
    if (!cancelling) await refreshSaleCommission(tx, storeId, id);
    if (actor && input.sellerMemberId !== undefined && input.sellerMemberId !== existing.sellerMemberId) await writeAudit(tx, { storeId, actor, action: "sale.seller.changed", entityType: "sale", entityId: id, entityLabel: saleCode(existing.saleNumber) });
    if (cancelling && actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "sale.cancelled",
        reason,
        entityType: "sale",
        entityId: id,
      });
    }

    if (cancelling || existing.inventoryItemId !== nextInventoryItemId) await releaseStock(tx, storeId, existing);
    if (!cancelling && nextInventoryItemId && nextInventoryItemId !== existing.inventoryItemId) {
      const nextItem = await tx.inventoryItem.findFirstOrThrow({ where: { id: nextInventoryItemId, storeId } });
      await takeStock(tx, nextItem, existing.cantidad);
      await tx.sale.update({ where: { id }, data: { stockDeducted: true } });
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
      input.clientId !== undefined ||
      input.status !== undefined
    ) {
      const affectedClientIds = new Set<string>();
      if (existing.clientId) affectedClientIds.add(existing.clientId);
      if (nextClientId) affectedClientIds.add(nextClientId);

      for (const clientId of affectedClientIds) {
        await recomputeClientStats(tx, storeId, clientId);
      }
    }

    await saveCancellation?.();
    return serializeSale(updated as SaleRecord);
  });
}

export async function deleteSale(storeId: string, id: string, actor?: Actor | null, meta?: ArchiveMeta) {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, storeId },
    });

    if (!existing || existing.voidedAt) {
      return false;
    }
    const cancelled = existing.status === "CANCELADA";
    if (!cancelled && (existing.integratedOperation || existing.tradeInId)) {
      throw new SalesError("Esta venta está vinculada a una operación. Gestioná la operación desde su origen.", 409);
    }
    const saveCancellation = !cancelled ? await captureSaleCancellation(tx, existing) : null;

    // Cancellation already restored the operation. Its stock may have been sold again.
    if (!cancelled && existing.inventoryItemId) await releaseStock(tx, storeId, existing);

    if (!cancelled && existing.clientId) {
      const aggregate = await tx.sale.aggregate({
        where: {
          storeId,
          clientId: existing.clientId,
          id: { not: id },
          voidedAt: null,
          status: { notIn: ["CANCELADA", "ANULADA"] },
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

    const reason = cleanReason(meta?.reason);
    if (actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "sale.voided",
        entityType: "sale",
        entityId: id,
        entityLabel: [saleCode(existing.saleNumber), existing.deviceLabel || existing.clientName].filter(Boolean).join(" · "),
        detail: existing.deviceLabel || existing.clientName || null,
        reason,
        source: meta?.source ?? "app",
        changes: [{ field: "status", label: "Estado", before: existing.status, after: "Anulada" }],
      });
    }

    await voidSaleCommission(tx, storeId, id, "DELETED");
    // A prior cancellation already voided the snapshot. Preserve its date/adjustment month.
    await tx.commissionAccrual.updateMany({ where: { storeId, sourceSaleId: id, voidReason: "CANCELLED" }, data: { voidReason: "DELETED" } });
    await tx.sale.update({
      where: { id },
      data: { voidedAt: new Date(), voidedBy: actor?.name ?? null, voidReason: reason, tradeInId: null },
    });

    await saveCancellation?.();
    return true;
  });
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface SaleImportRow {
  sourceRow?: number;
  _sourceRow?: string;
  _sourceSheet?: string;
  _sourceData?: string;
  _possibleTotal?: string;
  _unassigned?: string;
  _exchangeRate?: string;
  _rateSource?: string;
  _rateDate?: string;
  notes?: string;
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
  warnings?: { row: number; message: string }[];
  diagnostics?: ImportDiagnostics;
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
  const currency = await storeCurrency(storeId, prisma);
  const prepared = prepareSaleReviewRows(rows.map(row => Object.fromEntries(Object.entries(row)
    .filter(([, value]) => value != null).map(([key, value]) => [key, String(value)]))), currency);
  await priceSaleReviewRows(prepared, true);
  const result = await withSerializableRetry(async tx => {
    let imported = 0, updated = 0;
    const warnings: { row: number; message: string }[] = [];
    const saleIds: string[] = [];
    const clients: ImportClient[] = await tx.client.findMany({
      where: { storeId },
      select: { id: true, name: true, dni: true, phone: true, email: true, totalSpent: true, lastPurchaseAt: true },
    });
    const members = await tx.storeMember.findMany({ where: { storeId }, select: { id: true, userId: true, user: { select: { displayName: true } } } });
    const sellers = members.map(member => ({ userId: member.userId, displayName: member.user.displayName }));
    // Stable ordering plus one store lock keeps concurrent retries and batch changes atomic.
    await lockTransactionKey(tx, `sale-import:${storeId}`);
    for (let i = 0; i < prepared.length; i++) {
      const r: SaleReviewRow = { ...prepared[i] };
      const rowNum = Number(r.sourceRow || r._sourceRow) || i + 2;
      const importFingerprint = r._importFingerprint;
      const duplicate = await tx.sale.findFirst({
        where: { storeId, customFields: { path: ['importFingerprint'], equals: importFingerprint } }, select: { id: true },
      });
      if (duplicate) {
        updated++;
        warnings.push({ row: rowNum, message: 'Venta ya importada: se conservó la existente, sin duplicarla' });
        continue;
      }
      const clientName = r.clientName || '';
      const device = r.device || '';
      const imei = normalizeImei(r.productImei);
      const dni = normalizeImportedDni(r.clientDni);
      const phone = normalizeImportedPhone(r.clientPhone);
      const tradeIn = normalizeTradeIn(r.tradeIn);
      const seller = r.seller?.trim() || '';
      const isTotal = r._possibleTotal === 'true';
      const originalAmount = isTotal || r._unpriced === 'true' ? 0 : parseMoney(r.amount || '') ?? 0;
      const amount = r.currency === 'ARS' ? Number(r._amountUsd) : originalAmount;
      const amountCurrency = 'USD';
      const paymentMethod = normalizePayment(r.paymentMethod);
      const status = r.status?.trim() === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA';
      const soldAt = parseArDateOr(r.date);
      const dateLabel = (r.date || 'Por revisar').slice(0, 120);
      const clientLink = !isTotal && (clientName || dni || phone) ? decideClientLink(clients, { name: clientName, dni, phone }) : { action: 'skip' as const };
      let clientId: string | null = null;
      if (clientLink.action === 'use') clientId = clientLink.clientId;
      if (clientLink.action === 'ambiguous') addSaleReview(r, 'Cliente ambiguo: se conserva sin vincular');
      if (clientLink.action === 'create' && clientName) {
        const created = await tx.client.create({
          data: { storeId, name: clientName.slice(0, 120), dni: dni || null, phone: phone || null },
          select: { id: true, name: true, dni: true, phone: true, email: true, totalSpent: true, lastPurchaseAt: true },
        });
        clients.push(created); clientId = created.id;
      }
      let item = imei && !isTotal ? await tx.inventoryItem.findFirst({
        where: { storeId, imei }, select: { id: true, status: true, archivedAt: true, reservedDepositId: true },
      }) : null;
      if (item) {
        await lockInventory(tx, storeId, item.id);
        item = await tx.inventoryItem.findFirst({ where: { id: item.id, storeId }, select: { id: true, status: true, archivedAt: true, reservedDepositId: true } });
      }
      const activeSale = item ? await tx.sale.findFirst({ where: { storeId, inventoryItemId: item.id, status: { not: 'CANCELADA' } }, select: { id: true } }) : null;
      const stock = decideInventoryLink(item, Boolean(activeSale) || Boolean(item?.reservedDepositId) || Boolean(r._review?.includes('IMEI repetido')));
      const inventoryItemId = stock.action === 'link' ? stock.inventoryItemId : null;
      if (imei && !inventoryItemId) addSaleReview(r, item ? 'IMEI no disponible en stock: se importó sin modificar el equipo' : 'IMEI no encontrado en stock: se importó sin vincular equipo');
      const openTrades = clientId && tradeIn ? await tx.tradeIn.findMany({ where: { storeId, clientId, sale: { is: null } }, select: { id: true, deviceReceived: true } }) : [];
      const tradeInId = matchOpenTradeIn(openTrades, tradeIn);
      const sellerUserId = matchSellerUserId(sellers, seller);
      const customFields: Record<string, string> = { importFingerprint };
      if (seller) customFields.vendedor = seller;
      if (sellerUserId) customFields.sellerUserId = sellerUserId;
      if (tradeIn) customFields.canje = tradeIn;
      if (imei && !inventoryItemId) customFields.imei = imei;
      customFields.notas = saleImportNotes(r);
      if (r._review) customFields.importReview = r._review;
      if (r._sourceData) customFields.importSourceData = r._sourceData;
      if (r._sourceSheet) customFields.importSourceSheet = r._sourceSheet;
      customFields.importSourceRow = String(rowNum);
      customFields.importOriginalAmount = r.amount || '';
      customFields.importOriginalCurrency = r.currency;
      if (r._rateDate) customFields.importRateDate = r._rateDate;
      if (r._rateSource) customFields.importRateSource = r._rateSource;
      const deviceLabel = [device, !inventoryItemId && imei ? imei : ''].filter(Boolean).join(' · ').slice(0, 120) || null;
      const linkedClient = clientId ? await tx.client.findFirst({ where: { storeId, id: clientId } }) : null;
      const saleNumber = await allocateDocumentNumber(tx, storeId, 'sale');
      const sellerMemberId = r.sellerMemberId || (sellerUserId ? members.find(member => member.userId === sellerUserId)?.id ?? null : null);
      await assertSeller(tx, storeId, sellerMemberId);
      const exchangeRate = await saleExchangeRate(r._exchangeRate ? Number(r._exchangeRate) : r.exchangeRate ? Number(r.exchangeRate) : undefined);
      const sale = await tx.sale.create({ data: {
        saleNumber, sellerMemberId, registeredByUserId: actor?.userId ?? null, exchangeRate,
        storeId, clientId, clientName: clientName || linkedClient?.name || '', inventoryItemId, tradeInId, deviceLabel,
        dateLabel, amount: toDecimal(amount), amountCurrency, paymentMethod, status,
        customFields: normalizeCustomFields(customFields), soldAt, warrantyDays: null,
      } });
      if (sellerMemberId) await recordSaleCommission(tx, storeId, sale.id);
      if (inventoryItemId) await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { status: 'VENDIDO' } });
      if (linkedClient) await tx.client.update({ where: { id: linkedClient.id }, data: {
        totalSpent: { increment: toDecimal(amount) }, lastPurchaseAt: !linkedClient.lastPurchaseAt || soldAt > linkedClient.lastPurchaseAt ? soldAt : linkedClient.lastPurchaseAt,
      } });
      if (r._review) warnings.push({ row: rowNum, message: r._review });
      saleIds.push(sale.id); imported++;
    }
    return { imported, updated, errors: [], warnings, saleIds, diagnostics: importErrorCollector([]).finish(rows.length, imported + updated) };
  }, 5, 120_000);
  for (const id of result.saleIds) void trackFirstSale(storeId, id, 'import', actor?.userId);
  const { saleIds: _saleIds, ...response } = result;
  return response;
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(storeId: string): Promise<SaleCategoryResponse[]> {
  const cats = await prisma.saleCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, archivedAt: true },
  });
  return cats.map((cat) => ({
    id: cat.id,
    name: cat.archivedAt ? `${cat.name} (archivada)` : cat.name,
    archived: Boolean(cat.archivedAt),
  }));
}

export async function createCategory(storeId: string, name: string): Promise<SaleCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new SalesError("Category name required", 400);
  const existing = await prisma.saleCategory.findFirst({ where: { storeId, name: trimmed } });
  if (existing?.archivedAt) {
    return prisma.saleCategory.update({
      where: { id: existing.id },
      data: { archivedAt: null },
      select: { id: true, name: true },
    });
  }
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

export async function deleteCategory(storeId: string, id: string, actor?: Actor | null): Promise<boolean> {
  const existing = await prisma.saleCategory.findFirst({ where: { id, storeId } });
  if (!existing || existing.archivedAt) return false;
  await prisma.saleCategory.update({ where: { id }, data: { archivedAt: new Date() } });
  if (actor) {
    await writeAudit(prisma, {
      storeId,
      actor,
      action: "category.archived",
      entityType: "category",
      entityId: id,
      entityLabel: existing.name,
      detail: "Ventas",
    });
  }
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
