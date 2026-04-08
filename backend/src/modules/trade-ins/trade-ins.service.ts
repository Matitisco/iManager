import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../plugins/prisma.js";

export interface TradeInInput {
  date: string;
  clientId: string;
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
}

export interface TradeInPatchInput extends Partial<TradeInInput> {}

export interface TradeInResponse {
  id: string;
  date: string;
  clientId: string;
  deviceReceived: string;
  deviceReceivedImei: string;
  takeValue: number;
  deviceGiven: string;
  differencePaid: number;
  status: TradeInInput["status"];
  batteryHealth?: string | null;
  grade?: string | null;
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
    deviceReceived: tradeIn.deviceReceived,
    deviceReceivedImei: tradeIn.deviceReceivedImei,
    takeValue: tradeIn.takeValue.toNumber(),
    deviceGiven: tradeIn.deviceGiven,
    differencePaid: tradeIn.differencePaid.toNumber(),
    status: tradeIn.status as TradeInResponse["status"],
    batteryHealth: tradeIn.batteryHealth ?? undefined,
    grade: tradeIn.grade ?? undefined,
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
      dateLabel,
      deviceReceived: input.deviceReceived,
      deviceReceivedImei: input.deviceReceivedImei,
      takeValue: toDecimal(input.takeValue),
      deviceGiven: input.deviceGiven,
      differencePaid: toDecimal(input.differencePaid),
      status: input.status,
      batteryHealth: input.batteryHealth ?? null,
      grade: input.grade?.trim() ? input.grade.trim() : null,
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
