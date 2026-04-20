import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export interface TradeInInput {
  date: string;
  clientId: string;
  categoryId?: string | null;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: number;
  deviceGiven: string;
  differencePaid: number;
  status:
    | "PENDIENTE"
    | "APROBADO"
    | "RECHAZADO"
    | "EN REVISIÓN"
    | "PERITAJE TÉC."
    | "LISTO";
  batteryHealth?: string | null;
  grade?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface TradeInPatchInput extends Partial<TradeInInput> {}

export interface TradeInResponse {
  id: string;
  date: string;
  clientId: string;
  categoryId: string | null;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: number;
  deviceGiven: string;
  differencePaid: number;
  status: TradeInInput["status"];
  batteryHealth?: string | null;
  grade?: string | null;
  customFields: Record<string, unknown>;
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
  clientId: string | null;
  categoryId: string | null;
  dateLabel: string;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: Decimal;
  deviceGiven: string;
  differencePaid: Decimal;
  status: string;
  batteryHealth: string | null;
  grade: string | null;
  tradeAt: Date;
  customFields: Prisma.JsonValue | null;
};

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

function serializeTradeIn(tradeIn: TradeInRecord): TradeInResponse {
  return {
    id: tradeIn.id,
    date: tradeIn.dateLabel || formatDateLabel(tradeIn.tradeAt),
    clientId: tradeIn.clientId ?? "",
    categoryId: tradeIn.categoryId ?? null,
    deviceReceived: tradeIn.deviceReceived,
    deviceReceivedImei: tradeIn.deviceReceivedImei,
    takeValue: tradeIn.takeValue.toNumber(),
    deviceGiven: tradeIn.deviceGiven,
    differencePaid: tradeIn.differencePaid.toNumber(),
    status: tradeIn.status as TradeInResponse["status"],
    batteryHealth: tradeIn.batteryHealth ?? undefined,
    grade: tradeIn.grade ?? undefined,
    customFields: toCustomFields(tradeIn.customFields),
  };
}

function normalizeGrade(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
  });

  return tradeIns.map(serializeTradeIn);
}

export async function createTradeIn(storeId: string, input: TradeInInput) {
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, storeId },
  });

  if (!client) {
    throw new TradeInsError("Client not found", 404);
  }

  const tradeAt = parseDateLabel(input.date);
  const dateLabel = normalizeDateLabel(input.date) || formatDateLabel(tradeAt);

  const tradeIn = await prisma.tradeIn.create({
    data: {
      storeId,
      clientId: client.id,
      categoryId: input.categoryId ?? null,
      dateLabel,
      deviceReceived: input.deviceReceived,
      deviceReceivedImei: input.deviceReceivedImei,
      takeValue: toDecimal(input.takeValue),
      deviceGiven: input.deviceGiven,
      differencePaid: toDecimal(input.differencePaid),
      status: input.status,
      batteryHealth: input.batteryHealth ?? null,
      grade: input.grade?.trim() ? input.grade.trim() : null,
      customFields: normalizeCustomFields(input.customFields),
      tradeAt,
    },
  });

  return serializeTradeIn(tradeIn as TradeInRecord);
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

  if (input.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, storeId },
    });

    if (!client) {
      throw new TradeInsError("Client not found", 404);
    }
  }

  await assertCategoryBelongsToStore(storeId, input.categoryId);

  const nextDate = input.date !== undefined ? parseDateLabel(input.date) : existing.tradeAt;
  const nextDateLabel =
    input.date !== undefined
      ? normalizeDateLabel(input.date) || formatDateLabel(nextDate)
      : existing.dateLabel;

  const updated = await prisma.tradeIn.update({
    where: { id },
    data: {
      clientId:
        input.clientId !== undefined
          ? input.clientId || null
          : existing.clientId,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      dateLabel: nextDateLabel,
      deviceReceived: input.deviceReceived ?? existing.deviceReceived,
      deviceReceivedImei: input.deviceReceivedImei ?? existing.deviceReceivedImei,
      takeValue:
        input.takeValue !== undefined ? toDecimal(input.takeValue) : existing.takeValue,
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

export async function deleteTradeIn(storeId: string, id: string) {
  const existing = await prisma.tradeIn.findFirst({
    where: { id, storeId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.tradeIn.delete({
    where: { id },
  });

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

      const deviceReceivedImei = row.deviceReceivedImei?.trim();
      if (!deviceReceivedImei) {
        errors.push({ row: rowNum, message: "IMEI recibido requerido" });
        continue;
      }

      const deviceGiven = row.deviceGiven?.trim();
      if (!deviceGiven) {
        errors.push({ row: rowNum, message: "Equipo entregado requerido" });
        continue;
      }

      const takeValue = Number.parseFloat((row.takeValue ?? "").replace(",", "."));
      if (!Number.isFinite(takeValue) || takeValue < 0) {
        errors.push({ row: rowNum, message: "Valor de toma invalido" });
        continue;
      }

      const differencePaid = Number.parseFloat((row.differencePaid ?? "").replace(",", "."));
      if (!Number.isFinite(differencePaid) || differencePaid < 0) {
        errors.push({ row: rowNum, message: "Diferencia abonada invalida" });
        continue;
      }

      const rawStatus = row.status?.trim().toUpperCase();
      const status = (VALID_TRADE_IN_STATUSES as readonly string[]).includes(rawStatus ?? "")
        ? (rawStatus as TradeInInput["status"])
        : "PENDIENTE";

      const dateInput = row.date?.trim() || "";
      const tradeAt = parseDateLabel(dateInput);
      const dateLabel = normalizeDateLabel(dateInput) || formatDateLabel(tradeAt);

      const batteryHealth = normalizeBatteryHealth(row.batteryHealth);
      const grade = normalizeGrade(row.grade);

      const existing = await prisma.tradeIn.findFirst({
        where: {
          storeId,
          deviceReceivedImei,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.tradeIn.update({
          where: { id: existing.id },
          data: {
            clientId: client.id,
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
        await prisma.tradeIn.create({
          data: {
            storeId,
            clientId: client.id,
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
