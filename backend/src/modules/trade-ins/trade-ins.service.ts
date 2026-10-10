import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { formatArDate, formatStoredDate, parseArDate } from "../../lib/ar-date.js";
import { allocateDocumentNumber } from "../../lib/store-sequence.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { prisma } from "../../plugins/prisma.js";
import { parseOptionalImei } from "../../lib/imei.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";
import { parseQuality } from "../inventory/quality.js";
import { moneyChanged } from "../audit/audit.js";

export interface TradeInInput {
  date?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  categoryId?: string | null;
  deviceReceived: string;
  deviceReceivedImei?: string | null;
  takeValue?: number;
  deviceGiven: string;
  differencePaid?: number;
  status?: string;
  batteryHealth?: string | null;
  grade?: string | null;
  customFields?: Record<string, unknown> | null;
  currency?: string | null;
}

export interface TradeInPatchInput extends Partial<TradeInInput> {}

export interface TradeInResponse {
  id: string;
  tradeNumber: number;
  date: string;
  clientId: string;
  clientName: string;
  categoryId: string | null;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: number;
  currency: string | null;
  deviceGiven: string;
  differencePaid: number;
  status: string;
  batteryHealth?: string | null;
  grade?: string | null;
  customFields: Record<string, unknown>;
  confirmationStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | null;
  operationSource: string | null;
  receivedInventoryItemId: string | null;
  saleId: string | null;
  draftProductId: string | null;
  draftDeviceLabel: string | null;
  draftSaleCategoryId: string | null;
  draftAmount: number | null;
  draftPaymentMethod: string | null;
  draftPaymentStatus: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
}

export interface TradeInCategoryResponse {
  id: string;
  name: string;
}

export interface TradeInImportRow {
  date?: string;
  clientName?: string;
  deviceReceived?: string;
  deviceReceivedImei?: string;
  takeValue?: string;
  deviceGiven?: string;
  differencePaid?: string;
  status?: string;
  batteryHealth?: string;
  grade?: string;
}

export interface TradeInImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

type TradeInRecord = {
  id: string;
  tradeNumber?: number;
  clientId: string | null;
  clientName?: string | null;
  categoryId: string | null;
  dateLabel: string;
  deviceReceived: string;
  deviceReceivedImei: string | null;
  takeValue: Decimal;
  currency?: string | null;
  deviceGiven: string;
  differencePaid: Decimal;
  status: string;
  batteryHealth: string | null;
  grade: string | null;
  tradeAt: Date;
  customFields: Prisma.JsonValue | null;
  confirmationStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | null;
  operationSource: string | null;
  receivedInventoryItemId: string | null;
  draftProductId: string | null;
  draftDeviceLabel: string | null;
  draftSaleCategoryId: string | null;
  draftAmount: Decimal | null;
  draftPaymentMethod: string | null;
  draftPaymentStatus: string | null;
  cancelledBy?: string | null;
  cancelledAt?: Date | null;
  sale?: { id: string } | null;
};

function requiredTradeImei(value: string | null | undefined) {
  const parsed = parseOptionalImei(value);
  if (parsed.ok === false) throw new TradeInsError(parsed.message, 400);
  return parsed.imei ?? "";
}

class TradeInsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_TRADE_IN_STATUSES = [
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
  "EN REVISIÓN",
  "PERITAJE TÉC.",
  "LISTO",
] as const;

const toDecimal = (value: number) => new Decimal(value);

async function assertCategoryBelongsToStore(storeId: string, categoryId?: string | null) {
  if (categoryId === undefined || categoryId === null) {
    return;
  }

  const category = await prisma.tradeInCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

  if (!category) {
    throw new TradeInsError("Category not found", 404);
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

function resolveDate(value: string | null | undefined, fallback = new Date()) {
  return parseArDate(value) ?? fallback;
}

function serializeTradeIn(tradeIn: TradeInRecord): TradeInResponse {
  return {
    id: tradeIn.id,
    tradeNumber: tradeIn.tradeNumber ?? 0,
    date: formatStoredDate(tradeIn.dateLabel, tradeIn.tradeAt),
    clientId: tradeIn.clientId ?? "",
    clientName: tradeIn.clientName ?? "",
    categoryId: tradeIn.categoryId ?? null,
    deviceReceived: tradeIn.deviceReceived,
    deviceReceivedImei: tradeIn.deviceReceivedImei ?? "",
    takeValue: tradeIn.takeValue.toNumber(),
    currency: tradeIn.currency ?? null,
    deviceGiven: tradeIn.deviceGiven,
    differencePaid: tradeIn.differencePaid.toNumber(),
    status: tradeIn.status as TradeInResponse["status"],
    batteryHealth: tradeIn.batteryHealth ?? undefined,
    grade: tradeIn.grade ?? undefined,
    customFields: toCustomFields(tradeIn.customFields),
    confirmationStatus: tradeIn.confirmationStatus,
    operationSource: tradeIn.operationSource,
    receivedInventoryItemId: tradeIn.receivedInventoryItemId,
    saleId: tradeIn.sale?.id ?? null,
    draftProductId: tradeIn.draftProductId,
    draftDeviceLabel: tradeIn.draftDeviceLabel,
    draftSaleCategoryId: tradeIn.draftSaleCategoryId,
    draftAmount: tradeIn.draftAmount?.toNumber() ?? null,
    draftPaymentMethod: tradeIn.draftPaymentMethod,
    draftPaymentStatus: tradeIn.draftPaymentStatus,
    cancelledBy: tradeIn.cancelledBy ?? null,
    cancelledAt: tradeIn.cancelledAt ? tradeIn.cancelledAt.toISOString() : null,
  };
}

function normalizeGrade(value?: string | null) {
  if (value === undefined) return undefined;
  const parsed = parseQuality(value);
  if (parsed.ok === false) throw new TradeInsError(parsed.message, 400);
  return parsed.grade || null;
}

function normalizeBatteryHealth(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listTradeIns(storeId: string) {
  const tradeIns = await prisma.tradeIn.findMany({
    where: { storeId },
    orderBy: { tradeAt: "desc" },
    include: { sale: { select: { id: true } } },
  });

  return tradeIns.map(serializeTradeIn);
}

async function linkedClient(storeId: string, clientId?: string | null) {
  const id = clientId?.trim();
  if (!id) return null;

  const client = await prisma.client.findFirst({
    where: { id, storeId },
    select: { id: true, name: true },
  });

  if (!client) {
    throw new TradeInsError("Client not found", 404);
  }

  return client;
}

function resolveClientName(typed: string | null | undefined, linkedName?: string | null) {
  return typed?.trim() || linkedName?.trim() || "";
}

export async function createTradeIn(storeId: string, input: TradeInInput) {
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  const client = await linkedClient(storeId, input.clientId);
  const clientName = resolveClientName(input.clientName, client?.name);

  if (!clientName) {
    throw new TradeInsError("Nombre de cliente requerido", 400);
  }

  const tradeAt = resolveDate(input.date);
  const dateLabel = formatArDate(tradeAt);

  return prisma.$transaction(async (tx) => {
    const tradeNumber = await allocateDocumentNumber(tx, storeId, "trade");
    const currency = currencyOnWrite(input.currency, true, await storeCurrency(storeId, tx));
    const tradeIn = await tx.tradeIn.create({
      data: {
        tradeNumber,
        storeId,
        clientId: client?.id ?? null,
        clientName,
        categoryId: input.categoryId ?? null,
        dateLabel,
        deviceReceived: input.deviceReceived,
        deviceReceivedImei: requiredTradeImei(input.deviceReceivedImei),
        takeValue: toDecimal(input.takeValue ?? 0),
        currency,
        deviceGiven: input.deviceGiven,
        differencePaid: toDecimal(input.differencePaid ?? 0),
        status: input.status?.trim() || "PENDIENTE",
        batteryHealth: input.batteryHealth ?? null,
        grade: normalizeGrade(input.grade) ?? null,
        customFields: normalizeCustomFields(input.customFields),
        tradeAt,
      },
    });

    return serializeTradeIn(tradeIn as TradeInRecord);
  });
}

export async function updateTradeIn(
  storeId: string,
  id: string,
  input: TradeInPatchInput
) {
  const existing = await prisma.tradeIn.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return null;
  }
  if (existing.confirmationStatus != null || existing.receivedInventoryItemId) {
    throw new TradeInsError("Este canje está vinculado a una operación. Editalo desde Operaciones.", 409);
  }

  const client = input.clientId !== undefined ? await linkedClient(storeId, input.clientId) : null;
  const nextClientId = input.clientId !== undefined ? (client?.id ?? null) : existing.clientId;
  const nextClientName = input.clientName !== undefined
    ? resolveClientName(input.clientName, client?.name)
    : (client?.name || existing.clientName || "");

  if (!nextClientId && !nextClientName) {
    throw new TradeInsError("Nombre de cliente requerido", 400);
  }

  await assertCategoryBelongsToStore(storeId, input.categoryId);

  const nextDate = input.date !== undefined ? resolveDate(input.date, existing.tradeAt) : existing.tradeAt;
  const nextDateLabel = input.date !== undefined ? formatArDate(nextDate) : existing.dateLabel;

  const valueChanges = (input.takeValue !== undefined && moneyChanged(existing.takeValue, input.takeValue))
    || (input.differencePaid !== undefined && moneyChanged(existing.differencePaid, input.differencePaid));
  const nextCurrency = currencyOnWrite(input.currency, valueChanges, valueChanges ? await storeCurrency(storeId, prisma) : "ARS");
  const updated = await prisma.tradeIn.update({
    where: { id },
    data: {
      clientId: nextClientId,
      clientName: nextClientName,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      dateLabel: nextDateLabel,
      deviceReceived: input.deviceReceived ?? existing.deviceReceived,
      deviceReceivedImei:
        input.deviceReceivedImei !== undefined
          ? requiredTradeImei(input.deviceReceivedImei)
          : existing.deviceReceivedImei,
      takeValue:
        input.takeValue !== undefined ? toDecimal(input.takeValue) : existing.takeValue,
      ...(nextCurrency ? { currency: nextCurrency } : {}),
      deviceGiven: input.deviceGiven ?? existing.deviceGiven,
      differencePaid:
        input.differencePaid !== undefined
          ? toDecimal(input.differencePaid)
          : existing.differencePaid,
      status: input.status ?? existing.status,
      batteryHealth:
        input.batteryHealth !== undefined
          ? normalizeBatteryHealth(input.batteryHealth)
          : existing.batteryHealth,
      grade:
        input.grade !== undefined
          ? normalizeGrade(input.grade)
          : existing.grade,
      customFields:
        input.customFields !== undefined
          ? normalizeCustomFields(input.customFields)
          : ((existing.customFields ?? {}) as Prisma.InputJsonValue),
      tradeAt: nextDate,
    },
  });

  return serializeTradeIn(updated as TradeInRecord);
}

export async function deleteTradeIn(storeId: string, id: string, actor?: Actor | null) {
  const existing = await prisma.tradeIn.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return false;
  }
  if (existing.confirmationStatus != null || existing.receivedInventoryItemId) {
    throw new TradeInsError("Este canje está vinculado a una operación. Gestioná la operación desde su origen.", 409);
  }

  await prisma.tradeIn.delete({
    where: { id },
  });

  if (actor) {
    await writeAudit(prisma, {
      storeId,
      actor,
      action: "trade.deleted",
      entityType: "trade",
      entityId: id,
      detail: existing.deviceReceived,
    });
  }

  return true;
}

export function getTradeInsErrorStatus(error: unknown) {
  if (error instanceof TradeInsError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}

function parseImportAmount(raw: string | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!text) return 0;
  const value = Number.parseFloat(text.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export async function importTradeIns(
  storeId: string,
  rows: TradeInImportRow[]
): Promise<TradeInImportResult> {
  let imported = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const clientName = row.clientName?.trim();
      if (!clientName) {
        errors.push({ row: rowNum, message: "Nombre de cliente requerido" });
        continue;
      }

      const client = await prisma.client.findFirst({
        where: {
          storeId,
          name: { equals: clientName, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (!client) {
        errors.push({ row: rowNum, message: `Cliente no encontrado: "${clientName}"` });
        continue;
      }

      const deviceReceived = row.deviceReceived?.trim();
      if (!deviceReceived) {
        errors.push({ row: rowNum, message: "Equipo recibido requerido" });
        continue;
      }

      const parsedImei = parseOptionalImei(row.deviceReceivedImei);
      if (parsedImei.ok === false) {
        errors.push({ row: rowNum, message: parsedImei.message });
        continue;
      }
      const deviceReceivedImei = parsedImei.imei ?? "";

      const deviceGiven = row.deviceGiven?.trim();
      if (!deviceGiven) {
        errors.push({ row: rowNum, message: "Equipo entregado requerido" });
        continue;
      }

      const takeValue = parseImportAmount(row.takeValue);
      if (takeValue === null) {
        errors.push({ row: rowNum, message: "Valor de toma invalido" });
        continue;
      }

      const differencePaid = parseImportAmount(row.differencePaid);
      if (differencePaid === null) {
        errors.push({ row: rowNum, message: "Diferencia abonada invalida" });
        continue;
      }

      const rawStatus = row.status?.trim().toUpperCase();
      const status = (VALID_TRADE_IN_STATUSES as readonly string[]).includes(rawStatus ?? "")
        ? (rawStatus as string)
        : "PENDIENTE";

      const dateInput = row.date?.trim() || "";
      const tradeAt = resolveDate(dateInput);
      const dateLabel = formatArDate(tradeAt);

      const batteryHealth = normalizeBatteryHealth(row.batteryHealth);
      const grade = normalizeGrade(row.grade);

      const existing = deviceReceivedImei
        ? await prisma.tradeIn.findFirst({
            where: {
              storeId,
              deviceReceivedImei,
            },
            select: { id: true },
          })
        : null;

      if (existing) {
        await prisma.tradeIn.update({
          where: { id: existing.id },
          data: {
            clientId: client.id,
            clientName,
            dateLabel,
            deviceReceived,
            deviceReceivedImei,
            takeValue: toDecimal(takeValue),
            deviceGiven,
            differencePaid: toDecimal(differencePaid),
            status,
            batteryHealth,
            grade,
            tradeAt,
          },
        });
        updated++;
      } else {
        await prisma.$transaction(async (tx) => {
          const tradeNumber = await allocateDocumentNumber(tx, storeId, "trade");
          await tx.tradeIn.create({
            data: {
              tradeNumber,
              storeId,
              clientId: client.id,
              clientName,
              dateLabel,
              deviceReceived,
              deviceReceivedImei,
              takeValue: toDecimal(takeValue),
              deviceGiven,
              differencePaid: toDecimal(differencePaid),
              status,
              batteryHealth,
              grade,
              tradeAt,
            },
          });
        });
        imported++;
      }
    } catch (error) {
      errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return { imported, updated, errors };
}

// ── TradeIn Categories ────────────────────────────────────────────────────────

export async function listTradeInCategories(storeId: string): Promise<TradeInCategoryResponse[]> {
  return prisma.tradeInCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

export async function createTradeInCategory(storeId: string, name: string): Promise<TradeInCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new TradeInsError("Category name required", 400);
  const existing = await prisma.tradeInCategory.findFirst({ where: { storeId, name: trimmed } });
  if (existing) throw new TradeInsError("Category already exists", 409);
  const count = await prisma.tradeInCategory.count({ where: { storeId } });
  return prisma.tradeInCategory.create({ data: { storeId, name: trimmed, sortOrder: count }, select: { id: true, name: true } });
}

export async function renameTradeInCategory(storeId: string, id: string, name: string): Promise<TradeInCategoryResponse | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new TradeInsError("Category name required", 400);
  const existing = await prisma.tradeInCategory.findFirst({ where: { id, storeId } });
  if (!existing) return null;
  return prisma.tradeInCategory.update({ where: { id }, data: { name: trimmed }, select: { id: true, name: true } });
}

export async function deleteTradeInCategory(storeId: string, id: string): Promise<boolean> {
  const existing = await prisma.tradeInCategory.findFirst({ where: { id, storeId } });
  if (!existing) return false;
  await prisma.$transaction([
    prisma.tradeIn.updateMany({ where: { storeId, categoryId: id }, data: { categoryId: null } }),
    prisma.tradeInCategory.delete({ where: { id } }),
  ]);
  return true;
}

export async function reorderTradeInCategories(storeId: string, categoryIds: string[]): Promise<void> {
  await prisma.$transaction(
    categoryIds.map((id, idx) =>
      prisma.tradeInCategory.updateMany({ where: { id, storeId }, data: { sortOrder: idx } })
    )
  );
}

export async function bulkMoveTradeInCategory(storeId: string, ids: string[], categoryId: string | null): Promise<number> {
  if (categoryId !== null) {
    const cat = await prisma.tradeInCategory.findFirst({ where: { id: categoryId, storeId } });
    if (!cat) throw new TradeInsError("Category not found", 404);
  }
  const result = await prisma.tradeIn.updateMany({ where: { storeId, id: { in: ids } }, data: { categoryId } });
  return result.count;
}
