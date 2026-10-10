import type { CatalogKind, Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";
import { retireRepairStatuses } from "../repairs/retire-repair-statuses.js";

export const CATALOG_KINDS = [
  "INVENTORY_STATUS",
  "INVENTORY_CAPACITY",
  "INVENTORY_CONDITION",
  "SALE_STATUS",
  "TRADE_IN_STATUS",
  "CLIENT_TAG",
  "REPAIR_STATUS",
] as const satisfies readonly CatalogKind[];

type Kind = (typeof CATALOG_KINDS)[number];

export interface CatalogOptionInput {
  value?: string;
  label: string;
  color?: string | null;
}

export interface CatalogDeletion {
  value: string;
  reassignTo: string;
}

export interface CatalogOptionResponse {
  id: string;
  kind: Kind;
  value: string;
  label: string;
  color: string | null;
  isSystem: boolean;
  sortOrder: number;
  count: number;
}

class CatalogError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const DEFAULTS: Record<Kind, { value: string; label: string; color: string | null; isSystem: boolean }[]> = {
  INVENTORY_STATUS: [
    { value: "DISPONIBLE", label: "Disponible", color: "#25A66A", isSystem: true },
    { value: "EN_REVISION", label: "En revisión", color: "#E8A33D", isSystem: false },
    { value: "RESERVADO", label: "Reservado", color: "#3B82F6", isSystem: false },
    { value: "VENDIDO", label: "Vendido", color: "#737984", isSystem: true },
  ],
  INVENTORY_CAPACITY: [
    { value: "64GB", label: "64GB", color: null, isSystem: false },
    { value: "128GB", label: "128GB", color: null, isSystem: false },
    { value: "256GB", label: "256GB", color: null, isSystem: false },
    { value: "512GB", label: "512GB", color: null, isSystem: false },
  ],
  INVENTORY_CONDITION: [
    { value: "NUEVO", label: "Nuevo", color: null, isSystem: true },
    { value: "USADO", label: "Usado", color: null, isSystem: false },
  ],
  SALE_STATUS: [
    { value: "COMPLETADA", label: "Completada", color: "#25A66A", isSystem: true },
    { value: "PENDIENTE", label: "Pendiente", color: "#E8A33D", isSystem: true },
    { value: "CANCELADA", label: "Cancelada", color: "#DC4C4C", isSystem: false },
  ],
  TRADE_IN_STATUS: [
    { value: "PENDIENTE", label: "Pendiente", color: "#E8A33D", isSystem: true },
    { value: "PERITAJE TÉC.", label: "Peritaje téc.", color: "#8B5CF6", isSystem: false },
    { value: "EN REVISIÓN", label: "En revisión", color: "#3B82F6", isSystem: false },
    { value: "APROBADO", label: "Aprobado", color: "#25A66A", isSystem: false },
    { value: "LISTO", label: "Completado", color: "#0F9D8A", isSystem: true },
    { value: "RECHAZADO", label: "Rechazado", color: "#DC4C4C", isSystem: true },
  ],
  CLIENT_TAG: [
    { value: "Frecuente", label: "Frecuente", color: "#8B5CF6", isSystem: false },
    { value: "Mayorista", label: "Mayorista", color: "#3B82F6", isSystem: false },
    { value: "Nuevo", label: "Nuevo", color: "#E8A33D", isSystem: false },
  ],
  REPAIR_STATUS: [
    { value: "RECIBIDO", label: "Recibido", color: "#9AA0AA", isSystem: true },
    { value: "EN_REPARACION", label: "En reparación", color: "#5B8DEF", isSystem: false },
    { value: "LISTO_PARA_RETIRAR", label: "Listo para retirar", color: "#25A66A", isSystem: false },
    { value: "ENTREGADO", label: "Entregado", color: "#16181D", isSystem: true },
  ],
};

const META: Record<Kind, { title: string; add: string; noun: [string, string] }> = {
  INVENTORY_STATUS: { title: "Estados de equipo", add: "Agregar estado", noun: ["equipo", "equipos"] },
  INVENTORY_CAPACITY: { title: "Capacidades", add: "Agregar capacidad", noun: ["equipo", "equipos"] },
  INVENTORY_CONDITION: { title: "Condiciones", add: "Agregar condición", noun: ["equipo", "equipos"] },
  SALE_STATUS: { title: "Estados de venta", add: "Agregar estado", noun: ["venta", "ventas"] },
  TRADE_IN_STATUS: { title: "Estados de canje", add: "Agregar estado", noun: ["canje", "canjes"] },
  CLIENT_TAG: { title: "Etiquetas de cliente", add: "Agregar etiqueta", noun: ["cliente", "clientes"] },
  REPAIR_STATUS: { title: "Estados de servicio", add: "Agregar estado", noun: ["orden", "órdenes"] },
};

function slug(label: string) {
  const value = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  return value || "OPCION";
}

async function seedMissing(storeId: string) {
  for (const kind of CATALOG_KINDS) {
    const count = await prisma.storeCatalogOption.count({ where: { storeId, kind } });
    if (count > 0) continue;
    await prisma.storeCatalogOption.createMany({
      data: DEFAULTS[kind].map((option, index) => ({
        storeId,
        kind,
        value: option.value,
        label: option.label,
        color: option.color,
        isSystem: option.isSystem,
        sortOrder: index,
      })),
    });
  }
}

async function usageCounts(storeId: string) {
  const [items, sales, trades, clients, repairs] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { storeId }, select: { status: true, capacity: true, condition: true } }),
    prisma.sale.findMany({ where: { storeId }, select: { status: true } }),
    prisma.tradeIn.findMany({ where: { storeId }, select: { status: true } }),
    prisma.client.findMany({ where: { storeId }, select: { tag: true } }),
    prisma.repairOrder.findMany({ where: { storeId }, select: { status: true } }),
  ]);
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  const inventoryStatus = new Map<string, number>();
  const capacity = new Map<string, number>();
  const condition = new Map<string, number>();
  const saleStatus = new Map<string, number>();
  const tradeStatus = new Map<string, number>();
  const clientTag = new Map<string, number>();
  const repairStatus = new Map<string, number>();
  for (const item of items) {
    bump(inventoryStatus, item.status);
    bump(capacity, item.capacity);
    bump(condition, item.condition);
  }
  for (const sale of sales) bump(saleStatus, sale.status);
  for (const trade of trades) bump(tradeStatus, trade.status);
  for (const client of clients) if (client.tag) bump(clientTag, client.tag);
  for (const order of repairs) bump(repairStatus, order.status);
  return { inventoryStatus, capacity, condition, saleStatus, tradeStatus, clientTag, repairStatus };
}

function countFor(kind: Kind, value: string, counts: Awaited<ReturnType<typeof usageCounts>>) {
  if (kind === "INVENTORY_STATUS") return counts.inventoryStatus.get(value) ?? 0;
  if (kind === "INVENTORY_CAPACITY") return counts.capacity.get(value) ?? 0;
  if (kind === "INVENTORY_CONDITION") return counts.condition.get(value) ?? 0;
  if (kind === "SALE_STATUS") return counts.saleStatus.get(value) ?? 0;
  if (kind === "CLIENT_TAG") return counts.clientTag.get(value) ?? 0;
  if (kind === "REPAIR_STATUS") return counts.repairStatus.get(value) ?? 0;
  return counts.tradeStatus.get(value) ?? 0;
}

export async function listCatalogs(storeId: string) {
  await seedMissing(storeId);
  await retireRepairStatuses(storeId);
  const [rows, counts] = await Promise.all([
    prisma.storeCatalogOption.findMany({
      where: { storeId },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    }),
    usageCounts(storeId),
  ]);
  return {
    meta: META,
    options: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      value: row.value,
      label: row.label,
      color: row.color,
      isSystem: row.isSystem,
      sortOrder: row.sortOrder,
      count: countFor(row.kind, row.value, counts),
    })),
  };
}

async function reassign(tx: Prisma.TransactionClient, storeId: string, kind: Kind, from: string, to: string) {
  if (kind === "INVENTORY_STATUS") {
    await tx.inventoryItem.updateMany({ where: { storeId, status: from }, data: { status: to } });
  } else if (kind === "INVENTORY_CAPACITY") {
    await tx.inventoryItem.updateMany({ where: { storeId, capacity: from }, data: { capacity: to } });
  } else if (kind === "INVENTORY_CONDITION") {
    await tx.inventoryItem.updateMany({ where: { storeId, condition: from }, data: { condition: to } });
  } else if (kind === "SALE_STATUS") {
    await tx.sale.updateMany({ where: { storeId, status: from }, data: { status: to } });
  } else if (kind === "CLIENT_TAG") {
    await tx.client.updateMany({ where: { storeId, tag: from }, data: { tag: to } });
  } else if (kind === "REPAIR_STATUS") {
    await tx.repairOrder.updateMany({ where: { storeId, status: from }, data: { status: to } });
    await tx.repairStatusEvent.updateMany({ where: { storeId, status: from }, data: { status: to } });
  } else {
    await tx.tradeIn.updateMany({ where: { storeId, status: from }, data: { status: to } });
  }
}

export async function saveCatalog(storeId: string, kind: Kind, options: CatalogOptionInput[], deletions: CatalogDeletion[]) {
  const textKind = kind === "INVENTORY_CAPACITY" || kind === "INVENTORY_CONDITION";
  const labelIsValue = textKind || kind === "CLIENT_TAG";
  return prisma.$transaction(async (tx) => {
    const existing = await tx.storeCatalogOption.findMany({ where: { storeId, kind } });
    const removed = new Set<string>();

    for (const deletion of deletions) {
      const row = existing.find((item) => item.value === deletion.value);
      if (!row || removed.has(row.value)) continue;
      if (row.isSystem) throw new CatalogError("Lo usa el sistema: se puede renombrar, no borrar");
      const target = options.find((option) => option.value === deletion.reassignTo
        || (!option.value && option.label.trim() === deletion.reassignTo));
      if (!target || target.value === row.value || deletions.some((item) => item.value === target.value)) {
        throw new CatalogError("Elegí a qué pasar los registros");
      }
      const targetLabel = target.label.trim().slice(0, 20);
      const targetValue = labelIsValue ? targetLabel : (target.value?.trim() || slug(targetLabel));
      if (!targetLabel || targetValue === row.value) throw new CatalogError("Elegí a qué pasar los registros");
      await reassign(tx, storeId, kind, row.value, targetValue);
      await tx.storeCatalogOption.delete({ where: { id: row.id } });
      removed.add(row.value);
    }

    const labels = new Set<string>();
    for (const [index, option] of options.entries()) {
      const label = option.label.trim().slice(0, 20);
      if (!label) throw new CatalogError("Hay uno sin nombre.");
      const key = label.toLowerCase();
      if (labels.has(key)) throw new CatalogError(`«${label}» está repetido.`);
      labels.add(key);
      const color = textKind ? null : (option.color ?? null);
      const current = option.value ? existing.find((item) => item.value === option.value && !removed.has(item.value)) : undefined;
      if (current) {
        if (labelIsValue && current.value !== label) {
          await reassign(tx, storeId, kind, current.value, label);
          await tx.storeCatalogOption.update({
            where: { id: current.id },
            data: { value: label, label, color, sortOrder: index },
          });
        } else {
          await tx.storeCatalogOption.update({
            where: { id: current.id },
            data: { label, color, sortOrder: index },
          });
        }
        continue;
      }
      const value = labelIsValue ? label : (option.value?.trim() || slug(label));
      await tx.storeCatalogOption.create({
        data: { storeId, kind, value, label, color, isSystem: false, sortOrder: index },
      });
    }

    const rows = await tx.storeCatalogOption.findMany({ where: { storeId, kind }, orderBy: { sortOrder: "asc" } });
    if (!rows.length) throw new CatalogError("Tiene que quedar al menos uno.");
    return rows;
  });
}

export function getCatalogErrorStatus(error: unknown) {
  if (error instanceof CatalogError) return error.statusCode;
  return 500;
}

export function isCatalogKind(value: string): value is Kind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}
