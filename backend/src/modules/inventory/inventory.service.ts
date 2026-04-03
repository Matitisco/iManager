import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export interface InventoryItemInput {
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: "NUEVO" | "USADO" | "PRE-OWNED";
  grade: "A+" | "A" | "B" | "C" | "N/A";
  batteryHealth: number;
  cost: number;
  price: number;
  status: "DISPONIBLE" | "VENDIDO" | "EN_REVISION";
  customFields?: Record<string, unknown> | null;
}

export interface InventoryItemResponse {
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: "NUEVO" | "USADO" | "PRE-OWNED";
  grade: "A+" | "A" | "B" | "C" | "N/A";
  batteryHealth: number;
  cost: number;
  price: number;
  status: "DISPONIBLE" | "VENDIDO" | "EN_REVISION";
  customFields: Record<string, unknown>;
  soldAt: string | null;
}

type InventoryRecord = {
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  batteryHealth: number;
  cost: Decimal;
  price: Decimal;
  status: string;
  customFields: Prisma.JsonValue | null;
  sales?: { soldAt: Date }[];
};

class InventoryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const inventoryPrisma = prisma as any;

const toDecimal = (value: number) => new Decimal(value);

const toCustomFields = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

export function serializeInventoryItem(item: InventoryRecord): InventoryItemResponse {
  return {
    id: item.id,
    imei: item.imei,
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    condition: item.condition as InventoryItemResponse["condition"],
    grade: item.grade as InventoryItemResponse["grade"],
    batteryHealth: item.batteryHealth,
    cost: item.cost.toNumber(),
    price: item.price.toNumber(),
    status: item.status as InventoryItemResponse["status"],
    customFields: toCustomFields(item.customFields),
    soldAt: item.sales?.[0]?.soldAt?.toISOString() ?? null,
  };
}

function normalizeCustomFields(customFields?: Record<string, unknown> | null) {
  if (!customFields) {
    return {};
  }

  return Object.keys(customFields).length > 0 ? customFields : {};
}

export async function listInventory(storeId: string) {
  const inventory = await inventoryPrisma.inventoryItem.findMany({
    where: { storeId },
    include: {
      sales: {
        select: { soldAt: true },
        orderBy: { soldAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return inventory.map(serializeInventoryItem);
}

export async function createInventoryItem(storeId: string, input: InventoryItemInput) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { storeId, imei: input.imei.trim() },
    select: { id: true },
  });

  if (existing) {
    throw new InventoryError("Inventory item already exists", 409);
  }

  const inventoryItem = await inventoryPrisma.inventoryItem.create({
    data: {
      storeId,
      imei: input.imei.trim(),
      model: input.model.trim(),
      capacity: input.capacity.trim(),
      color: input.color.trim(),
      condition: input.condition,
      grade: input.grade,
      batteryHealth: input.batteryHealth,
      cost: toDecimal(input.cost),
      price: toDecimal(input.price),
      status: input.status,
      customFields: normalizeCustomFields(input.customFields),
    },
  });

  return serializeInventoryItem(inventoryItem);
}

export async function updateInventoryItem(
  storeId: string,
  id: string,
  input: Partial<InventoryItemInput>
) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return null;
  }

  if (input.imei !== undefined) {
    const nextImei = input.imei.trim();
    const duplicate = await inventoryPrisma.inventoryItem.findFirst({
      where: {
        storeId,
        imei: nextImei,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new InventoryError("Inventory item already exists", 409);
    }
  }

  const updated = await inventoryPrisma.inventoryItem.update({
    where: { id },
    data: {
      imei: input.imei !== undefined ? input.imei.trim() : existing.imei,
      model: input.model !== undefined ? input.model.trim() : existing.model,
      capacity: input.capacity !== undefined ? input.capacity.trim() : existing.capacity,
      color: input.color !== undefined ? input.color.trim() : existing.color,
      condition: input.condition ?? existing.condition,
      grade: input.grade ?? existing.grade,
      batteryHealth: input.batteryHealth ?? existing.batteryHealth,
      cost: input.cost !== undefined ? toDecimal(input.cost) : existing.cost,
      price: input.price !== undefined ? toDecimal(input.price) : existing.price,
      status: input.status ?? existing.status,
      customFields:
        input.customFields !== undefined
          ? normalizeCustomFields(input.customFields)
          : existing.customFields ?? {},
    },
  });

  return serializeInventoryItem(updated);
}

export async function deleteInventoryItem(storeId: string, id: string) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { id, storeId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await inventoryPrisma.inventoryItem.delete({
    where: { id },
  });

  return true;
}

export interface ImportRow {
  imei: string;
  model: string;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: number;
  cost?: number;
  price: number;
  status?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: { row: number; imei: string; message: string }[];
}

const CONDITION_MAP: Record<string, string> = {
  nuevo: "NUEVO",
  new: "NUEVO",
  usado: "USADO",
  used: "USADO",
  "pre-owned": "PRE-OWNED",
  preowned: "PRE-OWNED",
  "pre owned": "PRE-OWNED",
};

const GRADE_MAP: Record<string, string> = {
  "a+": "A+",
  a: "A",
  b: "B",
  c: "C",
  "n/a": "N/A",
  na: "N/A",
  "-": "N/A",
};

const STATUS_MAP: Record<string, string> = {
  disponible: "DISPONIBLE",
  available: "DISPONIBLE",
  vendido: "VENDIDO",
  sold: "VENDIDO",
  "en revision": "EN_REVISION",
  en_revision: "EN_REVISION",
  review: "EN_REVISION",
};

function normalizeEnum<T extends string>(
  value: string | undefined,
  map: Record<string, string>,
  fallback: T
): T {
  if (!value) return fallback;
  const normalized = map[value.toLowerCase().trim()];
  return (normalized as T) ?? fallback;
}

export async function importInventoryItems(
  storeId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;

    if (!raw.model?.trim()) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Modelo vacío" });
      continue;
    }
    if (raw.price == null || isNaN(raw.price)) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Precio inválido" });
      continue;
    }

    const input = {
      imei: raw.imei?.trim() || `IMP-${Date.now()}-${rowNum}`,
      model: raw.model.trim(),
      capacity: raw.capacity?.trim() || "",
      color: raw.color?.trim() || "",
      condition: normalizeEnum(raw.condition, CONDITION_MAP, "USADO" as const),
      grade: normalizeEnum(raw.grade, GRADE_MAP, "N/A" as const),
      batteryHealth: raw.batteryHealth?.toString()?.trim() || "100",
      cost: Number(raw.cost) || 0,
      price: Number(raw.price),
      status: normalizeEnum(raw.status, STATUS_MAP, "DISPONIBLE" as const),
    };

    try {
      const existing = await inventoryPrisma.inventoryItem.findFirst({
        where: { storeId, imei: input.imei },
        select: { id: true },
      });

      if (existing) {
        const prev = await inventoryPrisma.inventoryItem.findFirst({
          where: { id: existing.id },
          select: { customFields: true },
        });
        const mergedFields = {
          ...(toCustomFields(prev?.customFields ?? null)),
          ...(raw.customFields ?? {}),
        };
        await inventoryPrisma.inventoryItem.update({
          where: { id: existing.id },
          data: {
            model: input.model,
            capacity: input.capacity,
            color: input.color,
            condition: input.condition,
            grade: input.grade,
            batteryHealth: input.batteryHealth,
            cost: toDecimal(input.cost),
            price: toDecimal(input.price),
            status: input.status,
            customFields: mergedFields,
          },
        });
        result.updated++;
      } else {
        await inventoryPrisma.inventoryItem.create({
          data: {
            storeId,
            imei: input.imei,
            model: input.model,
            capacity: input.capacity,
            color: input.color,
            condition: input.condition,
            grade: input.grade,
            batteryHealth: input.batteryHealth,
            cost: toDecimal(input.cost),
            price: toDecimal(input.price),
            status: input.status,
            customFields: raw.customFields ?? {},
          },
        });
        result.imported++;
      }
    } catch {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Error al guardar" });
    }
  }

  return result;
}

export function getInventoryErrorStatus(error: unknown) {
  if (error instanceof InventoryError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}
