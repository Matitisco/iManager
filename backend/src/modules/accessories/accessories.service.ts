import { Prisma } from "@prisma/client";
import type { Accessory, AccessoryMovement } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../plugins/prisma.js";
import {
  accessorySaleNote,
  adjustmentNote,
  crossedLowStock,
  type AccessoryLineInput,
} from "./accessory-lines.js";

export interface AccessoryInput {
  name: string;
  category: string;
  compatibleWith?: string | null;
  sku?: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
}

export interface AccessoryMovementResponse {
  id: string;
  delta: number;
  kind: string;
  note: string;
  createdAt: string;
}

export interface SaleAccessoryLineResponse {
  accessoryId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface AccessoryResponse {
  id: string;
  name: string;
  category: string;
  compatibleWith: string;
  sku: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  movements?: AccessoryMovementResponse[];
}

export class AccessoryError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

const dec = (value: number) => new Decimal(value);
const money = (value: Decimal | number) => (value instanceof Decimal ? value.toNumber() : Number(value));

function serializeMovement(row: AccessoryMovement): AccessoryMovementResponse {
  return {
    id: row.id,
    delta: row.delta,
    kind: row.kind,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeAccessory(row: Accessory, movements?: AccessoryMovement[]): AccessoryResponse {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    compatibleWith: row.compatibleWith,
    sku: row.sku,
    cost: money(row.cost),
    price: money(row.price),
    stock: row.stock,
    minStock: row.minStock,
    ...(movements ? { movements: movements.map(serializeMovement) } : {}),
  };
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function getAccessoryErrorStatus(error: unknown) {
  return error instanceof AccessoryError ? { statusCode: error.statusCode, message: error.message } : null;
}

export async function listAccessories(storeId: string) {
  const rows = await prisma.accessory.findMany({
    where: { storeId },
    orderBy: [{ name: "asc" }],
  });
  return rows.map((row) => serializeAccessory(row));
}

export async function getAccessory(storeId: string, id: string) {
  const row = await prisma.accessory.findFirst({ where: { id, storeId } });
  if (!row) return null;
  const movements = await prisma.accessoryMovement.findMany({
    where: { accessoryId: id, storeId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return serializeAccessory(row, movements);
}

export async function createAccessory(storeId: string, input: AccessoryInput) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.accessory.create({
      data: {
        storeId,
        name: input.name.trim(),
        category: input.category.trim(),
        compatibleWith: clean(input.compatibleWith),
        sku: clean(input.sku),
        cost: dec(input.cost),
        price: dec(input.price),
        stock: input.stock,
        minStock: input.minStock,
      },
    });
    if (input.stock > 0) {
      await tx.accessoryMovement.create({
        data: {
          storeId,
          accessoryId: created.id,
          delta: input.stock,
          kind: "INITIAL",
          note: "Stock inicial",
        },
      });
    }
    const notifications = created.minStock > 0 && created.stock <= created.minStock
      ? await notifyLowStock(tx, storeId, created)
      : [];
    return { accessory: serializeAccessory(created), notifications };
  });
}

export async function updateAccessory(storeId: string, id: string, input: Partial<AccessoryInput>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.accessory.findFirst({ where: { id, storeId } });
    if (!existing) return null;
    const nextStock = input.stock ?? existing.stock;
    if (nextStock < 0) throw new AccessoryError("El stock no puede ser negativo");
    const updated = await tx.accessory.update({
      where: { id: existing.id },
      data: {
        name: input.name?.trim() ?? existing.name,
        category: input.category?.trim() ?? existing.category,
        compatibleWith: input.compatibleWith === undefined ? existing.compatibleWith : clean(input.compatibleWith),
        sku: input.sku === undefined ? existing.sku : clean(input.sku),
        cost: input.cost === undefined ? existing.cost : dec(input.cost),
        price: input.price === undefined ? existing.price : dec(input.price),
        stock: nextStock,
        minStock: input.minStock ?? existing.minStock,
      },
    });
    const delta = nextStock - existing.stock;
    if (delta !== 0) {
      await tx.accessoryMovement.create({
        data: {
          storeId,
          accessoryId: existing.id,
          delta,
          kind: "ADJUSTMENT",
          note: adjustmentNote(delta),
        },
      });
    }
    const wasLow = existing.stock <= existing.minStock;
    const isLow = updated.stock <= updated.minStock;
    const notifications = isLow && !wasLow ? await notifyLowStock(tx, storeId, updated) : [];
    const movements = await tx.accessoryMovement.findMany({
      where: { accessoryId: existing.id, storeId },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return { accessory: serializeAccessory(updated, movements), notifications };
  });
}

export async function deleteAccessory(storeId: string, id: string) {
  const existing = await prisma.accessory.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!existing) return false;
  const sold = await prisma.saleAccessory.count({ where: { accessoryId: id, storeId } });
  if (sold > 0) throw new AccessoryError("Este accesorio ya se vendió. No se puede eliminar.", 409);
  await prisma.accessory.delete({ where: { id } });
  return true;
}

async function notifyLowStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  accessory: Pick<Accessory, "id" | "name" | "minStock" | "stock">,
) {
  const notification = await tx.storeNotification.create({
    data: {
      storeId,
      section: "inventory",
      title: "Stock bajo de accesorio",
      message: `${accessory.name} quedó en ${accessory.stock} u. (mínimo ${accessory.minStock}).`,
      recordId: accessory.id,
      kind: "ACCESSORY_LOW_STOCK",
    },
  });
  return [presentNotification(notification)];
}

function presentNotification(notification: { id: string; storeId: string; section: string; title: string; message: string; recordId: string | null; kind: string; createdAt: Date }) {
  return {
    id: notification.id,
    storeId: notification.storeId,
    section: notification.section,
    title: notification.title,
    message: notification.message,
    recordId: notification.recordId,
    kind: notification.kind,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function attachSaleAccessories(
  tx: Prisma.TransactionClient,
  storeId: string,
  sale: { id: string; saleNumber: number; deviceLabel?: string | null },
  lines: AccessoryLineInput[],
) {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.accessoryId, (merged.get(line.accessoryId) ?? 0) + line.quantity);
  const accessories = [];
  const saved: SaleAccessoryLineResponse[] = [];
  const notifications = [];
  for (const accessoryId of [...merged.keys()].sort()) {
    const quantity = merged.get(accessoryId) ?? 0;
    const current = await tx.accessory.findFirst({ where: { id: accessoryId, storeId } });
    if (!current) throw new AccessoryError("Accesorio no encontrado", 404);
    const taken = await tx.accessory.updateMany({
      where: { id: accessoryId, storeId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (taken.count !== 1) {
      throw new AccessoryError(`No hay stock suficiente de ${current.name}. Quedan ${current.stock}.`, 409);
    }
    const next = await tx.accessory.findFirst({ where: { id: accessoryId, storeId } });
    if (!next) throw new AccessoryError("Accesorio no encontrado", 404);
    await tx.saleAccessory.create({
      data: {
        storeId,
        saleId: sale.id,
        accessoryId,
        name: current.name,
        quantity,
        unitPrice: current.price,
      },
    });
    await tx.accessoryMovement.create({
      data: {
        storeId,
        accessoryId,
        delta: -quantity,
        kind: "SALE",
        note: accessorySaleNote(sale.saleNumber, sale.deviceLabel),
        saleId: sale.id,
      },
    });
    if (crossedLowStock(current.stock, next.stock, next.minStock)) {
      notifications.push(...await notifyLowStock(tx, storeId, next));
    }
    accessories.push(serializeAccessory(next));
    saved.push({
      accessoryId,
      name: current.name,
      quantity,
      unitPrice: money(current.price),
    });
  }
  return { accessories, lines: saved, notifications };
}

export async function restoreSaleAccessories(tx: Prisma.TransactionClient, storeId: string, saleId: string) {
  const lines = await tx.saleAccessory.findMany({ where: { storeId, saleId, voidedAt: null } });
  const restored = [];
  for (const line of lines) {
    const taken = await tx.accessory.updateMany({
      where: { id: line.accessoryId, storeId },
      data: { stock: { increment: line.quantity } },
    });
    if (taken.count !== 1) throw new AccessoryError("Accesorio no encontrado", 404);
    const next = await tx.accessory.findFirst({ where: { id: line.accessoryId, storeId } });
    if (!next) throw new AccessoryError("Accesorio no encontrado", 404);
    await tx.accessoryMovement.create({
      data: {
        storeId,
        accessoryId: line.accessoryId,
        delta: line.quantity,
        kind: "SALE_REVERT",
        note: "Venta cancelada",
        saleId,
      },
    });
    await tx.saleAccessory.update({ where: { id: line.id }, data: { voidedAt: new Date() } });
    restored.push(serializeAccessory(next));
  }
  return restored;
}
