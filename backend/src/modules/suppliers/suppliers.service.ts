import type { Prisma } from "@prisma/client";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { calendarDay } from "../periodic-reports/schedule.js";
import { claimsForDevices, loadProblems, summarizeProblems, type ProblemDevice, type ProblemSnapshot, type ProblemSummary } from "./problems.js";

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
  deviceCount: number;
  problemCount: number;
  claimCount: number;
  lastPurchasedAt: string | null;
  deletedAt: string | null;
}

export interface PurchaseItemView {
  id: string;
  model: string;
  capacity: string;
  color: string;
  imei: string;
  status: string;
  cost?: number;
  currency: string | null;
  problem: boolean;
  problemLabel: string | null;
  createdAt: string;
}

export interface PurchaseSummaryView {
  id: string;
  name: string | null;
  purchasedAt: string;
  notes: string | null;
  devices: number;
  problemCount: number;
  claimCount: number;
  /** Present only with financial access. Null for mixed currencies; use costTotals then. */
  totalCost?: number | null;
  currency?: string | null;
  costTotals?: Array<{ currency: string; totalCost: number }>;
}

export interface PurchaseView extends PurchaseSummaryView {
  items: PurchaseItemView[];
}

export interface PurchaseDetailView extends PurchaseView {
  summary: ProblemSummary;
}

export interface SupplierDetailView extends SupplierListItem {
  stockCount: number;
  claimedDeviceCount: number;
  costTotals?: Array<{ currency: string; totalCost: number }>;
  purchases: Array<PurchaseSummaryView & { items?: PurchaseItemView[] }>;
}

function blank(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || null;
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
}, counts: { devices: number; problems: number; claims?: number; lastPurchasedAt?: string | null }): SupplierListItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    deviceCount: counts.devices,
    problemCount: counts.problems,
    claimCount: counts.claims ?? 0,
    lastPurchasedAt: counts.lastPurchasedAt ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

async function countsFor(storeId: string, supplierIds: string[]) {
  const devices = new Map<string, number>();
  const problems = new Map<string, number>();
  const claims = new Map<string, number>();
  const lastPurchasedAt = new Map<string, string>();
  if (!supplierIds.length) return { devices, problems, claims, lastPurchasedAt };
  const [snapshot, purchases] = await Promise.all([
    loadProblems(storeId, { supplierId: { in: supplierIds } }),
    prisma.stockPurchase.groupBy({
      by: ["supplierId"], where: { storeId, supplierId: { in: supplierIds }, deletedAt: null }, _max: { purchasedAt: true },
    }),
  ]);
  const groups = new Map<string, ProblemDevice[]>();
  for (const item of snapshot.items) {
    if (!item.supplierId) continue;
    const group = groups.get(item.supplierId) ?? [];
    group.push(item);
    groups.set(item.supplierId, group);
  }
  // Count claims assigned directly to the supplier, including claims without a current stock item.
  const supplierClaims = new Map<string, Set<string>>();
  for (const claim of snapshot.claims) {
    if (!claim.supplierId) continue;
    const ids = supplierClaims.get(claim.supplierId) ?? new Set<string>();
    ids.add(claim.id);
    supplierClaims.set(claim.supplierId, ids);
  }
  for (const [id, items] of groups) {
    const summary = summarizeProblems(items, snapshot.problems);
    devices.set(id, summary.devices);
    problems.set(id, summary.problems);
    const ids = supplierClaims.get(id) ?? new Set<string>();
    for (const claim of claimsForDevices(items, snapshot.problems)) ids.add(claim.id);
    supplierClaims.set(id, ids);
  }
  for (const [id, ids] of supplierClaims) claims.set(id, ids.size);
  for (const row of purchases) if (row._max.purchasedAt) lastPurchasedAt.set(row.supplierId, calendarDay(row._max.purchasedAt, ZONE));
  return { devices, problems, claims, lastPurchasedAt };
}

export async function listSuppliers(storeId: string, archived = false): Promise<SupplierListItem[]> {
  const rows = await prisma.supplier.findMany({
    where: { storeId, deletedAt: archived ? { not: null } : null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const counts = await countsFor(storeId, rows.map(row => row.id));
  return rows.map(row => present(row, {
    devices: counts.devices.get(row.id) ?? 0,
    problems: counts.problems.get(row.id) ?? 0,
    claims: counts.claims.get(row.id) ?? 0,
    lastPurchasedAt: counts.lastPurchasedAt.get(row.id) ?? null,
  }));
}

type PurchaseRow = { id: string; name: string | null; purchasedAt: Date; notes: string | null };
type Cost = { id: string; cost: Prisma.Decimal; currency: string | null };

async function purchaseData(storeId: string, supplierId: string, financials: boolean, purchaseId?: string) {
  const [snapshot, purchases, costs, store] = await Promise.all([
    loadProblems(storeId, { supplierId, ...(purchaseId ? { stockPurchaseId: purchaseId } : {}) }),
    prisma.stockPurchase.findMany({
      where: { storeId, supplierId, deletedAt: null, ...(purchaseId ? { id: purchaseId } : {}) },
      orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, purchasedAt: true, notes: true },
    }),
    financials ? prisma.inventoryItem.findMany({
      where: { storeId, supplierId, archivedAt: null, ...(purchaseId ? { stockPurchaseId: purchaseId } : {}) },
      select: { id: true, cost: true, currency: true },
    }) : [],
    financials ? prisma.store.findUnique({ where: { id: storeId }, select: { currency: true } }) : null,
  ]);
  return { snapshot, purchases, costs: new Map(costs.map(row => [row.id, row])), currency: store?.currency ?? "ARS" };
}

function purchaseSummary(purchase: PurchaseRow, items: ProblemDevice[], snapshot: ProblemSnapshot, costs: Map<string, Cost>, currency: string, financials: boolean): PurchaseSummaryView {
  const summary = summarizeProblems(items, snapshot.problems);
  const view: PurchaseSummaryView = {
    id: purchase.id, name: purchase.name, purchasedAt: calendarDay(purchase.purchasedAt, ZONE), notes: purchase.notes,
    devices: summary.devices, problemCount: summary.problems, claimCount: claimsForDevices(items, snapshot.problems).length,
  };
  if (financials) {
    const totals = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const cost = costs.get(item.id);
      if (!cost) continue;
      const unit = cost.currency ?? currency;
      totals.set(unit, (totals.get(unit) ?? cost.cost.mul(0)).add(cost.cost));
    }
    view.costTotals = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([unit, total]) => ({ currency: unit, totalCost: total.toNumber() }));
    view.totalCost = totals.size > 1 ? null : view.costTotals[0]?.totalCost ?? 0;
    view.currency = totals.size > 1 ? null : view.costTotals[0]?.currency ?? currency;
  }
  return view;
}

function purchaseItem(item: ProblemDevice, snapshot: ProblemSnapshot, costs: Map<string, Cost>, legacy = false): PurchaseItemView {
  const state = snapshot.problems.get(item.id);
  let label = state?.label ?? null;
  if (legacy) {
    if (item.status === "EN_RMA") label = state?.inService ? "En RMA con el proveedor y en servicio técnico" : "En RMA con el proveedor";
    else if (item.status === "EN_REVISION" && state?.inService) label = "En revisión y en servicio técnico";
  }
  const view: PurchaseItemView = {
    id: item.id, model: item.model, capacity: item.capacity, color: item.color, imei: item.imei ?? "", status: item.status,
    currency: item.currency,
    problem: state?.problem ?? false,
    problemLabel: label,
    createdAt: item.createdAt.toISOString(),
  };
  const cost = costs.get(item.id);
  if (cost) view.cost = cost.cost.toNumber();
  return view;
}

function groupPurchases(items: ProblemDevice[]) {
  const groups = new Map<string, ProblemDevice[]>();
  for (const item of items) {
    const id = item.stockPurchaseId ?? "sin-lote";
    const group = groups.get(id) ?? [];
    group.push(item);
    groups.set(id, group);
  }
  return groups;
}

/** Lightweight complete history; device rows are only returned by the purchase-detail endpoint. */
export async function listSupplierPurchases(storeId: string, supplierId: string, financials: boolean): Promise<PurchaseSummaryView[] | null> {
  if (!await prisma.supplier.findFirst({ where: { id: supplierId, storeId }, select: { id: true } })) return null;
  const { snapshot, purchases, costs, currency } = await purchaseData(storeId, supplierId, financials);
  const groups = groupPurchases(snapshot.items);
  return purchases.map(purchase => purchaseSummary(purchase, groups.get(purchase.id) ?? [], snapshot, costs, currency, financials));
}

export async function getSupplierPurchase(storeId: string, supplierId: string, purchaseId: string, financials: boolean): Promise<PurchaseDetailView | null> {
  const { snapshot, purchases, costs, currency } = await purchaseData(storeId, supplierId, financials, purchaseId);
  const purchase = purchases[0];
  if (!purchase) return null;
  return {
    ...purchaseSummary(purchase, snapshot.items, snapshot, costs, currency, financials),
    items: snapshot.items.map(item => purchaseItem(item, snapshot, costs)),
    summary: summarizeProblems(snapshot.items, snapshot.problems),
  };
}

export async function getSupplier(storeId: string, id: string, financials: boolean, includeItems = true): Promise<SupplierDetailView | null> {
  const supplier = await prisma.supplier.findFirst({ where: { id, storeId } });
  if (!supplier) return null;
  const { snapshot, purchases, costs, currency } = await purchaseData(storeId, id, financials);
  const groups = groupPurchases(snapshot.items);
  const purchaseViews = purchases.map(purchase => {
    const items = groups.get(purchase.id) ?? [];
    return {
      ...purchaseSummary(purchase, items, snapshot, costs, currency, financials),
      ...(includeItems ? { items: items.map(item => purchaseItem(item, snapshot, costs, true)) } : {}),
    };
  });
  // Keep the existing synthetic group only for the legacy response; it is never a purchase/pattern.
  const loose = groups.get("sin-lote") ?? [];
  if (includeItems && loose.length) purchaseViews.push({
    ...purchaseSummary({ id: "sin-lote", name: null, purchasedAt: new Date(0), notes: "Equipos con proveedor y sin compra agrupada." }, loose, snapshot, costs, currency, financials),
    purchasedAt: "", items: loose.map(item => purchaseItem(item, snapshot, costs, true)),
  });
  const claimIds = new Set(snapshot.claims.filter(claim => claim.supplierId === id).map(claim => claim.id));
  for (const claim of claimsForDevices(snapshot.items, snapshot.problems)) claimIds.add(claim.id);
  const summary = summarizeProblems(snapshot.items, snapshot.problems);
  // Include ungrouped devices too; keep currencies separate and costs permission-gated.
  const totals = new Map<string, Prisma.Decimal>();
  for (const cost of costs.values()) {
    const unit = cost.currency ?? currency;
    totals.set(unit, (totals.get(unit) ?? cost.cost.mul(0)).add(cost.cost));
  }
  return {
    ...present(supplier, { ...summary, claims: claimIds.size, lastPurchasedAt: purchases[0] ? calendarDay(purchases[0].purchasedAt, ZONE) : null }),
    stockCount: snapshot.items.filter(item => item.status !== "VENDIDO").length,
    claimedDeviceCount: snapshot.items.filter(item => snapshot.problems.get(item.id)?.claims.length).length,
    ...(financials ? { costTotals: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([unit, total]) => ({ currency: unit, totalCost: total.toNumber() })) } : {}),
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
  return present(row, { devices: counts.devices.get(id) ?? 0, problems: counts.problems.get(id) ?? 0, claims: counts.claims.get(id) ?? 0, lastPurchasedAt: counts.lastPurchasedAt.get(id) ?? null });
}

export async function archiveSupplier(storeId: string, id: string, actor: Actor, reason?: string | null) {
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
      reason,
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
  return present(row, { devices: counts.devices.get(id) ?? 0, problems: counts.problems.get(id) ?? 0, claims: counts.claims.get(id) ?? 0, lastPurchasedAt: counts.lastPurchasedAt.get(id) ?? null });
}
