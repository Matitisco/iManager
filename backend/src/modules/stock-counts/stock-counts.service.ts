import { Prisma } from "@prisma/client";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import type { Actor } from "../audit/audit.js";
import { writeAudit } from "../audit/audit.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { archiveInventoryItems } from "../inventory/inventory.service.js";
import { canManageStockCount } from "./access.js";
import {
  classifyClose,
  classifyScan,
  isCountableStatus,
  normalizeImei,
  type CloseResult,
  type ResultLine,
  type ScanResult,
  type SnapshotRow,
} from "./classify.js";
import {
  adjustedClause,
  closedClause,
  closedSubtitle,
  clockIn,
  openedClause,
  openSubtitle,
  recordedClause,
  summaryLine,
} from "./copy.js";

type Member = { userId: string; role: string; sections?: unknown };

type CountRow = {
  id: string;
  storeId: string;
  status: string;
  startedById: string;
  startedByName: string;
  closedByName: string | null;
  closedAt: Date | null;
  resolution: string | null;
  excludedNoImei: number;
  result: Prisma.JsonValue;
  createdAt: Date;
};

export type BlindScan = {
  id: string;
  createdAt: string;
  result: ScanResult;
  imei: string;
  model: string | null;
  capacity: string | null;
  color: string | null;
};

export type BlindCount = {
  id: string;
  subtitle: string;
  mine: number;
  total: number;
  scans: BlindScan[];
};

export type CountListItem = {
  id: string;
  status: "OPEN" | "CLOSED";
  resolution: "ADJUSTED" | "RECORDED" | null;
  subtitle: string;
  summary: string | null;
  startedAt: string;
  closedAt: string | null;
};

const COUNT_SELECT = {
  id: true,
  storeId: true,
  status: true,
  startedById: true,
  startedByName: true,
  closedByName: true,
  closedAt: true,
  resolution: true,
  excludedNoImei: true,
  result: true,
  createdAt: true,
} as const;

function asResult(value: Prisma.JsonValue): CloseResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<CloseResult>;
  if (!Array.isArray(row.matched) || !Array.isArray(row.missing) || !Array.isArray(row.surplus) || !Array.isArray(row.sold)) return null;
  return row as CloseResult;
}

async function storeZone(storeId: string, db: Prisma.TransactionClient = prisma) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { timezone: true, currency: true } });
  return { timeZone: store?.timezone || "America/Argentina/Buenos_Aires", currency: store?.currency || "ARS" };
}

async function counterNames(stockCountId: string) {
  const scans = await prisma.stockCountScan.findMany({
    where: { stockCountId },
    select: { scannedByName: true },
    orderBy: { createdAt: "asc" },
  });
  const names: string[] = [];
  for (const scan of scans) {
    if (!names.includes(scan.scannedByName)) names.push(scan.scannedByName);
  }
  return names;
}

function listItem(row: CountRow, timeZone: string, counters: string[]): CountListItem {
  const result = row.status === "CLOSED" ? asResult(row.result) : null;
  const subtitle = row.status === "OPEN"
    ? openSubtitle({ starter: row.startedByName, at: row.createdAt, timeZone, counters })
    : closedSubtitle({
      at: row.closedAt ?? row.createdAt,
      timeZone,
      counters: result?.counters ?? counters,
      scanCount: result?.scanCount ?? 0,
      withScans: false,
    });
  return {
    id: row.id,
    status: row.status === "OPEN" ? "OPEN" : "CLOSED",
    resolution: row.resolution === "ADJUSTED" || row.resolution === "RECORDED" ? row.resolution : null,
    subtitle,
    summary: result ? summaryLine({
      matched: result.matched.length,
      missing: result.missing.length,
      surplus: result.surplus.length,
      sold: result.sold.length,
    }) : null,
    startedAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

export async function listStockCounts(storeId: string): Promise<CountListItem[]> {
  const { timeZone } = await storeZone(storeId);
  const rows = await prisma.stockCount.findMany({
    where: { storeId },
    select: COUNT_SELECT,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const items: CountListItem[] = [];
  for (const row of rows) {
    const counters = row.status === "OPEN" ? await counterNames(row.id) : (asResult(row.result)?.counters ?? []);
    items.push(listItem(row, timeZone, counters));
  }
  return items;
}

export async function previewStockCount(storeId: string) {
  const rows = await prisma.inventoryItem.findMany({
    where: { storeId, archivedAt: null },
    select: { imei: true, status: true },
  });
  const countable = rows.filter((row) => isCountableStatus(row.status));
  const excludedNoImei = countable.filter((row) => !normalizeImei(row.imei)).length;
  return {
    excludedNoImei,
    scope: "Disponibles, reservados y en revisión",
    counters: "Todo el equipo con Inventario",
  };
}

async function loadCount(storeId: string, id: string) {
  return prisma.stockCount.findFirst({ where: { id, storeId }, select: COUNT_SELECT });
}

export async function blindStockCount(storeId: string, id: string, userId: string): Promise<BlindCount | null> {
  const row = await loadCount(storeId, id);
  if (!row || row.status !== "OPEN") return null;
  const { timeZone } = await storeZone(storeId);
  const scans = await prisma.stockCountScan.findMany({
    where: { stockCountId: id, storeId },
    orderBy: { createdAt: "desc" },
  });
  const counters = [...new Set([...scans].reverse().map((scan) => scan.scannedByName))];
  const counting = scans.filter((scan) => scan.counts);
  return {
    id: row.id,
    subtitle: openSubtitle({ starter: row.startedByName, at: row.createdAt, timeZone, counters }),
    mine: counting.filter((scan) => scan.scannedById === userId).length,
    total: counting.length,
    scans: scans.filter((scan) => scan.scannedById === userId).map((scan) => ({
      id: scan.id,
      createdAt: scan.createdAt.toISOString(),
      result: scan.result as ScanResult,
      imei: scan.imei,
      model: scan.model,
      capacity: scan.capacity,
      color: scan.color,
    })),
  };
}

export async function currentStockCount(storeId: string, userId: string) {
  const open = await prisma.stockCount.findFirst({
    where: { storeId, status: "OPEN" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!open) return null;
  return blindStockCount(storeId, open.id, userId);
}

export async function closedStockCount(storeId: string, id: string) {
  const row = await loadCount(storeId, id);
  if (!row || row.status !== "CLOSED") return null;
  const result = asResult(row.result);
  if (!result) return null;
  const { timeZone } = await storeZone(storeId);
  return {
    ...listItem(row, timeZone, result.counters),
    subtitle: closedSubtitle({
      at: row.closedAt ?? row.createdAt,
      timeZone,
      counters: result.counters,
      scanCount: result.scanCount,
    }),
    excludedNoImei: result.excludedNoImei,
    scanCount: result.scanCount,
    buckets: {
      matched: result.matched,
      missing: result.missing,
      surplus: result.surplus,
      sold: result.sold,
    },
  };
}

function deviceTitle(model: string, capacity: string) {
  return [model, capacity].filter(Boolean).join(" ").trim() || "Equipo";
}

export async function startStockCount(storeId: string, member: Member, actor: Actor) {
  if (!canManageStockCount(member)) throw new DomainError("Solo el propietario o un socio puede iniciar el control", 403);
  const { timeZone, currency } = await storeZone(storeId);
  const rows = await prisma.inventoryItem.findMany({
    where: { storeId, archivedAt: null },
    select: { id: true, imei: true, model: true, capacity: true, color: true, status: true, price: true, currency: true },
  });
  const countable = rows.filter((row) => isCountableStatus(row.status));
  const snapshot = countable.flatMap((row) => {
    const imei = normalizeImei(row.imei);
    if (!imei) return [];
    return [{
      inventoryItemId: row.id,
      imei,
      model: row.model,
      capacity: row.capacity,
      color: row.color,
      statusAtSnapshot: row.status,
      price: Number(row.price),
      currency: row.currency ?? currency,
    }];
  });
  const excludedNoImei = countable.length - snapshot.length;
  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
    const open = await tx.stockCount.findFirst({ where: { storeId, status: "OPEN" }, select: { id: true } });
    if (open) throw new DomainError("Ya hay un control de stock abierto", 409);
    const count = await tx.stockCount.create({
      data: {
        storeId,
        startedById: actor.userId,
        startedByName: actor.name,
        excludedNoImei,
      },
    });
    if (snapshot.length) {
      await tx.stockCountExpected.createMany({
        data: snapshot.map((row) => ({
          stockCountId: count.id,
          storeId,
          inventoryItemId: row.inventoryItemId,
          imei: row.imei,
          model: row.model,
          capacity: row.capacity,
          color: row.color,
          statusAtSnapshot: row.statusAtSnapshot,
          price: new Prisma.Decimal(row.price),
          currency: row.currency,
        })),
      });
    }
    const at = count.createdAt;
    await writeAudit(tx, {
      storeId,
      actor,
      action: "stockcount.opened",
      entityType: "stockcount",
      entityId: count.id,
      entityLabel: "Control de stock",
      detail: openedClause(at, timeZone),
      changes: [{ field: "when", label: "Hora", before: null, after: clockIn(at, timeZone) }],
    });
    return count;
  });
  const blind = await blindStockCount(storeId, created.id, actor.userId);
  if (!blind) throw new DomainError("No se pudo abrir el control", 500);
  return blind;
}

export async function scanStockCount(storeId: string, id: string, userId: string, actor: Actor, rawImei: string) {
  const imei = normalizeImei(rawImei);
  if (!imei) throw new DomainError("El IMEI tiene 15 dígitos", 400);
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StockCount" WHERE "id" = ${id} AND "storeId" = ${storeId} AND "status" = 'OPEN' FOR UPDATE`;
    if (!locked.length) throw new DomainError("No hay un control abierto", 404);
    const prior = await tx.stockCountScan.findFirst({
      where: { stockCountId: id, storeId, imei, counts: true },
      select: { id: true },
    });
    const snapshot = await tx.stockCountExpected.findFirst({ where: { stockCountId: id, storeId, imei } });
    const live = await tx.inventoryItem.findFirst({
      where: { storeId, imei, archivedAt: null },
      select: { id: true, status: true, model: true, capacity: true, color: true, archivedAt: true },
    });
    const classified = classifyScan({
      alreadyCounted: Boolean(prior),
      snapshot: snapshot ? {
        inventoryItemId: snapshot.inventoryItemId,
        imei: snapshot.imei,
        model: snapshot.model,
        capacity: snapshot.capacity,
        color: snapshot.color,
        statusAtSnapshot: snapshot.statusAtSnapshot,
        price: Number(snapshot.price),
        currency: snapshot.currency,
      } : null,
      live,
    });
    await tx.stockCountScan.create({
      data: {
        stockCountId: id,
        storeId,
        scannedById: userId,
        scannedByName: actor.name,
        imei,
        result: classified.result,
        counts: classified.counts,
        inventoryItemId: classified.inventoryItemId,
        model: classified.model,
        capacity: classified.capacity,
        color: classified.color,
      },
    });
  });
  const blind = await blindStockCount(storeId, id, userId);
  if (!blind) throw new DomainError("No hay un control abierto", 404);
  return blind;
}

async function buildCloseResult(db: Prisma.TransactionClient | typeof prisma, storeId: string, id: string, excludedNoImei: number): Promise<CloseResult> {
  const [expected, scans] = await Promise.all([
    db.stockCountExpected.findMany({ where: { stockCountId: id, storeId } }),
    db.stockCountScan.findMany({ where: { stockCountId: id, storeId }, orderBy: { createdAt: "asc" } }),
  ]);
  const live = expected.length
    ? await db.inventoryItem.findMany({
      where: { storeId, id: { in: expected.map((row) => row.inventoryItemId) } },
      select: { id: true, status: true, archivedAt: true },
    })
    : [];
  const snapshot: SnapshotRow[] = expected.map((row) => ({
    inventoryItemId: row.inventoryItemId,
    imei: row.imei,
    model: row.model,
    capacity: row.capacity,
    color: row.color,
    statusAtSnapshot: row.statusAtSnapshot,
    price: Number(row.price),
    currency: row.currency,
  }));
  return classifyClose({
    expected: snapshot,
    scans: scans.map((scan) => ({
      imei: scan.imei,
      result: scan.result as ScanResult,
      counts: scan.counts,
      inventoryItemId: scan.inventoryItemId,
      model: scan.model,
      capacity: scan.capacity,
      color: scan.color,
      scannedByName: scan.scannedByName,
    })),
    live,
    excludedNoImei,
  });
}

export async function closeStockCount(storeId: string, id: string, member: Member, actor: Actor) {
  if (!canManageStockCount(member)) throw new DomainError("Solo el propietario o un socio puede cerrar el control", 403);
  const { timeZone } = await storeZone(storeId);
  const existing = await loadCount(storeId, id);
  if (!existing || existing.status !== "OPEN") throw new DomainError("No hay un control abierto", 404);
  const closedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StockCount" WHERE "id" = ${id} AND "storeId" = ${storeId} AND "status" = 'OPEN' FOR UPDATE`;
    if (!locked.length) throw new DomainError("No hay un control abierto", 404);
    const result = await buildCloseResult(tx, storeId, id, existing.excludedNoImei);
    await tx.stockCount.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt,
        closedById: actor.userId,
        closedByName: actor.name,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "stockcount.closed",
      entityType: "stockcount",
      entityId: id,
      entityLabel: "Control de stock",
      detail: closedClause({
        at: closedAt,
        timeZone,
        counters: result.counters,
        matched: result.matched.length,
        missing: result.missing.length,
        surplus: result.surplus.length,
        sold: result.sold.length,
      }),
      changes: [
        { field: "counters", label: "Contaron", before: null, after: result.counters.join(", ") || "Nadie" },
        { field: "matched", label: "Coinciden", before: null, after: String(result.matched.length) },
        { field: "missing", label: "Faltan", before: null, after: String(result.missing.length) },
        { field: "surplus", label: "Sobran", before: null, after: String(result.surplus.length) },
        { field: "sold", label: "Figuran vendidos", before: null, after: String(result.sold.length) },
        { field: "when", label: "Hora", before: null, after: clockIn(closedAt, timeZone) },
      ],
    });
  });
  const closed = await closedStockCount(storeId, id);
  if (!closed) throw new DomainError("No se pudo cerrar el control", 500);
  return closed;
}

function sameIds(lines: ResultLine[], ids: string[]) {
  const allowed = new Set(lines.map((line) => line.inventoryItemId).filter((value): value is string => Boolean(value)));
  return ids.filter((id) => allowed.has(id));
}

export async function resolveStockCount(
  storeId: string,
  id: string,
  member: Member,
  actor: Actor,
  input: { mode: "ADJUST" | "RECORD"; missingIds: string[]; surplusImeis: string[] },
) {
  if (!canManageStockCount(member)) throw new DomainError("Solo el propietario o un socio puede ajustar el control", 403);
  await withSerializableRetry(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "StockCount" WHERE "storeId" = ${storeId} AND "id" = ${id} FOR UPDATE`;
    const row = await tx.stockCount.findFirst({ where: { storeId, id }, select: COUNT_SELECT });
    if (!row || row.status !== "CLOSED") throw new DomainError("El control no está cerrado", 404);
    if (row.resolution) throw new DomainError("Este control ya quedó registrado", 409);
    const result = asResult(row.result);
    if (!result) throw new DomainError("El control no tiene resultado", 409);
    const { timeZone, currency } = await storeZone(storeId, tx);

    if (input.mode === "RECORD") {
      const at = new Date();
      const updated = await tx.stockCount.updateMany({
        where: { id, storeId, status: "CLOSED", resolution: null },
        data: { resolution: "RECORDED" },
      });
      if (!updated.count) throw new DomainError("Este control ya quedó registrado", 409);
      await writeAudit(tx, {
        storeId,
        actor,
        action: "stockcount.recorded",
        entityType: "stockcount",
        entityId: id,
        entityLabel: "Control de stock",
        detail: recordedClause(at, timeZone),
        changes: [{ field: "resolution", label: "Resolución", before: null, after: "Solo registrado" }],
      });
      return;
    }

    const soldIds = new Set(result.sold.map((line) => line.inventoryItemId).filter((value): value is string => Boolean(value)));
    if (input.missingIds.some((itemId) => soldIds.has(itemId))) {
      throw new DomainError("Los que figuran vendidos no se ajustan desde el conteo", 400);
    }
    const missingIds = [...new Set(sameIds(result.missing, input.missingIds))];
    const surplusAllowed = new Set(result.surplus.map((line) => line.imei));
    const surplusImeis = [...new Set(input.surplusImeis.map((value) => normalizeImei(value)).filter((value) => surplusAllowed.has(value)))];

    await archiveInventoryItems(tx, storeId, missingIds, actor, {
      reason: "Faltante", source: "app", batchId: missingIds.length > 1 ? id : null,
      batchSize: missingIds.length > 1 ? missingIds.length : null,
    });
    const existingItems = await tx.inventoryItem.findMany({ where: { storeId, imei: { in: surplusImeis } }, select: { imei: true, archivedAt: true } });
    const byImei = new Map(existingItems.map(item => [item.imei, item]));
    let loaded = 0;
    for (const imei of surplusImeis) {
      const existing = byImei.get(imei);
      if (existing?.archivedAt) throw new DomainError("Ese IMEI está archivado. Restauralo desde Archivados.", 409);
      if (existing) continue;
      const created = await tx.inventoryItem.create({
        data: {
          storeId,
          imei,
          model: "Sin modelo",
          capacity: "",
          color: "",
          condition: "",
          grade: "",
          batteryHealth: "",
          cost: new Prisma.Decimal(0),
          price: new Prisma.Decimal(0),
          currency,
          status: "DISPONIBLE",
          needsCompletion: true,
          customFields: {},
        },
      });
      loaded += 1;
      await writeAudit(tx, {
        storeId,
        actor,
        action: "inventory.created",
        entityType: "inventory",
        entityId: created.id,
        entityLabel: deviceTitle(created.model, created.capacity),
        detail: "Cargado desde el control de stock",
      });
    }

    const at = new Date();
    const updated = await tx.stockCount.updateMany({
      where: { id, storeId, status: "CLOSED", resolution: null },
      data: { resolution: "ADJUSTED" },
    });
    if (!updated.count) throw new DomainError("Este control ya quedó registrado", 409);
    await writeAudit(tx, {
      storeId,
      actor,
      action: "stockcount.adjusted",
      entityType: "stockcount",
      entityId: id,
      entityLabel: "Control de stock",
      detail: adjustedClause({ at, timeZone, archived: missingIds.length, loaded }),
      changes: [
        { field: "archived", label: "Archivados", before: null, after: String(missingIds.length) },
        { field: "loaded", label: "Cargados", before: null, after: String(loaded) },
        { field: "reason", label: "Motivo", before: null, after: "Faltante" },
      ],
    });
  });
  return closedStockCount(storeId, id);
}
