import { Prisma } from "@prisma/client";
import type { Client, InventoryItem, Sale, TradeIn } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { formatArDate, formatStoredDate, parseArDate } from "../../lib/ar-date.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { prisma } from "../../plugins/prisma.js";
import { noticeTargets, operationSummary, sectionRecords } from "./operation-copy.js";

const dec = (value: number | Decimal) => new Decimal(value instanceof Decimal ? value.toString() : value);
const toNum = (value: number | Decimal) => Number(value instanceof Decimal ? value.toString() : value);
const toJson = (value?: unknown) => (value ?? {}) as Prisma.InputJsonValue;

export type OperationSource = "inventory" | "sales" | "tradeins" | "clients";
export type OperationInput = {
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
  tradeIn?: {
    deviceReceived: string;
    deviceReceivedImei?: string | null;
    takeValue: number;
    status?: string;
    batteryHealth?: string | null;
    grade?: string | null;
    customFields?: Record<string, unknown> | null;
  };
};
export class OperationError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
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
  const normalized = imei?.trim();
  if (!normalized) return;
  const duplicate = await tx.inventoryItem.findFirst({
    where: {
      storeId,
      imei: normalized,
      ...(exceptInventoryId ? { id: { not: exceptInventoryId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new OperationError("Ya existe un equipo con ese IMEI", 409);
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
    amount: toNum(sale.amount),
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    categoryId: sale.categoryId ?? null,
    customFields: sale.customFields ?? {},
    tradeInId: sale.tradeInId ?? null,
    requestKey: sale.requestKey ?? null,
    integratedOperation: sale.integratedOperation,
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
    deviceGiven: trade.deviceGiven,
    differencePaid: toNum(trade.differencePaid),
    status: trade.status,
    confirmationStatus: trade.confirmationStatus,
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
    status: product.status,
    categoryId: product.categoryId ?? null,
    customFields: product.customFields ?? {},
    soldAt: null,
    createdAt: product.createdAt.toISOString(),
    archivedAt: product.archivedAt?.toISOString() ?? null,
    pendingSaleRegistration: product.pendingSaleRegistration,
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
  };
}

function at(value?: string) {
  return parseArDate(value) ?? new Date();
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
async function applyClientOperation(tx: Prisma.TransactionClient, storeId: string, clientId: string, amount: number, paymentStatus: string, date: Date, direction: 1 | -1, debtAmount = amount) {
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  const total = Math.max(0, toNum(client.totalSpent) + direction * amount);
  const pending = Math.max(0, toNum(client.pendingBalance) + (paymentStatus === "PENDIENTE" ? direction * debtAmount : 0));
  const lastPurchaseAt = direction > 0 ? date : (await tx.sale.aggregate({ where: { storeId, clientId, status: { not: "CANCELADA" } }, _max: { soldAt: true } }))._max.soldAt;
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
    const nextLastPurchase = newAmount > 0 ? date : (await tx.sale.aggregate({ where: { storeId, clientId: id, status: { not: "CANCELADA" } }, _max: { soldAt: true } }))._max.soldAt;
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

function fullDeviceLabel(product: Pick<InventoryItem, "model" | "capacity">) {
  return [product.model, product.capacity].filter(Boolean).join(" ").slice(0, 120);
}

function canRegisterOutgoingSale(product: { status: string; pendingSaleRegistration: boolean }) {
  return product.status === "DISPONIBLE" || (product.status === "VENDIDO" && product.pendingSaleRegistration);
}

function salePricePatch(price: { toNumber(): number }, amount: number): { price?: Decimal } {
  if (price.toNumber() > 0 || !(amount > 0)) return {};
  return { price: dec(amount) };
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
          { status: "DISPONIBLE" },
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
        pendingSaleRegistration: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { storeId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { products: products.map((p) => ({ ...p, price: toNum(p.price) })), clients };
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

export async function createOperation(storeId: string, source: OperationSource, input: OperationInput) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    if (input.status === "CANCELADA") throw new OperationError("Una operación nueva no puede crearse cancelada", 400);
    if (input.tradeIn) await assertCategory(tx, storeId, "tradeins", input.categoryId);
    else if (source === "tradeins") await assertCategory(tx, storeId, "tradeins", input.categoryId);
    else await assertCategory(tx, storeId, "sales", input.saleCategoryId ?? input.categoryId);
    if (input.saleCategoryId !== undefined) await assertCategory(tx, storeId, "sales", input.saleCategoryId);
    if (input.tradeIn && input.draft) {
      if (!input.tradeIn.deviceReceived?.trim() || !Number.isFinite(input.tradeIn.takeValue) || input.tradeIn.takeValue < 0) throw new OperationError("Datos del equipo recibido invalidos");
      if (input.amount !== undefined && input.amount < input.tradeIn.takeValue) throw new OperationError("La diferencia no puede ser negativa");
      const prior = input.requestKey ? await tx.tradeIn.findFirst({ where: { storeId, requestKey: input.requestKey } }) : null;
      if (prior) {
        const existingSale = await tx.sale.findFirst({ where: { storeId, tradeInId: prior.id } });
        if (existingSale) return replaySaleResult(tx, storeId, existingSale, "Canje recuperado");
        return { tradeIn: serializeTrade(prior), inventory: [], clients: [], notifications: [], summary: "Borrador de canje recuperado" };
      }
      const date = at(input.date);
      const draftClient = input.clientId ? await tx.client.findFirst({ where: { id: input.clientId, storeId }, select: { id: true, name: true } }) : null;
      if (input.clientId && !draftClient) throw new OperationError("Client not found", 404);
      if (input.productId) {
        const draftProduct = await tx.inventoryItem.findFirst({ where: { id: input.productId, storeId, archivedAt: null } });
        if (!draftProduct) throw new OperationError("Inventory item not found", 404);
        if (!canRegisterOutgoingSale(draftProduct)) throw new OperationError("El equipo no esta disponible para registrar una venta", 409);
      }
      const trade = await tx.tradeIn.create({ data: {
        storeId,
        clientId: draftClient?.id ?? null,
        clientName: draftClient?.name ?? input.clientName?.trim() ?? "",
        categoryId: input.categoryId ?? null,
        dateLabel: formatArDate(date),
        tradeAt: date,
        deviceReceived: input.tradeIn.deviceReceived.trim(),
        deviceReceivedImei: input.tradeIn.deviceReceivedImei?.trim() || null,
        takeValue: dec(input.tradeIn.takeValue),
        deviceGiven: input.deviceLabel?.trim() ?? "",
        differencePaid: dec(0),
        status: input.tradeIn.status ?? "PENDIENTE",
        confirmationStatus: "PENDING",
        operationSource: source,
        batteryHealth: input.tradeIn.batteryHealth?.trim() || null,
        grade: input.tradeIn.grade?.trim() || null,
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
      }, { tradeins: trade.id }));
      return { tradeIn: serializeTrade(trade), inventory: [], clients: [], notifications, summary: "Borrador de canje guardado" };
    }
    const prior = input.requestKey ? await tx.sale.findFirst({ where: { storeId, requestKey: input.requestKey } }) : null;
    if (prior) return replaySaleResult(tx, storeId, prior, "Operación recuperada");
    const tradeInput = input.tradeIn;
    if (!Number.isFinite(input.amount) || (input.amount ?? -1) < 0) throw new OperationError("Monto inválido");
    if (tradeInput && (!tradeInput.deviceReceived?.trim() || !Number.isFinite(tradeInput.takeValue) || tradeInput.takeValue < 0 || tradeInput.takeValue > input.amount!)) throw new OperationError("Datos de canje invalidos o diferencia negativa");
    const productId = input.productId?.trim() || null;
    const product = productId ? await tx.inventoryItem.findFirst({ where: { id: productId, storeId, archivedAt: null } }) : null;
    if (productId && !product) throw new OperationError("Inventory item not found", 404);
    if (product && !canRegisterOutgoingSale(product)) throw new OperationError("El equipo no está disponible para registrar una venta", 409);
    if (product?.status === "VENDIDO" && !product.pendingSaleRegistration) throw new OperationError("El equipo vendido no tiene registro pendiente", 409);
    if (product && await tx.sale.findFirst({ where: { storeId, inventoryItemId: product.id, status: { not: "CANCELADA" } } })) throw new OperationError("Este equipo ya tiene una venta activa", 409);
    if (!product && !input.deviceLabel?.trim()) throw new OperationError("Indicá el equipo");
    const resolvedClient = await getClient(tx, storeId, input);
    const client = resolvedClient.client;
    const clientCreated = resolvedClient.created;
    if (tradeInput && !client) throw new OperationError("El canje confirmado requiere un cliente", 400);
    const date = at(input.date);
    let trade: TradeIn | null = null;
    let incoming: InventoryItem | null = null;
    if (tradeInput) {
      await assertIncomingImei(tx, storeId, tradeInput.deviceReceivedImei);
      trade = await tx.tradeIn.create({
        data: {
          storeId,
          clientId: client?.id ?? null,
          clientName: client?.name ?? input.clientName?.trim() ?? "",
          categoryId: input.categoryId ?? null,
          dateLabel: formatArDate(date),
          tradeAt: date,
          deviceReceived: tradeInput.deviceReceived.trim(),
          deviceReceivedImei: tradeInput.deviceReceivedImei?.trim() || null,
          takeValue: dec(tradeInput.takeValue),
          deviceGiven: product?.model ?? input.deviceLabel?.trim() ?? "",
          differencePaid: dec(input.amount! - tradeInput.takeValue),
        status: tradeInput.status ?? "PENDIENTE",
          confirmationStatus: "CONFIRMED",
          operationSource: source,
          batteryHealth: tradeInput.batteryHealth?.trim() || null,
          grade: tradeInput.grade?.trim() || null,
          customFields: toJson(tradeInput.customFields),
          requestKey: input.requestKey ?? null,
        },
      });
      incoming = await tx.inventoryItem.create({
        data: {
          storeId,
          imei: tradeInput.deviceReceivedImei?.trim() || null,
          model: tradeInput.deviceReceived.trim(),
          capacity: "",
          color: "",
          condition: "",
          grade: tradeInput.grade?.trim() || "",
          batteryHealth: tradeInput.batteryHealth?.trim() || "",
          cost: dec(tradeInput.takeValue),
          price: dec(0),
          status: "EN_REVISION",
          customFields: {},
        },
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
          ...salePricePatch(product.price, input.amount!),
        },
      });
    }
    const sale = await tx.sale.create({
      data: {
        storeId,
        clientId: client?.id ?? null,
        clientName: client?.name ?? input.clientName?.trim() ?? "",
        categoryId: trade ? input.saleCategoryId ?? null : input.saleCategoryId ?? input.categoryId ?? null,
        inventoryItemId: product?.id ?? null,
        deviceLabel: product ? fullDeviceLabel(product) : input.deviceLabel?.trim() ?? null,
        dateLabel: formatArDate(date),
        soldAt: date,
        amount: dec(input.amount!),
        paymentMethod: input.paymentMethod?.trim() || "EFECTIVO",
        status: input.status ?? "COMPLETADA",
        customFields: toJson(input.customFields),
        tradeInId: trade?.id ?? null,
        requestKey: input.requestKey ?? null,
        integratedOperation: true,
        previousInventoryStatus: product?.previousSaleStatus ?? product?.status ?? null,
        previousPendingSaleRegistration:
          product?.status === "VENDIDO" && product?.pendingSaleRegistration
            ? false
            : product?.pendingSaleRegistration ?? false,
      },
    });
    const dueAmount = trade ? input.amount! - tradeInput!.takeValue : input.amount!;
    const updatedClient = client ? await applyClientOperation(tx, storeId, client.id, input.amount!, input.status ?? "COMPLETADA", date, 1, dueAmount) : null;
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
      },
      { sales: sale.id, inventory: incoming?.id ?? product?.id ?? sale.id, tradeins: trade?.id ?? sale.id, clients: client?.id ?? sale.id },
      { targets: { inventory: noticeTargets([
        { recordId: product?.id, reason: "Vendido" },
        { recordId: incoming?.id, reason: "Nuevo · entró por canje" },
      ]) } },
    ));
    return { sale: serializeSale(sale), ...(trade ? { tradeIn: serializeTrade({ ...trade, saleId: sale.id }) } : {}), inventory: [outputState, incoming].filter(present).map(serializeProduct), clients: updatedClient ? [serializeClient(updatedClient)] : [], notifications, summary: operationSummary({ trade: !!trade, amount: input.amount!, takeValue: tradeInput?.takeValue, status: input.status ?? "COMPLETADA", hasInventory: !!product, received: !!incoming }) };
  });
}

export async function confirmTradeOperation(storeId: string, tradeId: string, input: OperationInput) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const trade = await tx.tradeIn.findFirst({ where: { id: tradeId, storeId } });
    if (!trade) throw new OperationError("Trade-in not found", 404);
    const priorSale = await tx.sale.findFirst({ where: { storeId, tradeInId: trade.id } });
    if (priorSale) return replaySaleResult(tx, storeId, priorSale, "Canje ya confirmado");
    if (trade.confirmationStatus !== "PENDING") throw new OperationError("El canje no esta pendiente", 409);
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
      ? trade.grade
      : input.tradeIn.grade?.trim() || null;
    const receivedCustomFields = input.tradeIn?.customFields === undefined
      ? trade.customFields
      : input.tradeIn.customFields;

    if (!productId && !deviceLabel) throw new OperationError("Indica el equipo de salida");
    const product = productId
      ? await tx.inventoryItem.findFirst({ where: { id: productId, storeId, archivedAt: null } })
      : null;
    if (productId && !product) throw new OperationError("Inventory item not found", 404);
    if (product && !canRegisterOutgoingSale(product)) {
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
    if (!receivedDevice.trim() || takeValue < 0 || outgoingAmount === undefined || outgoingAmount < takeValue) {
      throw new OperationError("La diferencia no puede ser negativa");
    }

    const date = at(input.date ?? trade.dateLabel);
    await assertIncomingImei(tx, storeId, receivedImei);
    const received = await tx.inventoryItem.create({ data: {
      storeId,
      imei: receivedImei?.trim() || null,
      model: receivedDevice.trim(),
      capacity: "",
      color: "",
      condition: "",
      grade: receivedGrade || "",
      batteryHealth: receivedBattery || "",
      cost: dec(takeValue),
      price: dec(0),
      status: "EN_REVISION",
      customFields: toJson(receivedCustomFields),
    } });
    const confirmed = await tx.tradeIn.update({ where: { id: trade.id }, data: {
      clientId: client.id,
      clientName: client.name,
      dateLabel: formatArDate(date),
      tradeAt: date,
      categoryId: input.categoryId === undefined ? trade.categoryId : input.categoryId,
      deviceReceived: receivedDevice.trim(),
      deviceReceivedImei: receivedImei,
      takeValue: dec(takeValue),
      status: receivedStatus,
      batteryHealth: receivedBattery,
      grade: receivedGrade,
      customFields: toJson(receivedCustomFields),
      deviceGiven: product?.model ?? deviceLabel ?? "",
      differencePaid: dec(outgoingAmount - takeValue),
      confirmationStatus: "CONFIRMED",
      receivedInventoryItemId: received.id,
      previousOutgoingStatus: product?.previousSaleStatus ?? product?.status ?? null,
      previousOutgoingPendingRegistration: product?.status === "VENDIDO" && product?.pendingSaleRegistration
        ? false
        : product?.pendingSaleRegistration ?? false,
    } });
    if (product) await tx.inventoryItem.update({ where: { id: product.id }, data: {
      status: "VENDIDO",
      pendingSaleRegistration: false,
      previousSaleStatus: null,
      ...salePricePatch(product.price, outgoingAmount),
    } });
    const sale = await tx.sale.create({ data: {
      storeId,
      clientId: client.id,
      clientName: client.name,
      categoryId: saleCategoryId ?? null,
      inventoryItemId: product?.id ?? null,
      deviceLabel: product ? fullDeviceLabel(product) : deviceLabel,
      dateLabel: formatArDate(date),
      soldAt: date,
      amount: dec(outgoingAmount),
      paymentMethod: input.paymentMethod ?? trade.draftPaymentMethod ?? "EFECTIVO",
      status: input.status ?? trade.draftPaymentStatus ?? "COMPLETADA",
      tradeInId: trade.id,
      customFields: toJson(input.customFields),
      integratedOperation: true,
      previousInventoryStatus: product?.previousSaleStatus ?? product?.status ?? null,
      previousPendingSaleRegistration: product?.status === "VENDIDO" && product?.pendingSaleRegistration
        ? false
        : product?.pendingSaleRegistration ?? false,
    } });
    const paymentStatus = input.status ?? trade.draftPaymentStatus ?? "COMPLETADA";
    const updatedClient = await applyClientOperation(tx, storeId, client.id, outgoingAmount, paymentStatus, date, 1, outgoingAmount - takeValue);
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
      summary: operationSummary({ trade: true, amount: outgoingAmount, takeValue, status: paymentStatus, hasInventory: !!product, received: true }),
    };
  });
}

export async function updateSaleOperation(storeId: string, saleId: string, input: OperationInput) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, storeId } });
    if (!sale) throw new OperationError("Sale not found", 404);
    if (!sale.integratedOperation) throw new OperationError("Esta venta no pertenece a una operación integrada", 409);
    if (sale.status === "CANCELADA") throw new OperationError("No se puede editar una operación cancelada", 409);
    const trade = sale.tradeInId ? await tx.tradeIn.findFirst({ where: { id: sale.tradeInId, storeId } }) : null;
    if (trade && input.categoryId !== undefined) await assertCategory(tx, storeId, "tradeins", input.categoryId);
    if (input.saleCategoryId !== undefined) await assertCategory(tx, storeId, "sales", input.saleCategoryId);
    else if (!trade && input.categoryId !== undefined) await assertCategory(tx, storeId, "sales", input.categoryId);
    const nextTradeInput = input.tradeIn;
    const nextTakeValue = nextTradeInput?.takeValue ?? (trade ? toNum(trade.takeValue) : 0);
    const nextAmount = input.amount ?? toNum(sale.amount);
    if (trade && nextAmount < nextTakeValue) throw new OperationError("La diferencia no puede ser negativa");
    const nextDate = input.date ? at(input.date) : sale.soldAt;
    const nextProductId = input.productId === undefined ? sale.inventoryItemId : input.productId?.trim() || null;
    const nextDeviceLabel = input.deviceLabel === undefined ? sale.deviceLabel : input.deviceLabel?.trim() || null;
    if (!nextProductId && !nextDeviceLabel) throw new OperationError("Indicá el equipo");
    const nextProduct = nextProductId ? await tx.inventoryItem.findFirst({ where: { id: nextProductId, storeId, archivedAt: null } }) : null;
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
    const nextStatus = input.status ?? sale.status;
    const nextDebt = trade ? Math.max(0, nextAmount - nextTakeValue) : nextAmount;
    if (sale.inventoryItemId && sale.inventoryItemId !== nextProductId) {
      await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: sale.previousInventoryStatus ?? "DISPONIBLE", pendingSaleRegistration: sale.previousPendingSaleRegistration ?? false } });
    }
    if (nextProduct && nextProduct.id !== sale.inventoryItemId) {
      await tx.inventoryItem.update({ where: { id: nextProduct.id }, data: { status: "VENDIDO", pendingSaleRegistration: false, previousSaleStatus: null, ...salePricePatch(nextProduct.price, nextAmount) } });
    } else if (nextProduct && nextProduct.price.toNumber() <= 0 && nextAmount > 0) {
      await tx.inventoryItem.update({ where: { id: nextProduct.id }, data: { price: dec(nextAmount) } });
    }
    const updatedSale = await tx.sale.update({
      where: { id: sale.id },
      data: {
        clientId: nextClientId,
        clientName: nextClient?.name ?? input.clientName?.trim() ?? "",
        amount: dec(nextAmount),
        status: nextStatus,
        paymentMethod: input.paymentMethod ?? sale.paymentMethod,
        dateLabel: formatArDate(nextDate),
        soldAt: nextDate,
        inventoryItemId: nextProductId,
        deviceLabel: nextProduct ? fullDeviceLabel(nextProduct) : nextDeviceLabel,
        categoryId: input.saleCategoryId !== undefined
          ? input.saleCategoryId
          : trade || input.categoryId === undefined
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
    let updatedTrade = trade;
    let incoming: InventoryItem | null = null;
    if (trade) {
      updatedTrade = await tx.tradeIn.update({
        where: { id: trade.id },
        data: {
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
          differencePaid: dec(nextDebt),
          deviceGiven: nextProduct?.model ?? nextDeviceLabel ?? "",
          status: nextTradeInput?.status ?? trade.status,
          batteryHealth:
            nextTradeInput?.batteryHealth === undefined
              ? trade.batteryHealth
              : nextTradeInput.batteryHealth?.trim() || null,
          grade:
            nextTradeInput?.grade === undefined
              ? trade.grade
              : nextTradeInput.grade?.trim() || null,
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
          batteryHealth: updatedTrade.batteryHealth ?? "", grade: updatedTrade.grade ?? "",
        } });
      }
    }
    const updatedClients = (await applyClientDelta(tx, storeId, sale.clientId, nextClientId, toNum(sale.amount), nextAmount, sale.status, nextStatus, trade ? toNum(trade.differencePaid) : toNum(sale.amount), nextDebt, nextDate)).filter(present);
    const output = nextProductId ? await tx.inventoryItem.findFirst({ where: { id: nextProductId, storeId } }) : null;
    const released = sale.inventoryItemId && sale.inventoryItemId !== nextProductId ? await tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null;
    const sections = ["sales", ...(output || released || incoming ? ["inventory"] : []), ...(trade ? ["tradeins"] : []), ...(updatedClients.length ? ["clients"] : [])];
    const primaryClient = updatedClients.find((item) => item.id === nextClientId) ?? updatedClients[0] ?? null;
    const saleLabel = updatedSale.deviceLabel ?? "";
    const notifications = await notify(tx, storeId, sectionRecords(sections, {
      action: "updated",
      deviceLabel: saleLabel,
      clientName: primaryClient?.name ?? nextClient?.name ?? "",
      clientCreated,
      amount: nextAmount,
      pendingBalance: primaryClient ? toNum(primaryClient.pendingBalance) : null,
      takeValue: trade ? nextTakeValue : null,
      difference: trade ? nextDebt : null,
      receivedDevice: incoming?.model ?? null,
      soldDevice: output?.status === "VENDIDO" ? fullDeviceLabel(output) : null,
      releasedDevice: released ? fullDeviceLabel(released) : null,
    }, { sales: sale.id, inventory: incoming?.id ?? output?.id ?? released?.id ?? sale.id, tradeins: trade?.id ?? sale.id, clients: nextClientId ?? sale.id }, {
      targets: { inventory: noticeTargets([
        { recordId: output?.status === "VENDIDO" ? output.id : null, reason: "Vendido" },
        { recordId: released?.id, reason: "Volvió al stock" },
        { recordId: incoming?.id, reason: "Nuevo · entró por canje" },
      ]) },
    }));
    return { sale: serializeSale(updatedSale), ...(updatedTrade ? { tradeIn: serializeTrade({ ...updatedTrade, saleId: sale.id }) } : {}), inventory: [output, released, incoming].filter(present).map(serializeProduct), clients: updatedClients.map(serializeClient), notifications, summary: `${operationSummary({ trade: !!trade, amount: nextAmount, takeValue: trade ? nextTakeValue : undefined, status: nextStatus, hasInventory: !!nextProduct, received: !!trade })} · operación actualizada` };
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
      if (nextDraftAmount !== undefined && nextDraftAmount < nextTakeValue) throw new OperationError("La diferencia no puede ser negativa");
      if (input.productId) {
        const product = await tx.inventoryItem.findFirst({ where: { id: input.productId, storeId, archivedAt: null } });
        if (!product) throw new OperationError("Inventory item not found", 404);
        if (!canRegisterOutgoingSale(product)) throw new OperationError("El equipo no esta disponible para registrar una venta", 409);
      }
      const updated = await tx.tradeIn.update({ where: { id: tradeId }, data: {
        clientId, clientName: client ? client.name : input.clientName === undefined ? trade.clientName : input.clientName?.trim() ?? "",
        deviceReceived: input.tradeIn?.deviceReceived ?? trade.deviceReceived,
        deviceReceivedImei: input.tradeIn?.deviceReceivedImei === undefined ? trade.deviceReceivedImei : input.tradeIn.deviceReceivedImei?.trim() || null,
        takeValue: input.tradeIn?.takeValue === undefined ? trade.takeValue : dec(input.tradeIn.takeValue),
        status: input.tradeIn?.status ?? trade.status, batteryHealth: input.tradeIn?.batteryHealth === undefined ? trade.batteryHealth : input.tradeIn.batteryHealth,
        grade: input.tradeIn?.grade === undefined ? trade.grade : input.tradeIn.grade,
        draftProductId: input.productId === undefined ? trade.draftProductId : input.productId,
        draftDeviceLabel: input.deviceLabel === undefined ? trade.draftDeviceLabel : input.deviceLabel,
        draftAmount: input.amount === undefined ? trade.draftAmount : dec(input.amount),
        draftPaymentMethod: input.paymentMethod ?? trade.draftPaymentMethod, draftPaymentStatus: input.status ?? trade.draftPaymentStatus,
        categoryId: input.categoryId === undefined ? trade.categoryId : input.categoryId,
        draftSaleCategoryId: input.saleCategoryId === undefined ? trade.draftSaleCategoryId : input.saleCategoryId,
        dateLabel: input.date ? formatArDate(at(input.date)) : trade.dateLabel, tradeAt: input.date ? at(input.date) : trade.tradeAt,
      } });
      const notifications = await notify(tx, storeId, sectionRecords(["tradeins"], {
        action: "draft-updated",
        receivedDevice: updated.deviceReceived,
        takeValue: toNum(updated.takeValue),
        difference: updated.draftAmount == null ? null : toNum(updated.draftAmount) - toNum(updated.takeValue),
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

export async function cancelSaleOperation(storeId: string, saleId: string) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, storeId } });
    if (!sale) throw new OperationError("Sale not found", 404);
    if (!sale.integratedOperation) throw new OperationError("Esta venta no pertenece a una operación integrada", 409);
    if (sale.tradeInId) throw new OperationError("Esta venta pertenece a un canje; cancelá el canje asociado", 409);
    if (sale.status === "CANCELADA") return { sale: serializeSale(sale), inventory: [], clients: [], notifications: [], summary: "Venta ya cancelada" };
    if (sale.inventoryItemId && sale.integratedOperation) await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: sale.previousInventoryStatus ?? "DISPONIBLE", pendingSaleRegistration: sale.previousPendingSaleRegistration ?? false } });
    else if (sale.inventoryItemId) await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: "DISPONIBLE" } });
    const cancelled = await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELADA" } });
    const client = sale.clientId ? await applyClientOperation(tx, storeId, sale.clientId, toNum(sale.amount), sale.status, sale.soldAt, -1) : null;
    const product = sale.inventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null;
    const notifications = await notify(tx, storeId, sectionRecords(
      ["sales", ...(product ? ["inventory"] : []), ...(client ? ["clients"] : [])],
      {
        action: "cancelled",
        deviceLabel: sale.deviceLabel,
        clientName: client?.name ?? sale.clientName,
        amount: toNum(sale.amount),
        pendingBalance: client ? toNum(client.pendingBalance) : null,
        releasedDevice: product ? fullDeviceLabel(product) : null,
      },
      { sales: sale.id, inventory: product?.id ?? sale.id, clients: client?.id ?? sale.id },
    ));
    return { sale: serializeSale(cancelled), inventory: product ? [serializeProduct(product)] : [], clients: client ? [serializeClient(client)] : [], notifications, summary: `Venta cancelada · stock restaurado${client ? " · saldo revertido" : ""}` };
  });
}

export async function cancelOperationFromSale(storeId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, storeId }, select: { tradeInId: true } });
  if (!sale) throw new OperationError("Sale not found", 404);
  return sale.tradeInId ? cancelTradeOperation(storeId, sale.tradeInId) : cancelSaleOperation(storeId, saleId);
}

export async function cancelTradeFromSale(storeId: string, tradeId: string) {
  const trade = await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId }, select: { confirmationStatus: true, operationSource: true } });
  if (!trade) throw new OperationError("Trade-in not found", 404);
  const sale = await prisma.sale.findFirst({ where: { storeId, tradeInId: tradeId }, select: { id: true } });
  if (!sale && !(trade.confirmationStatus === "PENDING" && trade.operationSource === "sales")) {
    throw new OperationError("This trade-in is not linked to a sales operation", 403);
  }
  return cancelTradeOperation(storeId, tradeId);
}

export async function cancelTradeOperation(storeId: string, tradeId: string) {
  return withSerializableRetry(async (tx: Prisma.TransactionClient) => {
    const trade = await tx.tradeIn.findFirst({ where: { id: tradeId, storeId } });
    if (!trade) throw new OperationError("Trade-in not found", 404);
    if (trade.confirmationStatus == null) throw new OperationError("Este canje histórico no pertenece a una operación integrada", 409);
    if (trade.confirmationStatus === "CANCELLED") return { tradeIn: serializeTrade(trade), inventory: [], clients: [], notifications: [], summary: "Canje ya cancelado" };
    const sale = await tx.sale.findFirst({ where: { storeId, tradeInId: trade.id } });
    const received = trade.receivedInventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: trade.receivedInventoryItemId, storeId } }) : null;
    if (received && (received.status === "VENDIDO" || received.pendingSaleRegistration || await tx.sale.findFirst({ where: { storeId, inventoryItemId: received.id, status: { not: "CANCELADA" } } }))) throw new OperationError("No se puede cancelar: el equipo recibido ya está en uso", 409);
    if (sale) await tx.sale.update({ where: { id: sale.id }, data: { status: "CANCELADA" } });
    if (sale?.inventoryItemId) await tx.inventoryItem.update({ where: { id: sale.inventoryItemId }, data: { status: sale.previousInventoryStatus ?? trade.previousOutgoingStatus ?? "DISPONIBLE", pendingSaleRegistration: sale.previousPendingSaleRegistration ?? trade.previousOutgoingPendingRegistration ?? false } });
    if (received) await tx.inventoryItem.update({ where: { id: received.id }, data: { archivedAt: new Date() } });
    const updated = await tx.tradeIn.update({ where: { id: trade.id }, data: { confirmationStatus: "CANCELLED", status: "CANCELADO" } });
    const client = trade.clientId && sale
      ? await applyClientOperation(tx, storeId, trade.clientId, toNum(sale.amount), sale.status, sale.soldAt, -1, toNum(trade.differencePaid))
      : null;
    const [archivedReceived, output] = await Promise.all([
      received ? tx.inventoryItem.findFirst({ where: { id: received.id, storeId } }) : null,
      sale?.inventoryItemId ? tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null,
    ]);
    const notifications = await notify(tx, storeId, sectionRecords(
      ["tradeins", ...(sale ? ["sales"] : []), ...(received ? ["inventory"] : []), ...(client ? ["clients"] : [])],
      {
        action: "cancelled",
        deviceLabel: sale?.deviceLabel ?? trade.deviceGiven,
        clientName: client?.name ?? trade.clientName,
        amount: sale ? toNum(sale.amount) : null,
        pendingBalance: client ? toNum(client.pendingBalance) : null,
        takeValue: toNum(trade.takeValue),
        difference: toNum(trade.differencePaid),
        receivedDevice: trade.deviceReceived,
        archivedDevice: archivedReceived?.model ?? received?.model ?? null,
        releasedDevice: output ? fullDeviceLabel(output) : null,
      },
      { tradeins: trade.id, sales: sale?.id ?? trade.id, inventory: output?.id ?? trade.id, clients: client?.id ?? trade.id },
      { archiveReceived: true },
    ));
    return { ...(sale ? { sale: serializeSale({ ...sale, status: "CANCELADA" }, output) } : {}), tradeIn: serializeTrade({ ...updated, saleId: sale?.id }), inventory: [archivedReceived, output].filter(present).map(serializeProduct), clients: client ? [serializeClient(client)] : [], notifications, summary: `Canje cancelado · equipo recibido archivado${output ? " · salida restaurada" : ""}${client ? " · saldo revertido" : ""}` };
  });
}

export function getOperationErrorStatus(error: unknown) { return error instanceof OperationError ? { statusCode: error.statusCode, message: error.message } : null; }
export async function isIntegratedSale(storeId: string, saleId: string) {
  return Boolean(await prisma.sale.findFirst({ where: { id: saleId, storeId, integratedOperation: true }, select: { id: true } }));
}
export async function isIntegratedTradeIn(storeId: string, tradeId: string) {
  return Boolean(await prisma.tradeIn.findFirst({ where: { id: tradeId, storeId, confirmationStatus: { not: null } }, select: { id: true } }));
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
  const sale = await prisma.sale.findFirst({ where: { id: saleId, storeId, integratedOperation: true } });
  if (!sale) throw new OperationError("Integrated sale not found", 404);
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
