import { trackFirstSale } from '../analytics/first-sale.js';
import { recordCash, reverseCashSource } from '../cash/service.js';
import { coverSaleWithCredits } from '../returns/returns.service.js';
import { applyDeposits, restoreSaleDeposits, lockInventory } from '../deposits/deposits.service.js';
import { hasSettlement, settleNewSale, type SettlementRequest } from "../accounts/settlement.js";
import { recordPriceRise } from "../accounts/accounts.service.js";
import { priceRiseDebt } from "../accounts/ledger.js";
import { saleExchangeRate } from "../../lib/blue-rate.js";
import { assertSeller, recordSaleCommission, refreshSaleCommission, voidSaleCommission } from "../commissions/commission-ledger.js";
import { Prisma } from "@prisma/client";
import type { Client, InventoryItem, Sale, TradeIn } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { formatArDate, formatStoredDate, parseArDateOr } from "../../lib/ar-date.js";
import { formatArMoney } from "../../lib/ar-money.js";
import { cancellationSettlement, type RefundTarget } from "../../lib/cancel-refund.js";
import { allocateDocumentNumber } from "../../lib/store-sequence.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { cancellationStamp, moneyChanged, writeAudit, type Actor } from "../audit/audit.js";
import { saleCode } from "../audit/archive.js";
import { parseOptionalImei } from "../../lib/imei.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";

async function copyCurrency(db: Prisma.TransactionClient, storeId: string, explicit?: string | null) {
  if (explicit === "ARS" || explicit === "USD") return explicit;
  return storeCurrency(storeId, db);
}
import { cancelledInventoryRecord, noticeTargets, operationSummary, sectionRecords } from "./operation-copy.js";
import { MISSING_OUTGOING_PRICE, outgoingTradeDifference } from "./outgoing-difference.js";
import { parseQuality } from "../inventory/quality.js";
import { saleDaysFromStore } from "../warranty/warranty.js";

async function warrantyForSale(tx: Prisma.TransactionClient, storeId: string, explicit: number | undefined, condition: string | null | undefined) {
  const store = explicit === undefined
    ? await tx.store.findUnique({ where: { id: storeId }, select: { usedWarrantyDays: true, sealedWarrantyDays: true } })
    : null;
  return saleDaysFromStore(explicit, condition, store);
}

const dec = (value: number | Decimal) => new Decimal(value instanceof Decimal ? value.toString() : value);
const toNum = (value: number | Decimal) => Number(value instanceof Decimal ? value.toString() : value);
const toJson = (value?: unknown) => (value ?? {}) as Prisma.InputJsonValue;

export type OperationSource = "inventory" | "sales" | "tradeins" | "clients";
export type OperationInput = {
  depositIds?: string[];
  sellerMemberId?: string | null;
  exchangeRate?: number;
  date?: string;
  clientId?: string | null;
  clientName?: string | null;
  productId?: string | null;
  deviceLabel?: string | null;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
  requestKey?: string;
  draft?: boolean;
  saleCategoryId?: string | null;
  currency?: string | null;
  warrantyDays?: number;
  unlistedEquipment?: {
    model: string;
    capacity?: string;
    color?: string;
    condition?: string;
    imei?: string | null;
    price?: number;
  };
  tradeIn?: {
    deviceReceived: string;
    deviceReceivedImei?: string | null;
    takeValue: number;
    status?: string;
    batteryHealth?: string | null;
    grade?: string | null;
    customFields?: Record<string, unknown> | null;
  } | null;
  tenders?: SettlementRequest["tenders"];
  excess?: SettlementRequest["excess"];
  changeMethod?: string;
  installments?: SettlementRequest["installments"];
  creditNoteIds?: string[];
};
export class OperationError extends DomainError {}

function strictTradeGrade(value: string | null | undefined): string | null {
  const parsed = parseQuality(value);
  if (parsed.ok === false) throw new OperationError(parsed.message);
  return parsed.grade || null;
}

function coerceTradeGrade(value: string | null | undefined): string | null {
  const parsed = parseQuality(value);
  return parsed.ok ? parsed.grade || null : null;
}

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

async function assertCategory(tx: Prisma.TransactionClient, storeId: string, source: OperationSource, categoryId?: string | null) {
  if (!categoryId || (source !== "sales" && source !== "tradeins")) return;
  const found = source === "sales"
    ? await tx.saleCategory.findFirst({ where: { id: categoryId, storeId }, select: { id: true } })
    : await tx.tradeInCategory.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });
  if (!found) throw new OperationError("Category not found", 404);
}
async function assertIncomingImei(tx: Prisma.TransactionClient, storeId: string, imei?: string | null, exceptInventoryId?: string) {
  const parsed = parseOptionalImei(imei);
  if (parsed.ok === false) throw new OperationError(parsed.message, 400);
  const normalized = parsed.imei;
  if (!normalized) return;
  const duplicate = await tx.inventoryItem.findFirst({
    where: {
      storeId,
      imei: normalized,
      archivedAt: null,
      ...(exceptInventoryId ? { id: { not: exceptInventoryId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new OperationError("Ya existe un equipo con ese IMEI", 409);
}

async function receiveDevice(tx: Prisma.TransactionClient, data: Prisma.InventoryItemUncheckedCreateInput) {
  const imei = typeof data.imei === "string" ? data.imei.trim() : "";
  if (imei) {
    const archived = await tx.inventoryItem.findFirst({
      where: { storeId: data.storeId, imei, archivedAt: { not: null } },
    });
    if (archived) {
      const restored = await tx.inventoryItem.update({
        where: { id: archived.id },
        data: {
          imei,
          model: data.model,
          capacity: data.capacity ?? "",
          color: data.color ?? "",
          condition: data.condition,
          grade: data.grade ?? "",
          batteryHealth: data.batteryHealth ?? "",
          cost: data.cost,
          price: data.price,
          currency: data.currency,
          status: data.status,
          customFields: data.customFields ?? {},
          archivedAt: null,
          archivedBy: null,
          archiveReason: null,
        },
      });
      await writeAudit(tx, {
        storeId: data.storeId,
        actor: null,
        action: "inventory.restored",
        entityType: "inventory",
        entityId: archived.id,
        entityLabel: [restored.model, restored.capacity].filter(Boolean).join(" ").slice(0, 160) || "Equipo",
        source: "system",
        detail: "Restaurado al recibir un canje",
        changes: [{ field: "status", label: "Estado", before: "Archivado", after: "Activo" }],
      });
      return restored;
    }
  }
  return tx.inventoryItem.create({ data });
}

type TradeForResponse = TradeIn & { saleId?: string | null; sale?: { id: string } | null };
function serializeSale(sale: Sale, product?: Pick<InventoryItem, "model" | "capacity"> | null) {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    date: formatStoredDate(sale.dateLabel, sale.soldAt),
    clientId: sale.clientId ?? "",
    clientName: sale.clientName ?? "",
    productId: sale.inventoryItemId ?? "",
    deviceLabel: sale.deviceLabel || (product ? fullDeviceLabel(product) : ""),
    depositAppliedAmount: toNum(sale.depositAppliedAmount),
    openBalance: sale.openBalance == null ? null : toNum(sale.openBalance),
    amount: toNum(sale.amount),
    amountCurrency: sale.amountCurrency ?? null,
    sellerMemberId: sale.sellerMemberId,
    registeredByUserId: sale.registeredByUserId,
    exchangeRate: sale.exchangeRate == null ? null : Number(sale.exchangeRate),
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    categoryId: sale.categoryId ?? null,
    customFields: sale.customFields ?? {},
    tradeInId: sale.tradeInId ?? null,
    requestKey: sale.requestKey ?? null,
    integratedOperation: sale.integratedOperation,
    cancelledBy: sale.cancelledBy ?? null,
    cancelledAt: sale.cancelledAt?.toISOString() ?? null,
    warrantyDays: sale.warrantyDays ?? null,
  };
}

function serializeTrade(trade: TradeForResponse) {
  return {
    id: trade.id,
    tradeNumber: trade.tradeNumber,
    date: formatStoredDate(trade.dateLabel, trade.tradeAt),
    clientId: trade.clientId ?? "",
    clientName: trade.clientName ?? "",
    categoryId: trade.categoryId ?? null,
    deviceReceived: trade.deviceReceived,
    deviceReceivedImei: trade.deviceReceivedImei ?? "",
    takeValue: toNum(trade.takeValue),
    currency: trade.currency ?? null,
    deviceGiven: trade.deviceGiven,
    differencePaid: toNum(trade.differencePaid),
    status: trade.status,
    confirmationStatus: trade.confirmationStatus,
    removedFromSaleNumber: trade.removedFromSaleNumber ?? null,
    operationSource: trade.operationSource ?? null,
    saleId: trade.sale?.id ?? trade.saleId ?? null,
    receivedInventoryItemId: trade.receivedInventoryItemId ?? null,
    batteryHealth: trade.batteryHealth ?? null,
    grade: trade.grade ?? null,
    customFields: trade.customFields ?? {},
    draftProductId: trade.draftProductId ?? null,
    draftDeviceLabel: trade.draftDeviceLabel ?? null,
    draftSaleCategoryId: trade.draftSaleCategoryId ?? null,
    draftAmount: trade.draftAmount ? toNum(trade.draftAmount) : null,
    draftPaymentMethod: trade.draftPaymentMethod ?? null,
    draftPaymentStatus: trade.draftPaymentStatus ?? null,
    cancelledBy: trade.cancelledBy ?? null,
    cancelledAt: trade.cancelledAt?.toISOString() ?? null,
  };
}

function serializeProduct(product: InventoryItem) {
  return {
    id: product.id,
    imei: product.imei ?? "",
    model: product.model,
    capacity: product.capacity,
    color: product.color,
    condition: product.condition,
    grade: product.grade,
    batteryHealth: product.batteryHealth,
    cost: toNum(product.cost),
    price: toNum(product.price),
    currency: product.currency ?? null,
    status: product.status,
    reservedDepositId: product.reservedDepositId,
    reservedClientId: product.reservedClientId,
    reservedClientName: product.reservedClientName,
    reservedAt: product.reservedAt?.toISOString() ?? null,
    categoryId: product.categoryId ?? null,
    customFields: product.customFields ?? {},
    soldAt: null,
    createdAt: product.createdAt.toISOString(),
    archivedAt: product.archivedAt?.toISOString() ?? null,
    pendingSaleRegistration: product.pendingSaleRegistration,
    needsCompletion: product.needsCompletion,
    priceChangedBy: product.priceChangedBy ?? null,
    priceChangedAt: product.priceChangedAt?.toISOString() ?? null,
    costChangedBy: product.costChangedBy ?? null,
    costChangedAt: product.costChangedAt?.toISOString() ?? null,
  };
}

function serializeClient(client: Client) {
  return {
    id: client.id,
    dni: client.dni ?? "",
    name: client.name,
    email: client.email ?? "",
    phone: client.phone ?? "",
    lastPurchaseDate: client.lastPurchaseAt ? formatArDate(client.lastPurchaseAt) : "N/A",
    totalSpent: toNum(client.totalSpent),
    pendingBalance: toNum(client.pendingBalance),
    categoryId: client.categoryId ?? null,
    tag: client.tag ?? null,
    customFields: client.customFields ?? {},
    createdAt: client.createdAt ? client.createdAt.toISOString() : null,
  };
}

export async function writeOperationNotifications(
  tx: Prisma.TransactionClient,
  storeId: string,
  records: Array<{
    section: string;
    title: string;
    message: string;
    recordId?: string;
    targets?: Array<{ recordId: string; reason: string }>;
    kind: string;
  }>,
) {
  const result = [];
  for (const record of records) {
    result.push(
      await tx.storeNotification.create({
        data: {
          storeId,
          section: record.section,
          title: record.title,
          message: record.message,
          recordId: record.recordId,
          kind: record.kind,
          targets: record.targets?.length ? (record.targets as Prisma.InputJsonValue) : undefined,
        },
      }),
    );
  }
  return result.map((notification) => ({
    id: notification.id,
    storeId: notification.storeId,
    section: notification.section,
    title: notification.title,
    message: notification.message,
    recordId: notification.recordId,
    targets: Array.isArray(notification.targets) ? notification.targets as Array<{ recordId: string; reason: string }> : null,
    kind: notification.kind,
    createdAt: notification.createdAt.toISOString(),
  }));
}
async function notify(tx: Prisma.TransactionClient, storeId: string, records: ReturnType<typeof sectionRecords>) {
  return writeOperationNotifications(tx, storeId, records);
}
async function stampDepositClientCurrency(tx: Prisma.TransactionClient, storeId: string, client: Client | null, currency: string, applied: Decimal) {
  if (!client || !applied.gt(0)) return;
  const original = client.balanceCurrency ?? await storeCurrency(storeId, tx);
  if (original !== currency && (Number(client.pendingBalance) !== 0 || Number(client.totalSpent) !== 0)) throw new OperationError(`El cliente tiene saldos en ${original}. Registrá esta venta en esa moneda para conservar su cuenta corriente`, 409);
  await tx.client.update({ where: { id: client.id }, data: { balanceCurrency: currency } });
}
async function applyClientOperation(tx: Prisma.TransactionClient, storeId: string, clientId: string, amount: number, paymentStatus: string, date: Date, direction: 1 | -1, debtAmount = amount) {
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  const total = Math.max(0, toNum(client.totalSpent) + direction * amount);
  const pending = Math.max(0, toNum(client.pendingBalance) + (paymentStatus === "PENDIENTE" ? direction * debtAmount : 0));
  const lastPurchaseAt = direction > 0 ? date : (await tx.sale.aggregate({ where: { storeId, clientId, voidedAt: null, status: { not: "CANCELADA" } }, _max: { soldAt: true } }))._max.soldAt;
  await tx.client.update({ where: { id: clientId }, data: { totalSpent: dec(total), pendingBalance: dec(pending), lastPurchaseAt } });
  return tx.client.findFirst({ where: { id: clientId, storeId } });
}
async function applyClientDelta(tx: Prisma.TransactionClient, storeId: string, priorId: string | null, nextId: string | null, priorAmount: number, nextAmount: number, priorStatus: string, nextStatus: string, priorDebt: number, nextDebt: number, date: Date) {
  const ids = new Set([priorId, nextId].filter((id): id is string => Boolean(id)));
  const changed = [];
  for (const id of ids) {
    const client = await tx.client.findFirst({ where: { id, storeId } });
    if (!client) continue;
    const oldAmount = id === priorId ? priorAmount : 0;
    const newAmount = id === nextId ? nextAmount : 0;
    const oldDebt = id === priorId && priorStatus === "PENDIENTE" ? priorDebt : 0;
    const newDebt = id === nextId && nextStatus === "PENDIENTE" ? nextDebt : 0;
    const nextLastPurchase = newAmount > 0 ? date : (await tx.sale.aggregate({ where: { storeId, clientId: id, voidedAt: null, status: { not: "CANCELADA" } }, _max: { soldAt: true } }))._max.soldAt;
    await tx.client.update({ where: { id }, data: {
      totalSpent: dec(Math.max(0, toNum(client.totalSpent) + newAmount - oldAmount)),
      pendingBalance: dec(Math.max(0, toNum(client.pendingBalance) + newDebt - oldDebt)),
      lastPurchaseAt: nextLastPurchase,
    } });
    changed.push(await tx.client.findFirst({ where: { id, storeId } }));
  }
  return changed;
}
async function getClient(tx: Prisma.TransactionClient, storeId: string, input: OperationInput, prior?: Pick<Sale, "clientId" | "clientName"> | Pick<TradeIn, "clientId" | "clientName">) {
  if (input.clientId) {
    const found = await tx.client.findFirst({ where: { id: input.clientId, storeId } });
    if (!found) throw new OperationError("Client not found", 404);
    return { client: found, created: false };
  }
  const name = input.clientName?.trim();
  if (!name) return { client: null, created: false };
  if (prior?.clientId && prior.clientName === name) return { client: await tx.client.findFirst({ where: { id: prior.clientId, storeId } }), created: false };
  return { client: await tx.client.create({ data: { storeId, name, totalSpent: dec(0), pendingBalance: dec(0) } }), created: true };
}

function clipText(value: string | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

async function createUnlistedEquipment(
  tx: Prisma.TransactionClient,
  storeId: string,
  spec: NonNullable<OperationInput["unlistedEquipment"]>,
  amount: number,
  currency?: string | null,
) {
  const model = clipText(spec.model, 100);
  if (!model) throw new OperationError("Indicá el modelo del equipo");
  const parsedImei = parseOptionalImei(spec.imei);
  if (parsedImei.ok === false) throw new OperationError(parsedImei.message, 400);
  if (parsedImei.imei) await assertIncomingImei(tx, storeId, parsedImei.imei);
  const price = Number.isFinite(spec.price) ? Math.max(0, spec.price as number) : Math.max(0, amount);
  return tx.inventoryItem.create({
    data: {
      storeId,
      imei: parsedImei.imei,
      model,
      capacity: clipText(spec.capacity, 50),
      color: clipText(spec.color, 50),
      condition: clipText(spec.condition, 20),
      grade: "",
      batteryHealth: "",
      cost: dec(0),
      price: dec(price),
      ...(currency ? { currency } : {}),
      status: "DISPONIBLE",
      needsCompletion: true,
      customFields: {},
    },
  });
}

function assertTradeDifference(input: {
  registered: boolean;
  amount: number | undefined;
  takeValue: number;
  invalidMessage: string;
}) {
  if (input.amount !== undefined && input.amount >= input.takeValue) return input.amount - input.takeValue;
  const gap = outgoingTradeDifference({
    registered: input.registered,
    priceProvided: input.amount !== undefined && input.amount > 0,
    saleAmount: input.amount ?? 0,
    takeValue: input.takeValue,
  });
  throw new OperationError(gap.warning === MISSING_OUTGOING_PRICE ? MISSING_OUTGOING_PRICE : input.invalidMessage);
}

function fullDeviceLabel(product: Pick<InventoryItem, "model" | "capacity">) {
  return [product.model, product.capacity].filter(Boolean).join(" ").slice(0, 120);
}

function canRegisterOutgoingSale(product: { status: string; pendingSaleRegistration: boolean; reservedDepositId?: string | null; reservedClientId?: string | null }, input?: OperationInput) {
  if (product.reservedDepositId) return product.status === "RESERVADO" && product.reservedClientId === input?.clientId && Boolean(input?.depositIds?.includes(product.reservedDepositId));
  return !product.status || product.status === "DISPONIBLE" || (product.status === "VENDIDO" && product.pendingSaleRegistration);
}

function salePricePatch(price: { toNumber(): number }, amount: number, currency?: string): { price?: Decimal; currency?: string } {
  if (price.toNumber() > 0 || !(amount > 0)) return {};
  return { price: dec(amount), ...(currency ? { currency } : {}) };
}

async function replaySaleResult(tx: Prisma.TransactionClient, storeId: string, sale: Sale, summary: string) {
  const trade = sale.tradeInId ? await tx.tradeIn.findFirst({ where: { id: sale.tradeInId, storeId } }) : null;
  const [product, incoming, client] = await Promise.all([
    sale.inventoryItemId ? tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null,
    trade?.receivedInventoryItemId ? tx.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId } }) : null,
    sale.clientId ? tx.client.findFirst({ where: { id: sale.clientId, storeId } }) : null,
  ]);
  return {
    sale: serializeSale(sale, product),
    ...(trade ? { tradeIn: serializeTrade({ ...trade, saleId: sale.id }) } : {}),
    inventory: [product, incoming].filter(present).map(serializeProduct),
    clients: client ? [serializeClient(client)] : [],
    notifications: [],
    summary,
  };
}
export async function getOperationOptions(storeId: string) {
  const [products, clients] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        storeId,
        archivedAt: null,
        OR: [
          { status: { in: ["", "DISPONIBLE"] } },
          { status: "RESERVADO", reservedDepositId: { not: null } },
          { status: "VENDIDO", pendingSaleRegistration: true },
        ],
      },
      select: {
        id: true,
        model: true,
        capacity: true,
        color: true,
        imei: true,
        price: true,
        currency: true,
        condition: true,
        grade: true,
        pendingSaleRegistration: true,
        reservedDepositId: true,
        reservedClientId: true,
        reservedClientName: true,
        reservedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { storeId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { products: products.map((p) => ({ ...p, price: toNum(p.price), currency: p.currency ?? null })), clients };
}

export async function listOperationDrafts(storeId: string, source: OperationSource) {
  const tradeIns = await prisma.tradeIn.findMany({
    where: {
      storeId,
      confirmationStatus: "PENDING",
      ...(source === "tradeins" ? {} : { operationSource: source }),
    },
    orderBy: { updatedAt: "desc" },
  });
  return { tradeIns: tradeIns.map(serializeTrade) };
}

export async function createOperation(storeId: string, source: OperationSource, input: OperationInput, actor?: Actor) {
  const result = await withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    if (input.status === "CANCELADA") throw new OperationError("Una operación nueva no puede crearse cancelada", 400);
    if (input.draft && hasSettlement(input)) throw new OperationError("Las cuotas y los pagos mixtos se confirman con la venta");
    const currency = currencyOnWrite(input.currency, true, await storeCurrency(storeId, tx));
    const labelCurrency = await copyCurrency(tx, storeId, currency);
    if (input.tradeIn) await assertCategory(tx, storeId, "tradeins", input.categoryId);
    else if (source === "tradeins") await assertCategory(tx, storeId, "tradeins", input.categoryId);
    else await assertCategory(tx, storeId, "sales", input.saleCategoryId ?? input.categoryId);
    if (input.saleCategoryId !== undefined) await assertCategory(tx, storeId, "sales", input.saleCategoryId);
    if (input.draft && input.depositIds?.length) throw new OperationError("Aplicá la seña al confirmar, no al guardar pendiente");
    if (input.tradeIn && input.draft) {
      if (!input.tradeIn.deviceReceived?.trim() || !Number.isFinite(input.tradeIn.takeValue) || input.tradeIn.takeValue < 0) throw new OperationError("Datos del equipo recibido invalidos");
      if (input.amount !== undefined && input.amount < input.tradeIn.takeValue) {
        assertTradeDifference({
          registered: Boolean(input.productId?.trim()),
          amount: input.amount,
          takeValue: input.tradeIn.takeValue,
          invalidMessage: "La diferencia no puede ser negativa",
        });
      }
      const prior = input.requestKey ? await tx.tradeIn.findFirst({ where: { storeId, requestKey: input.requestKey } }) : null;
      if (prior) {
        const existingSale = await tx.sale.findFirst({ where: { storeId, tradeInId: prior.id } });
        if (existingSale) return replaySaleResult(tx, storeId, existingSale, "Canje recuperado");
        return { tradeIn: serializeTrade(prior), inventory: [], clients: [], notifications: [], summary: "Borrador de canje recuperado" };
      }
      const date = parseArDateOr(input.date);
      const draftClient = input.clientId ? await tx.client.findFirst({ where: { id: input.clientId, storeId }, select: { id: true, name: true } }) : null;
      if (input.clientId && !draftClient) throw new OperationError("Client not found", 404);
      if (input.productId) {
        const draftProduct = await tx.inventoryItem.findFirst({ where: { id: input.productId, storeId, archivedAt: null } });
        if (!draftProduct) throw new OperationError("Inventory item not found", 404);
        if (!canRegisterOutgoingSale(draftProduct)) throw new OperationError("El equipo no esta disponible para registrar una venta", 409);
      }
      const receivedImei = parseOptionalImei(input.tradeIn.deviceReceivedImei);
      if (receivedImei.ok === false) throw new OperationError(receivedImei.message, 400);
      const tradeNumber = await allocateDocumentNumber(tx, storeId, "trade");
      const trade = await tx.tradeIn.create({ data: {
        storeId,
        tradeNumber,
        clientId: draftClient?.id ?? null,
        clientName: draftClient?.name ?? input.clientName?.trim() ?? "",
        categoryId: input.categoryId ?? null,
        dateLabel: formatArDate(date),
        tradeAt: date,
        deviceReceived: input.tradeIn.deviceReceived.trim(),
        deviceReceivedImei: receivedImei.imei,
        takeValue: dec(input.tradeIn.takeValue),
        currency,
        deviceGiven: input.deviceLabel?.trim() ?? "",
        differencePaid: dec(0),
        status: input.tradeIn.status ?? "PENDIENTE",
        confirmationStatus: "PENDING",
        operationSource: source,
        batteryHealth: input.tradeIn.batteryHealth?.trim() || null,
        grade: strictTradeGrade(input.tradeIn.grade),
        customFields: toJson(input.tradeIn.customFields),
        requestKey: input.requestKey ?? null,
        draftProductId: input.productId ?? null,
        draftDeviceLabel: input.deviceLabel ?? null,
        draftSaleCategoryId: input.saleCategoryId ?? null,
        draftAmount: input.amount === undefined ? null : dec(input.amount),
        draftPaymentMethod: input.paymentMethod ?? null,
        draftPaymentStatus: input.status ?? null,
      } });
      const notifications = await notify(tx, storeId, sectionRecords(["tradeins"], {
        action: "draft-created",
        receivedDevice: trade.deviceReceived,
        takeValue: toNum(trade.takeValue),
        difference: input.amount === undefined ? null : input.amount - input.tradeIn.takeValue,
        currency: labelCurrency,
      }, { tradeins: trade.id }));
      return { tradeIn: serializeTrade(trade), inventory: [], clients: [], notifications, summary: "Borrador de canje guardado" };
    }
    const prior = input.requestKey ? await tx.sale.findFirst({ where: { storeId, requestKey: input.requestKey } }) : null;
    if (prior) return replaySaleResult(tx, storeId, prior, "Operación recuperada");
    const tradeInput = input.tradeIn;
    if (!Number.isFinite(input.amount) || (input.amount ?? -1) < 0) throw new OperationError("Monto inválido");
    if (tradeInput && (!tradeInput.deviceReceived?.trim() || !Number.isFinite(tradeInput.takeValue) || tradeInput.takeValue < 0)) throw new OperationError("Datos de canje invalidos o diferencia negativa");
    if (tradeInput) {
      assertTradeDifference({
        registered: Boolean(input.productId?.trim()),
        amount: input.amount,
        takeValue: tradeInput.takeValue,
        invalidMessage: "Datos de canje invalidos o diferencia negativa",
      });
    }
    const productId = input.productId?.trim() || null;
    if (productId) await lockInventory(tx, storeId, productId);
    let product = productId ? await tx.inventoryItem.findFirst({ where: { id: productId, storeId, archivedAt: null } }) : null;
    if (productId && !product) throw new OperationError("Inventory item not found", 404);
    if (product && !canRegisterOutgoingSale(product, input)) throw new OperationError("El equipo no está disponible para registrar una venta", 409);
    if (product?.status === "VENDIDO" && !product.pendingSaleRegistration) throw new OperationError("El equipo vendido no tiene registro pendiente", 409);
    if (product && await tx.sale.findFirst({ where: { storeId, inventoryItemId: product.id, status: { not: "CANCELADA" } } })) throw new OperationError("Este equipo ya tiene una venta activa", 409);
    if (!product && input.unlistedEquipment) {
      product = await createUnlistedEquipment(tx, storeId, input.unlistedEquipment, input.amount ?? 0, currency);
    }
    if (!product && !input.deviceLabel?.trim()) throw new OperationError("Indicá el equipo");
    const resolvedClient = await getClient(tx, storeId, input);
    const client = resolvedClient.client;
    const clientCreated = resolvedClient.created;
    if (tradeInput && !client) throw new OperationError("El canje confirmado requiere un cliente", 400);
    const date = parseArDateOr(input.date);
    let trade: TradeIn | null = null;
    let incoming: InventoryItem | null = null;
    if (tradeInput) {
      await assertIncomingImei(tx, storeId, tradeInput.deviceReceivedImei);
      const tradeNumber = await allocateDocumentNumber(tx, storeId, "trade");
      trade = await tx.tradeIn.create({
        data: {
          storeId,
          tradeNumber,
          clientId: client?.id ?? null,
          clientName: client?.name ?? input.clientName?.trim() ?? "",
          categoryId: input.categoryId ?? null,
          dateLabel: formatArDate(date),
          tradeAt: date,
          deviceReceived: tradeInput.deviceReceived.trim(),
          deviceReceivedImei: tradeInput.deviceReceivedImei?.trim() || null,
          takeValue: dec(tradeInput.takeValue),
          currency,
          deviceGiven: product?.model ?? input.deviceLabel?.trim() ?? "",
          differencePaid: dec(input.amount! - tradeInput.takeValue),
        status: tradeInput.status ?? "PENDIENTE",
          confirmationStatus: "CONFIRMED",
          operationSource: source,
          batteryHealth: tradeInput.batteryHealth?.trim() || null,
          grade: strictTradeGrade(tradeInput.grade),
          customFields: toJson(tradeInput.customFields),
          requestKey: input.requestKey ?? null,
        },
      });
      incoming = await receiveDevice(tx, {
          storeId,
          imei: tradeInput.deviceReceivedImei?.trim() || null,
          model: tradeInput.deviceReceived.trim(),
          capacity: "",
          color: "",
          condition: "USADO",
          grade: strictTradeGrade(tradeInput.grade) || "",
          batteryHealth: tradeInput.batteryHealth?.trim() || "",
          cost: dec(tradeInput.takeValue),
          price: dec(0),
          currency,
          status: "EN_REVISION",
          customFields: {},
      });
      trade = await tx.tradeIn.update({
        where: { id: trade.id },
        data: { receivedInventoryItemId: incoming.id },
      });
    }
    if (product) {
      await tx.inventoryItem.update({
        where: { id: product.id },
        data: {
          status: "VENDIDO",
          pendingSaleRegistration: false,
          previousSaleStatus: null,
          ...salePricePatch(product.price, input.amount!, currency),
        },
      });
    }
    await assertSeller(tx, storeId, input.sellerMemberId);
    const exchangeRate = await saleExchangeRate(input.exchangeRate);
    const saleNumber = await allocateDocumentNumber(tx, storeId, "sale");
    const warrantyDays = await warrantyForSale(tx, storeId, input.warrantyDays, product?.condition ?? input.unlistedEquipment?.condition);
    let sale = await tx.sale.create({
      data: {
        storeId,
        saleNumber,
        sellerMemberId: input.sellerMemberId ?? null,
        registeredByUserId: actor?.userId ?? null,
        exchangeRate,
        clientId: client?.id ?? null,
        clientName: client?.name ?? input.clientName?.trim() ?? "",
        categoryId: trade ? input.saleCategoryId ?? null : input.saleCategoryId ?? input.categoryId ?? null,
        inventoryItemId: product?.id ?? null,
        deviceLabel: product ? fullDeviceLabel(product) : input.deviceLabel?.trim() ?? null,
        dateLabel: formatArDate(date),
        soldAt: date,
        amount: dec(input.amount!),
        amountCurrency: currency,
        paymentMethod: input.paymentMethod?.trim() || "EFECTIVO",
        status: input.status ?? "COMPLETADA",
        customFields: toJson(input.customFields),
        tradeInId: trade?.id ?? null,
        requestKey: input.requestKey ?? null,
        integratedOperation: true,
        previousInventoryStatus: product?.status === "RESERVADO" ? "DISPONIBLE" : product?.previousSaleStatus ?? product?.status ?? null,
        previousPendingSaleRegistration:
          product?.status === "VENDIDO" && product?.pendingSaleRegistration
            ? false
            : product?.pendingSaleRegistration ?? false,
        warrantyDays,
      },
    });
    await recordSaleCommission(tx, storeId, sale.id);
    if (actor) {
      const code = `V-${String(sale.saleNumber).padStart(4, "0")}`;
      await writeAudit(tx, {
        storeId,
        actor,
        action: "sale.created",
        entityType: "sale",
        entityId: sale.id,
        entityLabel: [code, sale.deviceLabel].filter(Boolean).join(" · ").slice(0, 160),
        detail: sale.deviceLabel || sale.clientName || null,
      });
      if (trade) {
        await writeAudit(tx, {
          storeId,
          actor,
          action: "trade.created",
          entityType: "trade",
          entityId: trade.id,
          entityLabel: (trade.deviceReceived || "Canje").slice(0, 160),
          detail: trade.deviceReceived,
        });
      }
    }
    const dueAmount = trade ? input.amount! - tradeInput!.takeValue : input.amount!;
    const depositAmount = await applyDeposits(tx, { storeId, clientId: client?.id ?? null, ids: input.depositIds, currency: labelCurrency, rate: exchangeRate, maximum: dueAmount, productId: product?.id, saleId: sale.id, actor });
    await stampDepositClientCurrency(tx, storeId, client, labelCurrency, depositAmount);
    if (depositAmount.gt(0)) sale = await tx.sale.update({ where: { id: sale.id }, data: { depositAppliedAmount: depositAmount } });
    if ((input.creditNoteIds?.length ?? 0) > 0 && (input.tenders?.length || input.installments)) throw new OperationError("Aplicá la nota de crédito en un cobro simple, sin cuotas ni varios medios.");
    const creditCovered = await coverSaleWithCredits(tx, { storeId, clientId: client?.id ?? null, saleId: sale.id, noteIds: input.creditNoteIds ?? [], due: dueAmount - Number(depositAmount), currency: labelCurrency, rate: exchangeRate == null ? null : Number(exchangeRate), actor });
    const cashDue = Math.max(0, dueAmount - Number(depositAmount) - creditCovered);
    const settlement = await settleNewSale(tx, { storeId, saleId: sale.id, clientId: client?.id ?? null, due: cashDue, currency: labelCurrency, exchangeRate: exchangeRate == null ? null : Number(exchangeRate), input, actor });
    if (settlement) sale = await tx.sale.update({ where: { id: sale.id }, data: { status: settlement.status, openBalance: dec(settlement.unpaid), paymentMethod: settlement.method } });
    const paymentStatus = settlement?.status ?? input.status ?? "COMPLETADA";
    if (!settlement && paymentStatus === 'COMPLETADA') await recordCash(tx, { storeId, amount: cashDue, currency: labelCurrency, method: sale.paymentMethod, sourceType: 'sale', sourceId: sale.id, note: 'Cobro de venta', actor });
    const debt = settlement ? settlement.unpaid : cashDue;
    if (!settlement && client && paymentStatus === "COMPLETADA") {
      await recordSaleCollection(tx, { storeId, clientId: client.id, saleId: sale.id, amount: cashDue, currency: labelCurrency, method: sale.paymentMethod });
    }
    const updatedClient = client ? await applyClientOperation(tx, storeId, client.id, input.amount!, paymentStatus, date, 1, debt) : null;
    const outputState = product ? await tx.inventoryItem.findFirst({ where: { id: product.id, storeId } }) : null;
    if (product && !outputState) throw new OperationError("Inventory item not found", 404);
    const saleLabel = sale.deviceLabel ?? "";
    const notifications = await notify(tx, storeId, sectionRecords(
      ["sales", ...(product || incoming ? ["inventory"] : []), ...(trade ? ["tradeins"] : []), ...(client ? ["clients"] : [])],
      {
        action: trade ? "confirmed" : "created",
        deviceLabel: saleLabel,
        clientName: updatedClient?.name ?? client?.name ?? "",
        clientCreated,
        amount: toNum(sale.amount),
        pendingBalance: updatedClient ? toNum(updatedClient.pendingBalance) : null,
        takeValue: trade ? toNum(trade.takeValue) : null,
        difference: trade ? toNum(trade.differencePaid) : null,
        receivedDevice: incoming?.model ?? null,
        soldDevice: product ? saleLabel : null,
        currency: labelCurrency,
      },
      { sales: sale.id, inventory: incoming?.id ?? product?.id ?? sale.id, tradeins: trade?.id ?? sale.id, clients: client?.id ?? sale.id },
      { targets: { inventory: noticeTargets([
        { recordId: product?.id, reason: "Vendido" },
        { recordId: incoming?.id, reason: "Nuevo · entró por canje" },
      ]) } },
    ));
    return { sale: serializeSale(sale), ...(trade ? { tradeIn: serializeTrade({ ...trade, saleId: sale.id }) } : {}), inventory: [outputState, incoming].filter(present).map(serializeProduct), clients: updatedClient ? [serializeClient(updatedClient)] : [], notifications, summary: operationSummary({ trade: !!trade, amount: input.amount!, takeValue: tradeInput?.takeValue, depositApplied: Number(depositAmount), status: paymentStatus, hasInventory: !!product, received: !!incoming, receivedStatus: trade?.status, currency: labelCurrency, unpaid: settlement ? settlement.unpaid : undefined }) };
  });
  if ('sale' in result && result.sale) void trackFirstSale(storeId, result.sale.id, 'form', actor?.userId);
  return result;
}

export async function confirmTradeOperation(storeId: string, tradeId: string, input: OperationInput, actor?: Actor) {
  const result = await withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const trade = await tx.tradeIn.findFirst({ where: { id: tradeId, storeId } });
    if (!trade) throw new OperationError("Trade-in not found", 404);
    const priorSale = await tx.sale.findFirst({ where: { storeId, tradeInId: trade.id } });
    if (priorSale) return replaySaleResult(tx, storeId, priorSale, "Canje ya confirmado");
    if (trade.confirmationStatus !== "PENDING") throw new OperationError("El canje no esta pendiente", 409);
    const currency = currencyOnWrite(input.currency, true, await storeCurrency(storeId, tx));
    const labelCurrency = await copyCurrency(tx, storeId, currency);
    const saleCategoryId = input.saleCategoryId !== undefined ? input.saleCategoryId : trade.draftSaleCategoryId;
    await assertCategory(tx, storeId, "sales", saleCategoryId);
    if (input.categoryId !== undefined) await assertCategory(tx, storeId, "tradeins", input.categoryId);

    const productId = input.productId !== undefined ? input.productId : trade.draftProductId;
    const deviceLabel = input.deviceLabel !== undefined ? input.deviceLabel : trade.draftDeviceLabel;
    const outgoingAmount = input.amount ?? (trade.draftAmount ? toNum(trade.draftAmount) : undefined);
    const receivedDevice = input.tradeIn?.deviceReceived ?? trade.deviceReceived;
    const receivedImei = input.tradeIn?.deviceReceivedImei === undefined
      ? trade.deviceReceivedImei
      : input.tradeIn.deviceReceivedImei?.trim() || null;
    const takeValue = input.tradeIn?.takeValue ?? toNum(trade.takeValue);
    const receivedStatus = input.tradeIn?.status ?? trade.status;
    const receivedBattery = input.tradeIn?.batteryHealth === undefined
      ? trade.batteryHealth
      : input.tradeIn.batteryHealth?.trim() || null;
    const receivedGrade = input.tradeIn?.grade === undefined
      ? coerceTradeGrade(trade.grade)
      : strictTradeGrade(input.tradeIn.grade);
    const receivedCustomFields = input.tradeIn?.customFields === undefined
      ? trade.customFields
      : input.tradeIn.customFields;

    if (!productId && !deviceLabel && !input.unlistedEquipment?.model?.trim()) throw new OperationError("Indica el equipo de salida");
    if (productId) await lockInventory(tx, storeId, productId);
    let product = productId
      ? await tx.inventoryItem.findFirst({ where: { id: productId, storeId, archivedAt: null } })
      : null;
    if (productId && !product) throw new OperationError("Inventory item not found", 404);
    if (product && !canRegisterOutgoingSale(product, { ...input, clientId: input.clientId ?? trade.clientId })) {
      throw new OperationError("El equipo no esta disponible", 409);
    }
    if (product && await tx.sale.findFirst({ where: { storeId, inventoryItemId: product.id, status: { not: "CANCELADA" } } })) {
      throw new OperationError("Este equipo ya tiene una venta activa", 409);
    }
    const typedClientName = input.clientName !== undefined
      && (input.clientId === undefined || input.clientId === null);
    const resolvedClient = await getClient(tx, storeId, {
      ...input,
      clientId: input.clientId ?? (typedClientName ? null : trade.clientId),
      clientName: input.clientName ?? trade.clientName,
    }, typedClientName ? undefined : trade);
    const client = resolvedClient.client;
    const clientCreated = resolvedClient.created;
    if (!client) throw new OperationError("El canje confirmado requiere un cliente", 400);
    if (!receivedDevice.trim() || takeValue < 0 || outgoingAmount === undefined) throw new OperationError("La diferencia no puede ser negativa");
    assertTradeDifference({
      registered: Boolean(product),
      amount: outgoingAmount,
      takeValue,
      invalidMessage: "La diferencia no puede ser negativa",
    });
    if (!product && input.unlistedEquipment) {
      product = await createUnlistedEquipment(tx, storeId, input.unlistedEquipment, outgoingAmount ?? 0, currency);
    }

    const date = parseArDateOr(input.date ?? trade.dateLabel);
    await assertIncomingImei(tx, storeId, receivedImei);
    const received = await receiveDevice(tx, {
      storeId,
      imei: receivedImei?.trim() || null,
      model: receivedDevice.trim(),
      capacity: "",
      color: "",
      condition: "USADO",
      grade: receivedGrade || "",
      batteryHealth: receivedBattery || "",
      cost: dec(takeValue),
      price: dec(0),
      currency,
      status: "EN_REVISION",
      customFields: toJson(receivedCustomFields),
    });
    const confirmed = await tx.tradeIn.update({ where: { id: trade.id }, data: {
      clientId: client.id,
      clientName: client.name,
      dateLabel: formatArDate(date),
      tradeAt: date,
      categoryId: input.categoryId === undefined ? trade.categoryId : input.categoryId,
      deviceReceived: receivedDevice.trim(),
      deviceReceivedImei: receivedImei,
      takeValue: dec(takeValue),
      currency,
      status: receivedStatus,
      batteryHealth: receivedBattery,
      grade: receivedGrade,
      customFields: toJson(receivedCustomFields),
      deviceGiven: product?.model ?? deviceLabel ?? "",
      differencePaid: dec(outgoingAmount - takeValue),
      confirmationStatus: "CONFIRMED",
      receivedInventoryItemId: received.id,
      previousOutgoingStatus: product?.status === "RESERVADO" ? "DISPONIBLE" : product?.previousSaleStatus ?? product?.status ?? null,
      previousOutgoingPendingRegistration: product?.status === "VENDIDO" && product?.pendingSaleRegistration
        ? false
        : product?.pendingSaleRegistration ?? false,
    } });
    if (product) await tx.inventoryItem.update({ where: { id: product.id }, data: {
      status: "VENDIDO",
      pendingSaleRegistration: false,
      previousSaleStatus: null,
      ...salePricePatch(product.price, outgoingAmount, currency),
    } });
    await assertSeller(tx, storeId, input.sellerMemberId);
    const exchangeRate = await saleExchangeRate(input.exchangeRate);
    const saleNumber = await allocateDocumentNumber(tx, storeId, "sale");
    const warrantyDays = await warrantyForSale(tx, storeId, input.warrantyDays, product?.condition ?? input.unlistedEquipment?.condition);
    let sale = await tx.sale.create({ data: {
      storeId,
      saleNumber,
      sellerMemberId: input.sellerMemberId ?? null,
      registeredByUserId: actor?.userId ?? null,
      exchangeRate,
      clientId: client.id,
      clientName: client.name,
      categoryId: saleCategoryId ?? null,
      inventoryItemId: product?.id ?? null,
      deviceLabel: product ? fullDeviceLabel(product) : deviceLabel,
      dateLabel: formatArDate(date),
      soldAt: date,
      amount: dec(outgoingAmount),
      amountCurrency: currency,
      paymentMethod: input.paymentMethod ?? trade.draftPaymentMethod ?? "EFECTIVO",
      status: input.status ?? trade.draftPaymentStatus ?? "COMPLETADA",
      tradeInId: trade.id,
      customFields: toJson(input.customFields),
      integratedOperation: true,
      previousInventoryStatus: product?.status === "RESERVADO" ? "DISPONIBLE" : product?.previousSaleStatus ?? product?.status ?? null,
      previousPendingSaleRegistration: product?.status === "VENDIDO" && product?.pendingSaleRegistration
        ? false
        : product?.pendingSaleRegistration ?? false,
      warrantyDays,
    } });
    await recordSaleCommission(tx, storeId, sale.id);
    if (actor) {
      const code = `V-${String(sale.saleNumber).padStart(4, "0")}`;
      await writeAudit(tx, {
        storeId,
        actor,
        action: "sale.created",
        entityType: "sale",
        entityId: sale.id,
        entityLabel: [code, sale.deviceLabel].filter(Boolean).join(" · ").slice(0, 160),
        detail: sale.deviceLabel || null,
      });
      await writeAudit(tx, {
        storeId,
        actor,
        action: "trade.confirmed",
        entityType: "trade",
        entityId: trade.id,
        entityLabel: (trade.deviceReceived || "Canje").slice(0, 160),
        detail: trade.deviceReceived,
      });
    }
    const depositAmount = await applyDeposits(tx, { storeId, clientId: client.id, ids: input.depositIds, currency: labelCurrency, rate: exchangeRate, maximum: outgoingAmount - takeValue, productId: product?.id, saleId: sale.id, actor });
    await stampDepositClientCurrency(tx, storeId, client, labelCurrency, depositAmount);
    if (depositAmount.gt(0)) sale = await tx.sale.update({ where: { id: sale.id }, data: { depositAppliedAmount: depositAmount } });
    if ((input.creditNoteIds?.length ?? 0) > 0 && (input.tenders?.length || input.installments)) throw new OperationError("Aplicá la nota de crédito en un cobro simple, sin cuotas ni varios medios.");
    const creditCovered = await coverSaleWithCredits(tx, { storeId, clientId: client.id, saleId: sale.id, noteIds: input.creditNoteIds ?? [], due: outgoingAmount - takeValue - Number(depositAmount), currency: labelCurrency, rate: exchangeRate == null ? null : Number(exchangeRate), actor });
    const cashDue = Math.max(0, outgoingAmount - takeValue - Number(depositAmount) - creditCovered);
    const settlement = await settleNewSale(tx, { storeId, saleId: sale.id, clientId: client.id, due: cashDue, currency: labelCurrency, exchangeRate: exchangeRate == null ? null : Number(exchangeRate), input, actor });
    if (settlement) sale = await tx.sale.update({ where: { id: sale.id }, data: { status: settlement.status, openBalance: dec(settlement.unpaid), paymentMethod: settlement.method } });
    const paymentStatus = settlement?.status ?? input.status ?? trade.draftPaymentStatus ?? "COMPLETADA";
    if (!settlement && paymentStatus === 'COMPLETADA') await recordCash(tx, { storeId, amount: cashDue, currency: labelCurrency, method: sale.paymentMethod, sourceType: 'sale', sourceId: sale.id, note: 'Cobro de canje', actor });
    if (!settlement && paymentStatus === "COMPLETADA") {
      await recordSaleCollection(tx, { storeId, clientId: client.id, saleId: sale.id, amount: cashDue, currency: labelCurrency, method: sale.paymentMethod });
    }
    const updatedClient = await applyClientOperation(tx, storeId, client.id, outgoingAmount, paymentStatus, date, 1, settlement ? settlement.unpaid : cashDue);
    const outputState = product ? await tx.inventoryItem.findFirst({ where: { id: product.id, storeId } }) : null;
    const saleLabel = product ? fullDeviceLabel(product) : deviceLabel ?? "";
    const notifications = await notify(tx, storeId, sectionRecords(["tradeins", "sales", "inventory", "clients"], {
      action: "confirmed",
      deviceLabel: saleLabel,
      clientName: updatedClient?.name ?? client.name,
      clientCreated,
      amount: outgoingAmount,
      pendingBalance: updatedClient ? toNum(updatedClient.pendingBalance) : null,
      takeValue,
      difference: outgoingAmount - takeValue,
      receivedDevice: received.model,
      soldDevice: product ? saleLabel : null,
      currency: labelCurrency,
    }, {
      tradeins: trade.id,
      sales: sale.id,
      inventory: received.id,
      clients: client.id,
    }, { targets: { inventory: noticeTargets([
      { recordId: product?.id, reason: "Vendido" },
      { recordId: received.id, reason: "Nuevo · entró por canje" },
    ]) } }));
    return {
      sale: serializeSale(sale, product),
      tradeIn: serializeTrade({ ...confirmed, saleId: sale.id }),
      inventory: [outputState, received].filter(present).map(serializeProduct),
      clients: updatedClient ? [serializeClient(updatedClient)] : [],
      notifications,
      summary: operationSummary({ trade: true, amount: outgoingAmount, takeValue, depositApplied: Number(depositAmount), status: paymentStatus, hasInventory: !!product, received: true, receivedStatus: confirmed.status, currency: labelCurrency, unpaid: settlement ? settlement.unpaid : undefined }),
    };
  });
  if ('sale' in result && result.sale) void trackFirstSale(storeId, result.sale.id, 'form', actor?.userId);
  return result;
}

export async function updateSaleOperation(storeId: string, saleId: string, input: OperationInput, actor?: Actor) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, storeId } });
    if (!sale) throw new OperationError("Sale not found", 404);
    if (sale.status === "CANCELADA") throw new OperationError("No se puede editar una operación cancelada", 409);
    if (hasSettlement(input)) throw new OperationError("Las cuotas y los pagos mixtos se definen al crear la venta", 409);
    const trade = sale.tradeInId ? await tx.tradeIn.findFirst({ where: { id: sale.tradeInId, storeId } }) : null;
    const hasTrade = input.tradeIn === null ? false : Boolean(trade || input.tradeIn);
    if (hasTrade && input.categoryId !== undefined) await assertCategory(tx, storeId, "tradeins", input.categoryId);
    if (input.saleCategoryId !== undefined) await assertCategory(tx, storeId, "sales", input.saleCategoryId);
    else if (!hasTrade && input.categoryId !== undefined) await assertCategory(tx, storeId, "sales", input.categoryId);
    const nextTradeInput = input.tradeIn;
    const nextTakeValue = hasTrade ? nextTradeInput?.takeValue ?? (trade ? toNum(trade.takeValue) : 0) : 0;
    if (hasTrade && (!Number.isFinite(nextTakeValue) || nextTakeValue < 0 || !(nextTradeInput?.deviceReceived ?? trade?.deviceReceived)?.trim())) {
      throw new OperationError("Completá el equipo recibido y un valor tomado válido", 400);
    }
    if (hasTrade && !trade && nextTradeInput?.takeValue === undefined) throw new OperationError("Completá el valor tomado", 400);
    const nextAmount = input.amount ?? toNum(sale.amount);
    const amountChanges = input.amount !== undefined && moneyChanged(sale.amount, input.amount);
    const takeChanges = Boolean(hasTrade && nextTradeInput?.takeValue !== undefined && (!trade || moneyChanged(trade.takeValue, nextTradeInput.takeValue)));
    const nextCurrency = currencyOnWrite(input.currency, amountChanges || takeChanges, amountChanges || takeChanges ? await storeCurrency(storeId, tx) : "ARS");
    const labelCurrency = await copyCurrency(tx, storeId, nextCurrency ?? sale.amountCurrency ?? trade?.currency);
    if (hasTrade && nextAmount < nextTakeValue) {
      assertTradeDifference({
        registered: Boolean(input.productId === undefined ? sale.inventoryItemId : input.productId?.trim()),
        amount: nextAmount,
        takeValue: nextTakeValue,
        invalidMessage: "La diferencia no puede ser negativa",
      });
    }
    const nextDate = input.date ? parseArDateOr(input.date) : sale.soldAt;
    let nextProductId = input.productId === undefined ? sale.inventoryItemId : input.productId?.trim() || null;
    const nextDeviceLabel = input.deviceLabel === undefined ? sale.deviceLabel : input.deviceLabel?.trim() || null;
    if (nextProductId && nextProductId !== sale.inventoryItemId) await lockInventory(tx, storeId, nextProductId);
    let nextProduct = nextProductId ? await tx.inventoryItem.findFirst({ where: { id: nextProductId, storeId, archivedAt: null } }) : null;
    if (!nextProduct && input.unlistedEquipment) {
      nextProduct = await createUnlistedEquipment(tx, storeId, input.unlistedEquipment, nextAmount, nextCurrency);
      nextProductId = nextProduct.id;
    }
    if (!nextProductId && !nextDeviceLabel) throw new OperationError("Indicá el equipo");
    if (nextProductId && !nextProduct) throw new OperationError("Inventory item not found", 404);
    if (nextProduct && nextProductId !== sale.inventoryItemId) {
      if (!canRegisterOutgoingSale(nextProduct)) throw new OperationError("El equipo no está disponible", 409);
      if (await tx.sale.findFirst({ where: { storeId, inventoryItemId: nextProduct.id, id: { not: sale.id }, status: { not: "CANCELADA" } } })) throw new OperationError("Este equipo ya tiene una venta activa", 409);
    }
    const typedClientName = input.clientName !== undefined
      && (input.clientId === null || (input.clientId === undefined && input.clientName?.trim() !== sale.clientName));
    const resolvedNextClient = await getClient(tx, storeId, { ...input, clientId: input.clientId === undefined ? (input.clientName === undefined ? sale.clientId : null) : input.clientId, clientName: input.clientName === undefined ? sale.clientName : input.clientName }, typedClientName ? undefined : sale);
    const nextClient = resolvedNextClient.client;
    const clientCreated = resolvedNextClient.created;
    const nextClientId = nextClient?.id ?? null;
    let nextStatus = input.status ?? sale.status;
    if (input.depositIds?.length) throw new OperationError("Las señas se aplican al crear una venta", 409);
    if (Number(sale.depositAppliedAmount) > 0 && (nextClientId !== sale.clientId || nextProductId !== sale.inventoryItemId || amountChanges || nextCurrency && nextCurrency !== sale.amountCurrency || hasTrade !== Boolean(trade) || moneyChanged(trade?.takeValue ?? 0, nextTakeValue))) throw new OperationError("Esta venta tiene señas aplicadas. Para cambiar cliente, equipo o importes, cancelala y registrá una nueva", 409);
    if (hasTrade && !nextClient) throw new OperationError("El canje confirmado requiere un cliente", 400);
    const nextDebt = Math.max(0, nextAmount - nextTakeValue - Number(sale.depositAppliedAmount));
    const priorDue = (trade ? toNum(trade.differencePaid) : toNum(sale.amount)) - Number(sale.depositAppliedAmount);
    const rise = priceRiseDebt({ priorAmount: toNum(sale.amount), nextAmount, priorDue, nextDue: nextDebt, priorStatus: sale.status, hasClient: Boolean(nextClient) });
    if (rise.error) throw new OperationError(rise.error, 409);
    let archivedIncoming: InventoryItem | null = null;
    let removedTrade: TradeIn | null = null;
    if (trade && !hasTrade) {
      const received = trade.receivedInventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId } }) : null;
      if (received && (received.status === "VENDIDO" || received.pendingSaleRegistration || await tx.sale.findFirst({ where: { storeId, inventoryItemId: received.id, status: { not: "CANCELADA" } } }))) {
        throw new OperationError("No se puede quitar el canje: el equipo recibido ya está en uso", 409);
      }
      if (received) archivedIncoming = await tx.inventoryItem.update({ where: { id: received.id }, data: { archivedAt: new Date() } });
      removedTrade = await tx.tradeIn.update({ where: { id: trade.id }, data: { confirmationStatus: "CANCELLED", status: "CANCELADO", removedFromSaleNumber: sale.saleNumber } });
    }
    if (sale.inventoryItemId && sale.inventoryItemId !== nextProductId) {
      await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: sale.previousInventoryStatus ?? "DISPONIBLE", pendingSaleRegistration: sale.previousPendingSaleRegistration ?? false } });
    }
    if (nextProduct && nextProduct.id !== sale.inventoryItemId) {
      await tx.inventoryItem.update({ where: { id: nextProduct.id }, data: { status: "VENDIDO", pendingSaleRegistration: false, previousSaleStatus: null, ...salePricePatch(nextProduct.price, nextAmount, nextCurrency) } });
    } else if (nextProduct && nextProduct.price.toNumber() <= 0 && nextAmount > 0) {
      await tx.inventoryItem.update({ where: { id: nextProduct.id }, data: { price: dec(nextAmount), ...(nextCurrency ? { currency: nextCurrency } : {}) } });
    }
    await assertSeller(tx, storeId, input.sellerMemberId);
    let updatedSale = await tx.sale.update({
      where: { id: sale.id },
      data: {
        integratedOperation: true,
        ...(input.sellerMemberId !== undefined ? { sellerMemberId: input.sellerMemberId } : {}),
        ...(input.exchangeRate !== undefined ? { exchangeRate: await saleExchangeRate(input.exchangeRate) } : {}),
        ...(hasTrade ? {} : { tradeInId: null }),
        clientId: nextClientId,
        clientName: nextClient?.name ?? input.clientName?.trim() ?? "",
        amount: dec(nextAmount),
        ...(nextCurrency ? { amountCurrency: nextCurrency } : {}),
        status: nextStatus,
        ...(rise.reopen ? { openBalance: dec(rise.extra) } : {}),
        paymentMethod: input.paymentMethod ?? sale.paymentMethod,
        ...(input.warrantyDays !== undefined ? { warrantyDays: input.warrantyDays } : {}),
        dateLabel: formatArDate(nextDate),
        soldAt: nextDate,
        inventoryItemId: nextProductId,
        deviceLabel: nextProduct ? fullDeviceLabel(nextProduct) : nextDeviceLabel,
        categoryId: input.saleCategoryId !== undefined
          ? input.saleCategoryId
          : hasTrade || input.categoryId === undefined
            ? sale.categoryId
            : input.categoryId,
        customFields:
          input.customFields === undefined
            ? sale.customFields ?? {}
            : toJson(input.customFields),
        previousInventoryStatus:
          nextProductId === sale.inventoryItemId
            ? sale.previousInventoryStatus
            : nextProduct?.previousSaleStatus ?? nextProduct?.status ?? null,
        previousPendingSaleRegistration:
          nextProductId === sale.inventoryItemId
            ? sale.previousPendingSaleRegistration
            : nextProduct?.status === "VENDIDO" && nextProduct.pendingSaleRegistration
              ? false
              : nextProduct?.pendingSaleRegistration ?? false,
      },
    });
    let updatedTrade = hasTrade ? trade : null;
    let incoming: InventoryItem | null = null;
    if (trade && hasTrade) {
      updatedTrade = await tx.tradeIn.update({
        where: { id: trade.id },
        data: {
          confirmationStatus: "CONFIRMED",
          clientId: nextClientId,
          clientName: nextClient?.name ?? input.clientName?.trim() ?? "",
          dateLabel: formatArDate(nextDate),
          tradeAt: nextDate,
          categoryId: input.categoryId === undefined ? trade.categoryId : input.categoryId,
          deviceReceived:
            nextTradeInput?.deviceReceived?.trim() ?? trade.deviceReceived,
          deviceReceivedImei:
            nextTradeInput?.deviceReceivedImei === undefined
              ? trade.deviceReceivedImei
              : nextTradeInput.deviceReceivedImei?.trim() || null,
          takeValue: dec(nextTakeValue),
          ...(nextCurrency ? { currency: nextCurrency } : {}),
          differencePaid: dec(nextAmount - nextTakeValue),
          deviceGiven: nextProduct?.model ?? nextDeviceLabel ?? "",
          status: nextTradeInput?.status ?? trade.status,
          batteryHealth:
            nextTradeInput?.batteryHealth === undefined
              ? trade.batteryHealth
              : nextTradeInput.batteryHealth?.trim() || null,
          grade:
            nextTradeInput?.grade === undefined
              ? trade.grade
              : strictTradeGrade(nextTradeInput.grade),
          customFields:
            nextTradeInput?.customFields === undefined
              ? trade.customFields ?? {}
              : toJson(nextTradeInput.customFields),
        },
      });
      if (trade.receivedInventoryItemId) {
        if (updatedTrade.deviceReceivedImei) await assertIncomingImei(tx, storeId, updatedTrade.deviceReceivedImei, trade.receivedInventoryItemId);
        incoming = await tx.inventoryItem.update({ where: { id: trade.receivedInventoryItemId }, data: {
          imei: updatedTrade.deviceReceivedImei, model: updatedTrade.deviceReceived, cost: updatedTrade.takeValue,
          condition: "USADO",
          batteryHealth: updatedTrade.batteryHealth ?? "", grade: coerceTradeGrade(updatedTrade.grade) || "",
        } });
      }
    }
    if (hasTrade && !trade && nextTradeInput) {
      await assertIncomingImei(tx, storeId, nextTradeInput.deviceReceivedImei);
      updatedTrade = await tx.tradeIn.create({ data: {
        storeId,
        tradeNumber: await allocateDocumentNumber(tx, storeId, "trade"),
        clientId: nextClientId,
        clientName: nextClient?.name ?? "",
        categoryId: input.categoryId ?? null,
        dateLabel: formatArDate(nextDate), tradeAt: nextDate,
        deviceReceived: nextTradeInput.deviceReceived.trim(),
        deviceReceivedImei: nextTradeInput.deviceReceivedImei?.trim() || null,
        takeValue: dec(nextTakeValue), currency: nextCurrency ?? sale.amountCurrency,
        differencePaid: dec(nextAmount - nextTakeValue), deviceGiven: nextProduct?.model ?? nextDeviceLabel ?? "",
        status: nextTradeInput.status ?? "PENDIENTE",
        confirmationStatus: "CONFIRMED", operationSource: "sales",
        batteryHealth: nextTradeInput.batteryHealth?.trim() || null,
        grade: strictTradeGrade(nextTradeInput.grade), customFields: toJson(nextTradeInput.customFields),
      } });
      updatedSale = await tx.sale.update({ where: { id: sale.id }, data: { tradeInId: updatedTrade.id } });
    }
    if (updatedTrade && !updatedTrade.receivedInventoryItemId) {
      await assertIncomingImei(tx, storeId, updatedTrade.deviceReceivedImei);
      incoming = await receiveDevice(tx, {
        storeId, imei: updatedTrade.deviceReceivedImei, model: updatedTrade.deviceReceived,
        capacity: "", color: "", condition: "USADO", status: "EN_REVISION",
        grade: updatedTrade.grade ?? "", batteryHealth: updatedTrade.batteryHealth ?? "",
        cost: updatedTrade.takeValue, price: dec(0), currency: updatedTrade.currency, customFields: {},
      });
      updatedTrade = await tx.tradeIn.update({ where: { id: updatedTrade.id }, data: { receivedInventoryItemId: incoming.id } });
    }
    await refreshSaleCommission(tx, storeId, sale.id);
    if (actor && input.sellerMemberId !== undefined && input.sellerMemberId !== sale.sellerMemberId) await writeAudit(tx, { storeId, actor, action: "sale.seller.changed", entityType: "sale", entityId: sale.id, entityLabel: saleCode(sale.saleNumber) });
    if (sale.status === 'PENDIENTE' && nextStatus === 'COMPLETADA') await recordCash(tx, { storeId, amount: Number(sale.openBalance ?? priorDue), currency: labelCurrency, method: updatedSale.paymentMethod, sourceType: 'sale', sourceId: sale.id, note: 'Saldo de venta cobrado', actor });
    const balanceStatus = rise.reopen ? "COMPLETADA" : nextStatus;
    const balanceDebt = rise.reopen ? priorDue : nextDebt;
    let updatedClients = (await applyClientDelta(tx, storeId, sale.clientId, nextClientId, toNum(sale.amount), nextAmount, sale.status, balanceStatus, priorDue, balanceDebt, nextDate)).filter(present);
    if (rise.reopen && nextClientId) {
      const raised = await recordPriceRise(tx, { storeId, clientId: nextClientId, saleId: sale.id, amount: rise.extra, currency: labelCurrency, actor });
      updatedClients = updatedClients.map((client) => client?.id === raised.id ? raised : client);
      if (!updatedClients.some((client) => client?.id === raised.id)) updatedClients.push(raised);
    }
    const output = nextProductId ? await tx.inventoryItem.findFirst({ where: { id: nextProductId, storeId } }) : null;
    const released = sale.inventoryItemId && sale.inventoryItemId !== nextProductId ? await tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null;
    const sections = ["sales", ...(output || released || incoming || archivedIncoming ? ["inventory"] : []), ...(updatedTrade || removedTrade ? ["tradeins"] : []), ...(updatedClients.length ? ["clients"] : [])];
    const primaryClient = updatedClients.find((item) => item.id === nextClientId) ?? updatedClients[0] ?? null;
    const saleLabel = updatedSale.deviceLabel ?? "";
    const notifications = await notify(tx, storeId, sectionRecords(sections, {
      action: "updated",
      deviceLabel: saleLabel,
      clientName: primaryClient?.name ?? nextClient?.name ?? "",
      clientCreated,
      amount: nextAmount,
      pendingBalance: primaryClient ? toNum(primaryClient.pendingBalance) : null,
      takeValue: hasTrade ? nextTakeValue : null,
      difference: hasTrade ? nextDebt : null,
      receivedDevice: incoming?.model ?? null,
      archivedDevice: archivedIncoming?.model ?? null,
      soldDevice: output?.status === "VENDIDO" ? fullDeviceLabel(output) : null,
      releasedDevice: released ? fullDeviceLabel(released) : null,
      currency: labelCurrency,
    }, { sales: sale.id, inventory: archivedIncoming && removedTrade ? removedTrade.id : incoming?.id ?? output?.id ?? released?.id ?? sale.id, tradeins: updatedTrade?.id ?? removedTrade?.id ?? sale.id, clients: nextClientId ?? sale.id }, {
      archiveReceived: Boolean(archivedIncoming),
      targets: { inventory: noticeTargets([
        { recordId: output?.status === "VENDIDO" ? output.id : null, reason: "Vendido" },
        { recordId: released?.id, reason: "Volvió al stock" },
        { recordId: incoming?.id, reason: "Nuevo · entró por canje" },
        { recordId: archivedIncoming ? removedTrade?.id : null, reason: "Archivado" },
      ]) },
    }));
    return { sale: serializeSale(updatedSale), ...(updatedTrade ? { tradeIn: serializeTrade({ ...updatedTrade, saleId: sale.id }) } : removedTrade ? { tradeIn: serializeTrade(removedTrade) } : {}), inventory: [output, released, incoming, archivedIncoming].filter(present).map(serializeProduct), clients: updatedClients.map(serializeClient), notifications, summary: `${operationSummary({ trade: hasTrade, amount: nextAmount, takeValue: hasTrade ? nextTakeValue : undefined, depositApplied: Number(sale.depositAppliedAmount), status: nextStatus, hasInventory: !!nextProduct, received: hasTrade, receivedStatus: updatedTrade?.status, currency: labelCurrency, unpaid: rise.reopen ? rise.extra : undefined })} · operación actualizada` };
  });
}

export async function updateTradeOperation(storeId: string, tradeId: string, input: OperationInput) {
  const draftSnapshot = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId }, select: { confirmationStatus: true } });
  if (!draftSnapshot) throw new OperationError("Trade-in not found", 404);
  if (draftSnapshot.confirmationStatus === "PENDING") {
    return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
      const trade = await tx.tradeIn.findFirst({ where: { id: tradeId, storeId } });
      if (!trade) throw new OperationError("Trade-in not found", 404);
      if (trade.confirmationStatus !== "PENDING") throw new OperationError("El canje cambio mientras se editaba", 409);
      await assertCategory(tx, storeId, "tradeins", input.categoryId);
      if (input.saleCategoryId !== undefined) await assertCategory(tx, storeId, "sales", input.saleCategoryId);
      const typedNameChanged = typeof input.clientName === "string"
        && (input.clientId === null || (input.clientId === undefined && input.clientName.trim() !== trade.clientName));
      const clientId = input.clientId === undefined
        ? typedNameChanged ? null : trade.clientId
        : input.clientId;
      const client = clientId ? await tx.client.findFirst({ where: { id: clientId, storeId }, select: { id: true, name: true } }) : null;
      if (clientId && !client) throw new OperationError("Client not found", 404);
      const nextTakeValue = input.tradeIn?.takeValue ?? toNum(trade.takeValue);
      const nextDraftAmount = input.amount ?? (trade.draftAmount ? toNum(trade.draftAmount) : undefined);
      if (nextDraftAmount !== undefined && nextDraftAmount < nextTakeValue) {
        assertTradeDifference({
          registered: Boolean(input.productId === undefined ? trade.draftProductId : input.productId),
          amount: nextDraftAmount,
          takeValue: nextTakeValue,
          invalidMessage: "La diferencia no puede ser negativa",
        });
      }
      if (input.productId) {
        const product = await tx.inventoryItem.findFirst({ where: { id: input.productId, storeId, archivedAt: null } });
        if (!product) throw new OperationError("Inventory item not found", 404);
        if (!canRegisterOutgoingSale(product, input)) throw new OperationError("El equipo no esta disponible para registrar una venta", 409);
      }
      const updated = await tx.tradeIn.update({ where: { id: tradeId }, data: {
        clientId, clientName: client ? client.name : input.clientName === undefined ? trade.clientName : input.clientName?.trim() ?? "",
        deviceReceived: input.tradeIn?.deviceReceived ?? trade.deviceReceived,
        deviceReceivedImei: input.tradeIn?.deviceReceivedImei === undefined ? trade.deviceReceivedImei : input.tradeIn.deviceReceivedImei?.trim() || null,
        takeValue: input.tradeIn?.takeValue === undefined ? trade.takeValue : dec(input.tradeIn.takeValue),
        status: input.tradeIn?.status ?? trade.status, batteryHealth: input.tradeIn?.batteryHealth === undefined ? trade.batteryHealth : input.tradeIn.batteryHealth,
        grade: input.tradeIn?.grade === undefined ? trade.grade : strictTradeGrade(input.tradeIn.grade),
        draftProductId: input.productId === undefined ? trade.draftProductId : input.productId,
        draftDeviceLabel: input.deviceLabel === undefined ? trade.draftDeviceLabel : input.deviceLabel,
        draftAmount: input.amount === undefined ? trade.draftAmount : dec(input.amount),
        draftPaymentMethod: input.paymentMethod ?? trade.draftPaymentMethod, draftPaymentStatus: input.status ?? trade.draftPaymentStatus,
        categoryId: input.categoryId === undefined ? trade.categoryId : input.categoryId,
        draftSaleCategoryId: input.saleCategoryId === undefined ? trade.draftSaleCategoryId : input.saleCategoryId,
        dateLabel: input.date ? formatArDate(parseArDateOr(input.date)) : trade.dateLabel, tradeAt: input.date ? parseArDateOr(input.date) : trade.tradeAt,
      } });
      const labelCurrency = await copyCurrency(tx, storeId, trade.currency);
      const notifications = await notify(tx, storeId, sectionRecords(["tradeins"], {
        action: "draft-updated",
        receivedDevice: updated.deviceReceived,
        takeValue: toNum(updated.takeValue),
        difference: updated.draftAmount == null ? null : toNum(updated.draftAmount) - toNum(updated.takeValue),
        currency: labelCurrency,
      }, { tradeins: trade.id }));
      return { tradeIn: serializeTrade(updated), inventory: [], clients: [], notifications, summary: "Borrador de canje actualizado" };
    });
  }
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId } });
  if (!trade) throw new OperationError("Trade-in not found", 404);
  if (trade.confirmationStatus !== "CONFIRMED") throw new OperationError("No se puede editar un canje cancelado", 409);
  const sale = await prisma.sale.findFirst({ where: { tradeInId: trade.id, storeId } });
  if (!sale) throw new OperationError("El canje no tiene venta vinculada", 409);
  return updateSaleOperation(storeId, sale.id, input);
}

export async function updateTradeFromSale(storeId: string, tradeId: string, input: OperationInput) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId }, select: { confirmationStatus: true, operationSource: true } });
  if (!trade) throw new OperationError("Trade-in not found", 404);
  const sale = await prisma.sale.findFirst({ where: { storeId, tradeInId: tradeId }, select: { id: true } });
  if (!sale && !(trade.confirmationStatus === "PENDING" && trade.operationSource === "sales")) {
    throw new OperationError("This trade-in is not linked to a sales operation", 403);
  }
  return updateTradeOperation(storeId, tradeId, input);
}

export async function updateTradeFromLegacy(storeId: string, tradeId: string, patch: {
  date?: string | null; clientId?: string | null; clientName?: string | null; categoryId?: string | null;
  deviceReceived?: string; deviceReceivedImei?: string | null; takeValue?: number; deviceGiven?: string;
  differencePaid?: number; status?: string; batteryHealth?: string | null; grade?: string | null;
  customFields?: Record<string, unknown> | null;
}) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId } });
  if (!trade) throw new OperationError("Trade-in not found", 404);
  const sale = await prisma.sale.findFirst({ where: { storeId, tradeInId: trade.id } });
  const takeValue = patch.takeValue ?? toNum(trade.takeValue);
  const amount = patch.differencePaid !== undefined ? takeValue + patch.differencePaid : sale?.amount.toNumber() ?? trade.draftAmount?.toNumber();
  return updateTradeOperation(storeId, tradeId, {
    date: patch.date ?? undefined, clientId: patch.clientId, clientName: patch.clientName ?? undefined,
    categoryId: patch.categoryId, deviceLabel: patch.deviceGiven, amount,
    paymentMethod: sale?.paymentMethod ?? trade.draftPaymentMethod ?? undefined,
    status: sale?.status ?? trade.draftPaymentStatus ?? undefined,
    tradeIn: {
      deviceReceived: patch.deviceReceived ?? trade.deviceReceived,
      deviceReceivedImei: patch.deviceReceivedImei === undefined ? trade.deviceReceivedImei : patch.deviceReceivedImei,
      takeValue,
      status: patch.status ?? trade.status,
      batteryHealth: patch.batteryHealth === undefined ? trade.batteryHealth : patch.batteryHealth,
      grade: patch.grade === undefined ? trade.grade : patch.grade,
      customFields: patch.customFields ?? undefined,
    },
  });
}

function documentCode(prefix: "V" | "C", number: number) {
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

async function recordSaleCollection(
  tx: Prisma.TransactionClient,
  args: { storeId: string; clientId: string; saleId: string; amount: number; currency: string; method: string },
) {
  if (!(args.amount > 0)) return;
  await tx.clientPayment.create({
    data: {
      storeId: args.storeId,
      clientId: args.clientId,
      saleId: args.saleId,
      amount: dec(args.amount),
      currency: args.currency,
      method: args.method.trim() || "EFECTIVO",
      kind: "PAGO",
      note: "Cobro de venta",
    },
  });
}

function operationCash(amount: number, deposit: number) {
  return Math.max(0, amount - deposit);
}

async function planSaleCancellation(tx: Prisma.TransactionClient, storeId: string, sale: Sale, cash: number) {
  if (!sale.clientId) return { refund: 0, debtToRemove: 0, credit: 0 };
  const [rows, siblings] = await Promise.all([
    tx.clientPayment.findMany({
      where: { storeId, clientId: sale.clientId },
      select: { saleId: true, repairOrderId: true, kind: true, amount: true },
    }),
    tx.sale.findMany({
      where: {
        storeId,
        clientId: sale.clientId,
        voidedAt: null,
        OR: [{ id: sale.id }, { status: "PENDIENTE" }, { status: "COMPLETADA", openBalance: { gt: 0 } }],
      },
      select: {
        id: true,
        status: true,
        amount: true,
        openBalance: true,
        depositAppliedAmount: true,
        soldAt: true,
        tradeIn: { select: { differencePaid: true } },
      },
    }),
  ]);
  const targets: RefundTarget[] = siblings.map((row) => ({
    id: row.id,
    cash: operationCash(row.tradeIn ? toNum(row.tradeIn.differencePaid) : toNum(row.amount), Number(row.depositAppliedAmount)),
    status: row.status,
    openBalance: row.openBalance == null ? null : toNum(row.openBalance),
    soldAt: row.soldAt.toISOString(),
  }));
  const target = targets.find((row) => row.id === sale.id) ?? {
    id: sale.id,
    cash,
    status: sale.status,
    openBalance: sale.openBalance == null ? null : toNum(sale.openBalance),
    soldAt: sale.soldAt.toISOString(),
  };
  target.cash = cash;
  const client = await tx.client.findFirst({ where: { id: sale.clientId, storeId }, select: { pendingBalance: true } });
  const plan = cancellationSettlement(target, targets, rows.map((row) => ({
    saleId: row.saleId,
    repairOrderId: row.repairOrderId,
    kind: row.kind,
    amount: toNum(row.amount),
  })), client ? toNum(client.pendingBalance) : 0);
  return { refund: plan.refund.toNumber(), debtToRemove: plan.debtToRemove.toNumber(), credit: plan.credit.toNumber() };
}

async function recordCancellationRefund(
  tx: Prisma.TransactionClient,
  storeId: string,
  clientId: string | null,
  input: { refund: number; method: string; label: string; currency?: string; saleId?: string },
) {
  if (!clientId || !(input.refund > 0)) return 0;
  const client = await tx.client.findFirst({ where: { id: clientId, storeId }, select: { id: true } });
  if (!client) return 0;
  await tx.clientPayment.create({
    data: {
      storeId,
      clientId,
      saleId: input.saleId ?? null,
      amount: dec(input.refund),
      currency: input.currency ?? await storeCurrency(storeId, tx),
      method: input.method.trim() || "EFECTIVO",
      kind: "DEVOLUCION",
      note: `Devolución por cancelación de ${input.label}`.slice(0, 200),
      paidAt: new Date(),
    },
  });
  return input.refund;
}

async function recordCancellationCredit(
  tx: Prisma.TransactionClient,
  storeId: string,
  clientId: string | null,
  input: { credit: number; label: string; currency?: string; saleId: string; exchangeRate?: number | null },
) {
  if (!clientId || !(input.credit > 0)) return 0;
  const client = await tx.client.findFirst({ where: { id: clientId, storeId }, select: { id: true } });
  if (!client) return 0;
  const currency = input.currency === "USD" ? "USD" : "ARS";
  const store = currency === "ARS" ? await tx.store.findUnique({ where: { id: storeId }, select: { manualSell: true } }) : null;
  const quoted = input.exchangeRate && input.exchangeRate > 0 ? input.exchangeRate : store?.manualSell ? Number(store.manualSell) : 0;
  const rate = currency === "USD" ? 1 : quoted > 0 ? quoted : 1;
  const usd = currency === "USD" ? input.credit : input.credit / rate;
  if (!(usd > 0)) return 0;
  const note = `Saldo a favor por cancelación de ${input.label}`.slice(0, 200);
  await tx.clientDeposit.create({
    data: {
      storeId,
      clientId,
      requestKey: `cancel-credit-${input.saleId}`,
      amount: dec(input.credit),
      currency,
      exchangeRate: dec(rate),
      usdAmount: dec(usd),
      method: "SALDO",
      status: "CREDIT",
    },
  });
  await tx.clientPayment.create({
    data: {
      storeId,
      clientId,
      saleId: input.saleId,
      amount: dec(input.credit),
      currency,
      method: "SALDO",
      kind: "CREDITO",
      note,
      paidAt: new Date(),
    },
  });
  return input.credit;
}

function refundSummary(refund: number, currency?: string | null) {
  return refund > 0 ? ` · devolución ${formatArMoney(refund, currency)}` : "";
}

function creditSummary(credit: number, currency?: string | null) {
  return credit > 0 ? ` · saldo a favor ${formatArMoney(credit, currency)}` : "";
}

export async function cancelSaleOperation(storeId: string, saleId: string, actor?: Actor | null) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, storeId } });
    if (!sale) throw new OperationError("Sale not found", 404);
    if (!sale.integratedOperation) throw new OperationError("Esta venta no pertenece a una operación integrada", 409);
    if (sale.tradeInId) throw new OperationError("Esta venta pertenece a un canje; cancelá el canje asociado", 409);
    if (sale.status === "CANCELADA") return { sale: serializeSale(sale), inventory: [], clients: [], notifications: [], summary: "Venta ya cancelada" };
    const labelCurrency = await copyCurrency(tx, storeId, sale.amountCurrency);
    await reverseCashSource(tx, storeId, 'sale', sale.id, actor);
    const plan = await planSaleCancellation(tx, storeId, sale, operationCash(toNum(sale.amount), Number(sale.depositAppliedAmount)));
    const refund = await recordCancellationRefund(tx, storeId, sale.clientId, {
      refund: plan.refund,
      currency: labelCurrency,
      method: sale.paymentMethod,
      label: documentCode("V", sale.saleNumber),
      saleId: sale.id,
    });
    const credit = await recordCancellationCredit(tx, storeId, sale.clientId, {
      credit: plan.credit,
      currency: labelCurrency,
      label: documentCode("V", sale.saleNumber),
      saleId: sale.id,
      exchangeRate: sale.exchangeRate == null ? null : toNum(sale.exchangeRate),
    });
    if (sale.inventoryItemId && sale.integratedOperation) await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: sale.previousInventoryStatus ?? "DISPONIBLE", pendingSaleRegistration: sale.previousPendingSaleRegistration ?? false } });
    else if (sale.inventoryItemId) await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: "DISPONIBLE" } });
    await restoreSaleDeposits(tx, storeId, sale.id, actor);
    await voidSaleCommission(tx, storeId, sale.id, "CANCELLED");
    const stamp = cancellationStamp(actor);
    const cancelled = await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELADA", ...(sale.openBalance != null ? { openBalance: new Decimal(0) } : {}), ...stamp } });
    const detail = refund > 0 ? `Devolución ${formatArMoney(refund, labelCurrency)}` : credit > 0 ? `Saldo a favor ${formatArMoney(credit, labelCurrency)}` : null;
    if (actor) await writeAudit(tx, { storeId, actor, action: "sale.cancelled", entityType: "sale", entityId: sale.id, detail });
    const adjusted = sale.clientId ? await applyClientOperation(tx, storeId, sale.clientId, toNum(sale.amount), plan.debtToRemove > 0 ? "PENDIENTE" : "COMPLETADA", sale.soldAt, -1, plan.debtToRemove) : null;
    const client = adjusted;
    const product = sale.inventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null;
    const notifications = await notify(tx, storeId, sectionRecords(
      ["sales", ...(product ? ["inventory"] : []), ...(client ? ["clients"] : [])],
      {
        action: "cancelled",
        deviceLabel: sale.deviceLabel,
        clientName: client?.name ?? sale.clientName,
        amount: toNum(sale.amount),
        pendingBalance: client ? toNum(client.pendingBalance) : null,
        refund,
        releasedDevice: product ? fullDeviceLabel(product) : null,
        currency: labelCurrency,
      },
      { sales: sale.id, inventory: product?.id ?? sale.id, clients: client?.id ?? sale.id },
    ));
    return { sale: serializeSale(cancelled), inventory: product ? [serializeProduct(product)] : [], clients: client ? [serializeClient(client)] : [], notifications, summary: `Venta cancelada · stock restaurado${client ? " · saldo revertido" : ""}${refundSummary(refund, labelCurrency)}${creditSummary(credit, labelCurrency)}` };
  });
}

export async function cancelOperationFromSale(storeId: string, saleId: string, actor?: Actor | null) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, storeId }, select: { tradeInId: true } });
  if (!sale) throw new OperationError("Sale not found", 404);
  return sale.tradeInId ? cancelTradeOperation(storeId, sale.tradeInId, actor) : cancelSaleOperation(storeId, saleId, actor);
}

export async function cancelTradeFromSale(storeId: string, tradeId: string, actor?: Actor | null) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId }, select: { confirmationStatus: true, operationSource: true } });
  if (!trade) throw new OperationError("Trade-in not found", 404);
  const sale = await prisma.sale.findFirst({ where: { storeId, tradeInId: tradeId }, select: { id: true } });
  if (!sale && !(trade.confirmationStatus === "PENDING" && trade.operationSource === "sales")) {
    throw new OperationError("This trade-in is not linked to a sales operation", 403);
  }
  return cancelTradeOperation(storeId, tradeId, actor);
}

export async function cancelTradeOperation(storeId: string, tradeId: string, actor?: Actor | null) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const trade = await tx.tradeIn.findFirst({ where: { id: tradeId, storeId } });
    if (!trade) throw new OperationError("Trade-in not found", 404);
    if (trade.confirmationStatus == null) throw new OperationError("Este canje histórico no pertenece a una operación integrada", 409);
    if (trade.confirmationStatus === "CANCELLED") return { tradeIn: serializeTrade(trade), inventory: [], clients: [], notifications: [], summary: "Canje ya cancelado" };
    const sale = await tx.sale.findFirst({ where: { storeId, tradeInId: trade.id } });
    const labelCurrency = await copyCurrency(tx, storeId, trade.currency ?? sale?.amountCurrency);
    const received = trade.receivedInventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId } }) : null;
    if (received && (received.status === "VENDIDO" || received.pendingSaleRegistration || await tx.sale.findFirst({ where: { storeId, inventoryItemId: received.id, status: { not: "CANCELADA" } } }))) throw new OperationError("No se puede cancelar: el equipo recibido ya está en uso", 409);
    if (sale) await reverseCashSource(tx, storeId, 'sale', sale.id, actor);
    const plan = sale ? await planSaleCancellation(tx, storeId, sale, operationCash(toNum(trade.differencePaid), Number(sale.depositAppliedAmount))) : { refund: 0, debtToRemove: 0, credit: 0 };
    const refund = sale
      ? await recordCancellationRefund(tx, storeId, trade.clientId, {
        refund: plan.refund,
        currency: labelCurrency,
        method: sale.paymentMethod,
        label: documentCode("C", trade.tradeNumber),
        saleId: sale.id,
      })
      : 0;
    const credit = sale
      ? await recordCancellationCredit(tx, storeId, trade.clientId, {
        credit: plan.credit,
        currency: labelCurrency,
        label: documentCode("C", trade.tradeNumber),
        saleId: sale.id,
        exchangeRate: sale.exchangeRate == null ? null : toNum(sale.exchangeRate),
      })
      : 0;
    const stamp = cancellationStamp(actor);
    if (sale) await restoreSaleDeposits(tx, storeId, sale.id, actor);
    if (sale) await voidSaleCommission(tx, storeId, sale.id, "CANCELLED");
    if (sale) await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELADA", ...(sale.openBalance != null ? { openBalance: new Decimal(0) } : {}), ...stamp } });
    if (sale?.inventoryItemId) await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: sale.previousInventoryStatus ?? trade.previousOutgoingStatus ?? "DISPONIBLE", pendingSaleRegistration: sale.previousPendingSaleRegistration ?? trade.previousOutgoingPendingRegistration ?? false } });
    if (received) await tx.inventoryItem.update({ where: { id: received.id }, data: { archivedAt: new Date() } });
    const updated = await tx.tradeIn.update({ where: { id: trade.id }, data: { confirmationStatus: "CANCELLED", status: "CANCELADO", ...stamp } });
    const detail = refund > 0 ? `Devolución ${formatArMoney(refund, labelCurrency)}` : credit > 0 ? `Saldo a favor ${formatArMoney(credit, labelCurrency)}` : null;
    if (actor) {
      await writeAudit(tx, { storeId, actor, action: "trade.cancelled", entityType: "trade", entityId: trade.id, detail });
      if (sale) await writeAudit(tx, { storeId, actor, action: "sale.cancelled", entityType: "sale", entityId: sale.id, detail });
    }
    const adjusted = trade.clientId && sale
      ? await applyClientOperation(tx, storeId, trade.clientId, toNum(sale.amount), plan.debtToRemove > 0 ? "PENDIENTE" : "COMPLETADA", sale.soldAt, -1, plan.debtToRemove)
      : null;
    const client = adjusted;
    const [archivedReceived, output] = await Promise.all([
      received ? tx.inventoryItem.findFirst({ where: { id: received.id, storeId } }) : null,
      sale?.inventoryItemId ? tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null,
    ]);
    const openArchivedReceipt = Boolean(received) && (!output || output.needsCompletion);
    const notifications = await notify(tx, storeId, sectionRecords(
      ["tradeins", ...(sale ? ["sales"] : []), ...(received ? ["inventory"] : []), ...(client ? ["clients"] : [])],
      {
        action: "cancelled",
        deviceLabel: sale?.deviceLabel ?? trade.deviceGiven,
        clientName: client?.name ?? trade.clientName,
        amount: sale ? toNum(sale.amount) : null,
        pendingBalance: client ? toNum(client.pendingBalance) : null,
        refund,
        takeValue: toNum(trade.takeValue),
        difference: toNum(trade.differencePaid),
        receivedDevice: trade.deviceReceived,
        archivedDevice: archivedReceived?.model ?? received?.model ?? null,
        releasedDevice: output ? fullDeviceLabel(output) : null,
        currency: labelCurrency,
      },
      { tradeins: trade.id, sales: sale?.id ?? trade.id, inventory: cancelledInventoryRecord(trade.id, output), clients: client?.id ?? trade.id },
      {
        archiveReceived: true,
        ...(openArchivedReceipt ? { targets: { inventory: noticeTargets([
          { recordId: output?.id, reason: "Volvió al stock" },
          { recordId: trade.id, reason: "Archivado" },
        ]) } } : {}),
      },
    ));
    return { ...(sale ? { sale: serializeSale({ ...sale, status: "CANCELADA", ...stamp }, output) } : {}), tradeIn: serializeTrade({ ...updated, saleId: sale?.id }), inventory: [archivedReceived, output].filter(present).map(serializeProduct), clients: client ? [serializeClient(client)] : [], notifications, summary: `Operación cancelada · equipo recibido archivado${output ? " · salida restaurada" : ""}${client ? " · saldo revertido" : ""}${refundSummary(refund, labelCurrency)}${creditSummary(credit, labelCurrency)}` };
  });
}

export async function isIntegratedSale(storeId: string, saleId: string, options: { excludeCancelled?: boolean } = {}) {
  return Boolean(await prisma.sale.findFirst({ where: { id: saleId, storeId, integratedOperation: true, ...(options.excludeCancelled ? { status: { not: "CANCELADA" } } : {}) }, select: { id: true } }));
}
export async function isIntegratedTradeIn(storeId: string, tradeId: string, options: { excludeCancelled?: boolean } = {}) {
  return Boolean(await prisma.tradeIn.findFirst({
    where: {
      id: tradeId,
      storeId,
      confirmationStatus: options.excludeCancelled ? { in: ["PENDING", "CONFIRMED"] } : { not: null },
    },
    select: { id: true },
  }));
}


export async function isTradeAccessibleToSource(storeId: string, tradeId: string, source: OperationSource) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId }, select: { confirmationStatus: true, operationSource: true, receivedInventoryItemId: true } });
  if (!trade || trade.confirmationStatus == null) return false;
  if (source === "tradeins") return true;
  if (source === "sales") {
    const linkedSale = await prisma.sale.findFirst({ where: { storeId, tradeInId: tradeId }, select: { id: true } });
    return Boolean(linkedSale) || (trade.confirmationStatus === "PENDING" && trade.operationSource === source);
  }
  if (source === "inventory") {
    if (trade.confirmationStatus === "PENDING" && trade.operationSource === source) return true;
    if (trade.confirmationStatus !== "CANCELLED" || !trade.receivedInventoryItemId) return false;
    return Boolean(await prisma.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId, archivedAt: { not: null } }, select: { id: true } }));
  }
  return source === "clients" && trade.confirmationStatus === "PENDING" && trade.operationSource === source;
}

export async function isPendingTradeForSource(storeId: string, tradeId: string, source: OperationSource) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId }, select: { confirmationStatus: true, operationSource: true } });
  return trade?.confirmationStatus === "PENDING" && trade.operationSource === source;
}

export async function getSaleOperation(storeId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, storeId } });
  if (!sale) throw new OperationError("Sale not found", 404);
  const trade = sale.tradeInId ? await prisma.tradeIn.findFirst({ where: { id: sale.tradeInId, storeId } }) : null;
  const [output, incoming, client] = await Promise.all([
    sale.inventoryItemId ? prisma.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null,
    trade?.receivedInventoryItemId ? prisma.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId } }) : null,
    sale.clientId ? prisma.client.findFirst({ where: { id: sale.clientId, storeId } }) : null,
  ]);
  return {
    sale: serializeSale(sale, output),
    ...(trade ? { tradeIn: serializeTrade({ ...trade, saleId: sale.id }) } : {}),
    inventory: [output, incoming].filter(present).map(serializeProduct),
    clients: client ? [serializeClient(client)] : [],
    notifications: [],
    summary: "Operacion cargada",
  };
}

export async function getTradeOperation(storeId: string, tradeId: string, source?: OperationSource) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId, confirmationStatus: { not: null } } });
  if (!trade) throw new OperationError("Integrated trade-in not found", 404);
  const sale = await prisma.sale.findFirst({ where: { storeId, tradeInId: trade.id } });
  const [outgoing, incoming, client] = await Promise.all([
    sale?.inventoryItemId ? prisma.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null,
    trade.receivedInventoryItemId ? prisma.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId } }) : null,
    trade.clientId ? prisma.client.findFirst({ where: { id: trade.clientId, storeId } }) : null,
  ]);
  const serializedTrade = serializeTrade({ ...trade, saleId: sale?.id });
  const archiveInventoryView = source === "inventory" && trade.confirmationStatus === "CANCELLED";
  return {
    ...(sale ? { sale: serializeSale(sale, outgoing) } : {}),
    tradeIn: archiveInventoryView ? { ...serializedTrade, clientId: "", clientName: "", deviceReceivedImei: "" } : serializedTrade,
    inventory: [outgoing, incoming].filter(present).map(serializeProduct),
    clients: source === "inventory" || !client ? [] : [serializeClient(client)],
    notifications: [],
    summary: trade.confirmationStatus === "PENDING" ? "Borrador de canje cargado" : "Operacion cargada",
  };
}
