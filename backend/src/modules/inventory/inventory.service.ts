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
};

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
    orderBy: { createdAt: "desc" },
  });

  return inventory.map(serializeInventoryItem);
}

export async function createInventoryItem(storeId: string, input: InventoryItemInput) {
  const inventoryItem = await inventoryPrisma.inventoryItem.create({
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

  const updated = await inventoryPrisma.inventoryItem.update({
    where: { id },
    data: {
      imei: input.imei ?? existing.imei,
      model: input.model ?? existing.model,
      capacity: input.capacity ?? existing.capacity,
      color: input.color ?? existing.color,
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
