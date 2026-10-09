import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { formatArDate, parseArDate } from "../../lib/ar-date.js";
import { allocateDocumentNumber } from "../../lib/store-sequence.js";
import { prisma } from "../../plugins/prisma.js";
import { moneyChanged, writeAudit, type Actor } from "../audit/audit.js";
import { serializeClient, type ClientResponse } from "../clients/clients.service.js";
import { SENSITIVE_DENIED } from "../stores/sensitive-access.js";
import { REPAIR_READY, REPAIR_RECEIVED, repairCode, repairReadyMessage, repairWhatsappUrl } from "./repairs.whatsapp.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";

export interface RepairOrderInput {
  clientId?: string | null;
  clientName: string;
  device: string;
  imei?: string;
  fault?: string;
  faultTags?: string[];
  estimate?: number | null;
  deposit?: number;
  currency?: string | null;
  technician?: string;
  status?: string;
  estimatedDelivery?: string | null;
}

export interface RepairStatusEventResponse {
  id: string;
  status: string;
  createdAt: string;
}

export interface RepairOrderResponse {
  id: string;
  orderNumber: number;
  code: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  device: string;
  imei: string;
  fault: string;
  faultTags: string[];
  estimate: number | null;
  deposit: number;
  currency: string | null;
  technician: string;
  status: string;
  estimatedDelivery: string | null;
  notifyWhatsapp: boolean;
  receivedAt: string;
  whatsappUrl: string | null;
  events: RepairStatusEventResponse[];
}

const include = {
  client: true,
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.RepairOrderInclude;

type RepairRecord = Prisma.RepairOrderGetPayload<{ include: typeof include }>;

export class RepairError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

export function getRepairErrorStatus(error: unknown) {
  if (error instanceof RepairError) return { statusCode: error.statusCode, message: error.message };
  return null;
}

const money = (value: Decimal | number | null | undefined) => {
  if (value == null) return null;
  return value instanceof Decimal ? value.toNumber() : Number(value);
};

function splitTags(value: string) {
  return value.split("|").map((tag) => tag.trim()).filter(Boolean);
}

function joinTags(tags: string[] | undefined) {
  return (tags ?? []).map((tag) => tag.trim()).filter(Boolean).join("|");
}

function deliveryDate(value: string | null | undefined) {
  if (value == null || value.trim() === "") return null;
  const parsed = parseArDate(value);
  if (!parsed) throw new RepairError("La fecha de entrega no es válida");
  return parsed;
}

function serialize(record: RepairRecord, storeName: string | null): RepairOrderResponse {
  const code = repairCode(record.orderNumber);
  const phone = record.client?.phone ?? "";
  const whatsappUrl = record.notifyWhatsapp && record.status === REPAIR_READY
    ? repairWhatsappUrl(phone, repairReadyMessage({ clientName: record.clientName, device: record.device, code, storeName }))
    : null;
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    code,
    clientId: record.clientId,
    clientName: record.clientName,
    clientPhone: phone,
    device: record.device,
    imei: record.imei,
    fault: record.fault,
    faultTags: splitTags(record.faultTags),
    estimate: money(record.estimate),
    deposit: money(record.deposit) ?? 0,
    currency: record.currency ?? null,
    technician: record.technician,
    status: record.status,
    estimatedDelivery: record.estimatedDelivery ? formatArDate(record.estimatedDelivery) : null,
    notifyWhatsapp: record.notifyWhatsapp,
    receivedAt: formatArDate(record.receivedAt),
    whatsappUrl,
    events: record.events.map((event) => ({
      id: event.id,
      status: event.status,
      createdAt: formatArDate(event.createdAt),
    })),
  };
}

async function storeName(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
  return store?.name ?? null;
}

async function load(storeId: string, id: string) {
  return prisma.repairOrder.findFirst({ where: { id, storeId }, include });
}

export async function listRepairs(storeId: string): Promise<RepairOrderResponse[]> {
  const [rows, name] = await Promise.all([
    prisma.repairOrder.findMany({
      where: { storeId },
      include,
      orderBy: [{ receivedAt: "desc" }, { orderNumber: "desc" }],
    }),
    storeName(storeId),
  ]);
  return rows.map((row) => serialize(row, name));
}

export async function getRepair(storeId: string, id: string): Promise<RepairOrderResponse | null> {
  const row = await load(storeId, id);
  if (!row) return null;
  return serialize(row, await storeName(storeId));
}

function clientPayload(record: RepairRecord["client"]): ClientResponse | null {
  if (!record) return null;
  return serializeClient(record);
}

export async function createRepair(storeId: string, input: RepairOrderInput) {
  const name = await storeName(storeId);
  const status = input.status?.trim() || REPAIR_RECEIVED;
  const created = await prisma.$transaction(async (tx) => {
    let clientId = input.clientId?.trim() || null;
    let clientName = input.clientName.trim();
    if (clientId) {
      const client = await tx.client.findFirst({ where: { id: clientId, storeId } });
      if (!client) throw new RepairError("Cliente no encontrado", 404);
      clientName = client.name;
    } else {
      const client = await tx.client.create({ data: { storeId, name: clientName } });
      clientId = client.id;
    }
    const orderNumber = await allocateDocumentNumber(tx, storeId, "repair");
    const currency = currencyOnWrite(input.currency, true, await storeCurrency(storeId, tx));
    const order = await tx.repairOrder.create({
      data: {
        orderNumber,
        storeId,
        clientId,
        clientName,
        device: input.device.trim(),
        imei: (input.imei ?? "").replace(/\D/g, "").slice(0, 15),
        fault: (input.fault ?? "").trim(),
        faultTags: joinTags(input.faultTags),
        estimate: input.estimate == null ? null : new Decimal(input.estimate),
        deposit: new Decimal(input.deposit ?? 0),
        currency,
        technician: (input.technician ?? "").trim(),
        status,
        estimatedDelivery: deliveryDate(input.estimatedDelivery),
        notifyWhatsapp: true,
        events: { create: { storeId, status } },
      },
      include,
    });
    return order;
  });
  return { order: serialize(created, name), client: clientPayload(created.client) };
}

export async function updateRepair(
  storeId: string,
  id: string,
  input: Partial<RepairOrderInput>,
  options: { canChangePrice: boolean; actor?: Actor | null } = { canChangePrice: true },
) {
  const current = await load(storeId, id);
  if (!current) return null;
  const estimateChanged = input.estimate !== undefined && (
    input.estimate == null ? current.estimate != null : moneyChanged(current.estimate, input.estimate)
  );
  const depositChanged = input.deposit !== undefined && moneyChanged(current.deposit, input.deposit);
  const explicitCurrency = input.currency === "ARS" || input.currency === "USD" ? input.currency : null;
  const currencyChanged = explicitCurrency != null && explicitCurrency !== current.currency;
  if ((estimateChanged || depositChanged || currencyChanged) && !options.canChangePrice) {
    throw new RepairError(SENSITIVE_DENIED, 403);
  }
  const name = await storeName(storeId);
  const data: {
    clientId?: string | null;
    clientName?: string;
    device?: string;
    imei?: string;
    fault?: string;
    faultTags?: string;
    estimate?: Decimal | null;
    deposit?: Decimal;
    currency?: string;
    technician?: string;
    estimatedDelivery?: Date | null;
  } = {};
  if (input.clientId !== undefined || input.clientName !== undefined) {
    const clientId = input.clientId?.trim() || null;
    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, storeId } });
      if (!client) throw new RepairError("Cliente no encontrado", 404);
      data.clientId = client.id;
      data.clientName = client.name;
    } else if (input.clientName !== undefined) {
      data.clientName = input.clientName.trim();
      data.clientId = null;
    }
  }
  if (input.device !== undefined) data.device = input.device.trim();
  if (input.imei !== undefined) data.imei = input.imei.replace(/\D/g, "").slice(0, 15);
  if (input.fault !== undefined) data.fault = input.fault.trim();
  if (input.faultTags !== undefined) data.faultTags = joinTags(input.faultTags);
  if (input.estimate !== undefined) data.estimate = input.estimate == null ? null : new Decimal(input.estimate);
  if (input.deposit !== undefined) data.deposit = new Decimal(input.deposit);
  const nextCurrency = currencyOnWrite(input.currency, estimateChanged || depositChanged, estimateChanged || depositChanged ? await storeCurrency(storeId, prisma) : "ARS");
  if (nextCurrency) data.currency = nextCurrency;
  if (input.technician !== undefined) data.technician = input.technician.trim();
  if (input.estimatedDelivery !== undefined) data.estimatedDelivery = deliveryDate(input.estimatedDelivery);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.repairOrder.update({ where: { id }, data, include });
    if ((estimateChanged || depositChanged) && options.actor) {
      await writeAudit(tx, {
        storeId,
        actor: options.actor,
        action: "repair.estimate",
        entityType: "repair",
        entityId: id,
        detail: estimateChanged
          ? `${current.estimate?.toString() ?? "—"} → ${input.estimate ?? "—"}`
          : `seña ${current.deposit.toString()} → ${input.deposit ?? "—"}`,
      });
    }
    return row;
  });
  return { order: serialize(updated, name) };
}

export async function changeRepairStatus(storeId: string, id: string, status: string) {
  const name = await storeName(storeId);
  const next = status.trim();
  if (!next) throw new RepairError("Elegí un estado");
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.repairOrder.findFirst({ where: { id, storeId } });
    if (!current) return null;
    if (current.status === next) {
      return tx.repairOrder.findFirst({ where: { id, storeId }, include });
    }
    await tx.repairStatusEvent.create({ data: { storeId, orderId: id, status: next } });
    return tx.repairOrder.update({ where: { id }, data: { status: next }, include });
  });
  if (!updated) return null;
  return { order: serialize(updated, name) };
}

export async function deleteRepair(storeId: string, id: string, actor?: Actor | null) {
  const current = await prisma.repairOrder.findFirst({ where: { id, storeId }, select: { id: true, orderNumber: true, device: true } });
  if (!current) return false;
  await prisma.$transaction(async (tx) => {
    await tx.repairOrder.delete({ where: { id } });
    if (actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "repair.deleted",
        entityType: "repair",
        entityId: id,
        detail: `${repairCode(current.orderNumber)} · ${current.device}`,
      });
    }
  });
  return true;
}
