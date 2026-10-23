import type { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

// Match the inventory/returns modules: archived devices and cancelled claims do not participate.
export const activeClaims = { deletedAt: null, status: { not: "ANULADO" } } satisfies Prisma.ReturnCaseWhereInput;

const deviceSelect = {
  id: true, model: true, capacity: true, color: true, currency: true, imei: true, status: true,
  supplierId: true, stockPurchaseId: true, createdAt: true,
  supplier: { select: { name: true } },
  stockPurchase: { select: { id: true, name: true, purchasedAt: true, notes: true, deletedAt: true } },
} satisfies Prisma.InventoryItemSelect;
const claimSelect = {
  id: true, inventoryItemId: true, supplierId: true, imei: true, caseNumber: true,
  deviceLabel: true, reason: true, status: true, rmaStatus: true, openedAt: true, clientName: true,
} satisfies Prisma.ReturnCaseSelect;

export type ProblemDevice = Prisma.InventoryItemGetPayload<{ select: typeof deviceSelect }>;
export type ProblemClaim = Prisma.ReturnCaseGetPayload<{ select: typeof claimSelect }>;
export interface ProblemSummary { problems: number; devices: number }

/** Shared short label; status has priority, then claim, then open repair. */
export function deviceProblemLabel(status: string, hasClaim: boolean, inService: boolean): string | null {
  if (status === "EN_RMA") return "En RMA";
  if (status === "EN_REVISION") return "En revisión";
  if (hasClaim) return "Reclamo";
  if (inService) return "En servicio técnico";
  return null;
}

const imeiKey = (supplierId: string, imei: string) => JSON.stringify([supplierId, imei.trim()]);

/** Index once, then O(devices + matching claims). A claim can match both paths, but counts once. */
export function indexProblems<T extends Pick<ProblemDevice, "id" | "supplierId" | "imei" | "status">>(
  items: T[], claims: ProblemClaim[], repairs: { imei: string }[],
) {
  const byId = new Map<string, Map<string, ProblemClaim>>();
  const byImei = new Map<string, Map<string, ProblemClaim>>();
  const append = (map: Map<string, Map<string, ProblemClaim>>, key: string, claim: ProblemClaim) => {
    let bucket = map.get(key);
    if (!bucket) { bucket = new Map(); map.set(key, bucket); }
    bucket.set(claim.id, claim);
  };
  for (const claim of claims) {
    if (claim.inventoryItemId) append(byId, claim.inventoryItemId, claim);
    if (claim.supplierId && claim.imei.trim()) append(byImei, imeiKey(claim.supplierId, claim.imei), claim);
  }
  const inService = new Set(repairs.map(repair => repair.imei.trim()).filter(Boolean));
  return new Map(items.map(item => {
    const matched = new Map(byId.get(item.id));
    if (item.supplierId && item.imei?.trim()) {
      for (const [id, claim] of byImei.get(imeiKey(item.supplierId, item.imei)) ?? []) matched.set(id, claim);
    }
    const repairing = Boolean(item.imei?.trim() && inService.has(item.imei.trim()));
    const label = deviceProblemLabel(item.status, matched.size > 0, repairing);
    return [item.id, { problem: Boolean(label), label, inService: repairing, claims: [...matched.values()] }] as const;
  }));
}

/** Three queries regardless of the number of devices, purchases or suppliers; no monetary data. */
export async function loadProblems(storeId: string, where: Prisma.InventoryItemWhereInput = {}) {
  const [items, claims, repairs] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { ...where, storeId, archivedAt: null }, select: deviceSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    prisma.returnCase.findMany({ where: { storeId, ...activeClaims }, select: claimSelect }),
    prisma.repairOrder.findMany({
      where: { storeId, archivedAt: null, status: { notIn: ["ENTREGADO", "CANCELADO", "CANCELADA", "ANULADO"] }, imei: { not: "" } },
      select: { imei: true },
    }),
  ]);
  return { items, claims, problems: indexProblems(items, claims, repairs) };
}

export type ProblemSnapshot = Awaited<ReturnType<typeof loadProblems>>;

export function summarizeProblems(items: Pick<ProblemDevice, "id">[], problems: ProblemSnapshot["problems"]): ProblemSummary {
  return { devices: items.length, problems: items.filter(item => problems.get(item.id)?.problem).length };
}

export function claimsForDevices(items: Pick<ProblemDevice, "id">[], problems: ProblemSnapshot["problems"]): ProblemClaim[] {
  const claims = new Map<string, ProblemClaim>();
  for (const item of items) for (const claim of problems.get(item.id)?.claims ?? []) claims.set(claim.id, claim);
  return [...claims.values()];
}
