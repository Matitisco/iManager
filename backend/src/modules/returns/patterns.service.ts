import { calendarDay } from "../periodic-reports/schedule.js";
import { claimsForDevices, loadProblems, type ProblemDevice } from "../suppliers/problems.js";
import { returnCode } from "./returns-math.js";
import { problemMetrics, topReason, type TopReason } from "./patterns-math.js";

export type PatternGroupBy = "supplier" | "purchase" | "model";
export interface PatternClaimView {
  id: string;
  caseNumber: string;
  deviceLabel: string;
  imei: string;
  reason: string;
  status: string;
  rmaStatus: string | null;
  openedAt: string;
  clientName: string;
}
export interface ReturnPatternView {
  key: string;
  label: string;
  supplierId: string | null;
  purchaseId: string | null;
  devices: number;
  problems: number;
  claims: number;
  percent: number;
  hot: boolean;
  topReason: TopReason | null;
  claimsDetail: PatternClaimView[];
  claimsTruncated: boolean;
}

export const PATTERN_CLAIM_LIMIT = 50;
const ZONE = "America/Argentina/Buenos_Aires";

function groupIdentity(item: ProblemDevice, groupBy: PatternGroupBy) {
  if (groupBy === "supplier") {
    if (!item.supplierId || !item.supplier) return null;
    return { key: item.supplierId, label: item.supplier.name, supplierId: item.supplierId, purchaseId: null };
  }
  if (groupBy === "purchase") {
    const purchase = item.stockPurchase;
    if (!purchase || purchase.deletedAt || !item.supplierId || !item.supplier) return null;
    const date = calendarDay(purchase.purchasedAt, ZONE).split("-").reverse().join("/");
    const label = purchase.name || [date, purchase.notes].filter(Boolean).join(" · ");
    return { key: purchase.id, label: `${item.supplier.name} · ${label}`, supplierId: item.supplierId, purchaseId: purchase.id };
  }
  // Tuple encoding avoids model/capacity collisions; preserve the original model label.
  return { key: JSON.stringify([item.model.trim(), item.capacity.trim()]), label: [item.model.trim(), item.capacity.trim()].filter(Boolean).join(" · "), supplierId: null, purchaseId: null };
}

export async function returnPatternAnalysis(storeId: string, groupBy: PatternGroupBy) {
  const snapshot = await loadProblems(storeId);
  const groups = new Map<string, { identity: NonNullable<ReturnType<typeof groupIdentity>>; items: ProblemDevice[] }>();
  for (const item of snapshot.items) {
    const identity = groupIdentity(item, groupBy);
    if (!identity) continue;
    const group = groups.get(identity.key) ?? { identity, items: [] };
    group.items.push(item);
    groups.set(identity.key, group);
  }
  const count = (items: ProblemDevice[]) => ({ devices: items.length, problems: items.filter(item => (snapshot.problems.get(item.id)?.claims.length ?? 0) > 0).length });
  const totals = count(snapshot.items);
  const allClaims = claimsForDevices(snapshot.items, snapshot.problems);
  const summary = { ...totals, ...problemMetrics(totals.problems, totals.devices), claims: allClaims.length, topReason: topReason(allClaims.map(claim => claim.reason), 1) };
  const patterns: ReturnPatternView[] = [...groups.values()].map(({ identity, items }) => {
    const summary = count(items);
    const claims = claimsForDevices(items, snapshot.problems).sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime() || b.caseNumber - a.caseNumber);
    return {
      ...identity, ...summary, claims: claims.length, ...problemMetrics(summary.problems, summary.devices),
      topReason: topReason(claims.map(claim => claim.reason), 1),
      claimsDetail: claims.slice(0, PATTERN_CLAIM_LIMIT).map(claim => ({
        id: claim.id, caseNumber: returnCode(claim.caseNumber), deviceLabel: claim.deviceLabel,
        imei: claim.imei, reason: claim.reason, status: claim.status, rmaStatus: claim.rmaStatus,
        openedAt: claim.openedAt.toISOString(), clientName: claim.clientName,
      })),
      claimsTruncated: claims.length > PATTERN_CLAIM_LIMIT,
    };
  }).sort((a, b) => b.percent - a.percent || b.problems - a.problems || a.key.localeCompare(b.key));
  return { patterns, summary };
}
