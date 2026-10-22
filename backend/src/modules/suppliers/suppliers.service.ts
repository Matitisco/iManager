import type { Prisma } from "@prisma/client";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { calendarDay } from "../periodic-reports/schedule.js";

const ZONE = "America/Argentina/Buenos_Aires";

export interface SupplierInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface SupplierListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  lastPurchaseAt: string | null;
  deviceCount: number;
  problemCount: number;
  deletedAt: string | null;
}

export interface PurchaseItemView {
  id: string;
  model: string;
  capacity: string;
  imei: string;
  status: string;
  cost?: number;
  currency: string | null;
  problem: boolean;
  problemLabel: string | null;
  createdAt: string;
}

export interface PurchaseView {
  id: string;
  purchasedAt: string;
  notes: string | null;
  problemCount: number;
  items: PurchaseItemView[];
}

function blank(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || null;
}

function problemLabel(status: string, inService: boolean) {
  const review = status === "EN_REVISION";
  const rma = status === "EN_RMA";
  if (rma && inService) return "En RMA con el proveedor y en servicio técnico";
  if (rma) return "En RMA con el proveedor";
  if (review && inService) return "En revisión y en servicio técnico";
  if (review) return "En revisión";
  if (inService) return "En servicio técnico";
  return null;
}

async function assertName(storeId: string, name: string, ignoreId?: string, db: Prisma.TransactionClient = prisma) {
  const clash = await db.supplier.findFirst({
    where: {
      storeId,
      deletedAt: null,
      id: ignoreId ? { not: ignoreId } : undefined,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (clash) throw new DomainError("Ya hay un proveedor con ese nombre", 409);
}

function present(row: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  deletedAt: Date | null;
}, counts: { devices: number; problems: number }, lastPurchaseAt: Date | null = null): SupplierListItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    lastPurchaseAt: lastPurchaseAt ? calendarDay(lastPurchaseAt, ZONE) : null,
    deviceCount: counts.devices,
    problemCount: counts.problems,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

async function countsFor(storeId: string, supplierIds: string[]) {
  const devices = new Map<string, number>();
  const problems = new Map<string, number>();
  if (!supplierIds.length) return { devices, problems };
  const items = await prisma.inventoryItem.findMany({
    where: { storeId, supplierId: { in: supplierIds }, archivedAt: null },
    select: { supplierId: true, status: true, imei: true },
  });
  const imeis = [...new Set(items.map((item) => item.imei?.trim() || "").filter(Boolean))];
  const repairs = imeis.length
    ? await prisma.repairOrder.findMany({
      where: { storeId, archivedAt: null, imei: { in: imeis } },
      select: { imei: true },
    })
    : [];
  const inService = new Set(repairs.map((row) => row.imei));
  for (const item of items) {
    if (!item.supplierId) continue;
    devices.set(item.supplierId, (devices.get(item.supplierId) ?? 0) + 1);
    const label = problemLabel(item.status, Boolean(item.imei && inService.has(item.imei)));
    if (label) problems.set(item.supplierId, (problems.get(item.supplierId) ?? 0) + 1);
  }
  return { devices, problems };
}

export async function listSuppliers(storeId: string, archived = false): Promise<SupplierListItem[]> {
  const rows = await prisma.supplier.findMany({
    where: { storeId, deletedAt: archived ? { not: null } : null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const supplierIds = rows.map(row => row.id);
  const [counts, latest] = await Promise.all([
    countsFor(storeId, supplierIds),
    supplierIds.length ? prisma.stockPurchase.groupBy({
      by: ['supplierId'], where: { storeId, supplierId: { in: supplierIds }, deletedAt: null }, _max: { purchasedAt: true },
    }) : [],
  ]);
  const dates = new Map<string | null, Date | null>(latest.map(row => [row.supplierId, row._max.purchasedAt] as const));
  return rows.map((row) => present(row, {
    devices: counts.devices.get(row.id) ?? 0,
    problems: counts.problems.get(row.id) ?? 0,
  }, dates.get(row.id) ?? null));
}

export async function getSupplier(storeId: string, id: string, financials: boolean) {
  const supplier = await prisma.supplier.findFirst({ where: { id, storeId } });
  if (!supplier) return null;
  const [items, purchases, repairs] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { storeId, supplierId: id, archivedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stockPurchase.findMany({
      where: { storeId, supplierId: id, deletedAt: null },
      orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
    }),
    prisma.repairOrder.findMany({
      where: { storeId, archivedAt: null, imei: { not: "" } },
      select: { imei: true },
    }),
  ]);
  const inService = new Set(repairs.map((row) => row.imei));
  const viewItem = (item: (typeof items)[number]): PurchaseItemView => {
    const label = problemLabel(item.status, Boolean(item.imei && inService.has(item.imei)));
    const view: PurchaseItemView = {
      id: item.id,
      model: item.model,
      capacity: item.capacity,
      imei: item.imei ?? "",
      status: item.status,
      currency: item.currency,
      problem: Boolean(label),
      problemLabel: label,
      createdAt: item.createdAt.toISOString(),
    };
    if (financials) view.cost = Number(item.cost);
    return view;
  };
  const byPurchase = new Map<string, PurchaseItemView[]>();
  const loose: PurchaseItemView[] = [];
  for (const item of items) {
    const view = viewItem(item);
    if (item.stockPurchaseId) {
      const bucket = byPurchase.get(item.stockPurchaseId) ?? [];
      bucket.push(view);
      byPurchase.set(item.stockPurchaseId, bucket);
    } else loose.push(view);
  }
  const purchaseViews: PurchaseView[] = purchases.map((purchase) => {
    const group = byPurchase.get(purchase.id) ?? [];
    return {
      id: purchase.id,
      purchasedAt: calendarDay(purchase.purchasedAt, ZONE),
      notes: purchase.notes,
      problemCount: group.filter((item) => item.problem).length,
      items: group,
    };
  });
  if (loose.length) {
    purchaseViews.push({
      id: "sin-lote",
      purchasedAt: "",
      notes: "Equipos con proveedor y sin compra agrupada.",
      problemCount: loose.filter((item) => item.problem).length,
      items: loose,
    });
  }
  const problemCount = items.filter((item) => problemLabel(item.status, Boolean(item.imei && inService.has(item.imei)))).length;
  return {
    ...present(supplier, { devices: items.length, problems: problemCount }, purchases[0]?.purchasedAt ?? null),
    purchases: purchaseViews,
  };
}

export async function createSupplier(storeId: string, input: SupplierInput, actor: Actor) {
  const name = input.name.trim();
  await assertName(storeId, name);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: {
        storeId,
        name,
        phone: blank(input.phone),
        email: blank(input.email),
        notes: blank(input.notes),
      },
    });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "supplier.created",
      entityType: "supplier",
      entityId: created.id,
      entityLabel: created.name,
      detail: `Quedó registrado el proveedor ${created.name}.`,
    });
    return created;
  });
  return present(row, { devices: 0, problems: 0 });
}

export async function updateSupplier(storeId: string, id: string, input: SupplierInput, actor: Actor) {
  const row = await withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Supplier" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`;
    const existing = await tx.supplier.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!existing) return null;
    const name = input.name.trim();
    await assertName(storeId, name, id, tx);
    const updated = await tx.supplier.update({
      where: { id },
      data: {
        name,
        phone: blank(input.phone),
        email: blank(input.email),
        notes: blank(input.notes),
      },
    });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "supplier.updated",
      entityType: "supplier",
      entityId: id,
      entityLabel: updated.name,
      detail: `Quedaron actualizados los datos del proveedor ${updated.name}.`,
    });
    return updated;
  });
  if (!row) return null;
  const counts = await countsFor(storeId, [id]);
  return present(row, { devices: counts.devices.get(id) ?? 0, problems: counts.problems.get(id) ?? 0 });
}

export async function archiveSupplier(storeId: string, id: string, actor: Actor) {
  return withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Supplier" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`;
    const existing = await tx.supplier.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!existing) return false;
    await tx.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.name },
    });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "supplier.archived",
      entityType: "supplier",
      entityId: id,
      entityLabel: existing.name,
      detail: `Quedó archivado el proveedor ${existing.name}. Los equipos conservan el origen.`,
    });
    return true;
  });
}

export async function restoreSupplier(storeId: string, id: string, actor: Actor) {
  const row = await withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Supplier" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`;
    const existing = await tx.supplier.findFirst({ where: { id, storeId, deletedAt: { not: null } } });
    if (!existing) return null;
    await assertName(storeId, existing.name, id, tx);
    const restored = await tx.supplier.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null },
    });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "supplier.restored",
      entityType: "supplier",
      entityId: id,
      entityLabel: restored.name,
      detail: `Volvió a estar activo el proveedor ${restored.name}.`,
    });
    return restored;
  });
  if (!row) return null;
  const counts = await countsFor(storeId, [id]);
  return present(row, { devices: counts.devices.get(id) ?? 0, problems: counts.problems.get(id) ?? 0 });
}
