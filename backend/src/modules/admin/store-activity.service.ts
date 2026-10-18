import { analyticsSnapshot, type FunnelStepId } from './funnel.service.js';
import { prisma } from "../../plugins/prisma.js";
import { maskEmail } from "./access.js";

const WINDOW_MS = 30 * 86_400_000;

export type StoreActivityRange = "30d" | "all";

export type StoreActivityRow = {
  id: string;
  name: string;
  ownerEmail: string | null;
  billingPlan: string;
  billingStatus: string;
  trialEndsAt: string | null;
  createdAt: string;
  onboardingStage: string | null;
  counts: {
    storeMembers: number;
    inventoryItems: number;
    sales: number;
    clients: number;
    repairOrders: number;
  };
  lastActivityAt: string | null;
  stuckAt: FunnelStepId | null;
  activeDays30: number;
};

export type StoreActivityResponse = {
  range: StoreActivityRange;
  generatedAt: string;
  stores: StoreActivityRow[];
};

type CountRow = { storeId: string; _count: { _all: number } };
type CountActivityRow = CountRow & { _max: { createdAt: Date | null } };
type ActivityRow = { storeId: string; _max: { createdAt: Date | null } };

function countsOf(rows: CountRow[]) {
  return new Map(rows.map((row) => [row.storeId, row._count._all]));
}

function momentsOf(rows: ActivityRow[]) {
  return new Map(rows.map((row) => [row.storeId, row._max.createdAt]));
}

function latestIso(dates: Array<Date | null | undefined>) {
  let max: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!max || date.getTime() > max.getTime()) max = date;
  }
  return max ? max.toISOString() : null;
}

function maskedOwner(memberships: { user: { email: string | null } }[]) {
  for (const membership of memberships) {
    const masked = maskEmail(membership.user.email);
    if (masked) return masked;
  }
  return null;
}

export async function listStoreActivity(range: StoreActivityRange, now = new Date()): Promise<StoreActivityResponse> {
  const createdAt = range === "all" ? undefined : { gte: new Date(now.getTime() - WINDOW_MS) };
  const stores = await prisma.store.findMany({
    where: createdAt ? { createdAt } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      billingStatus: true,
      trialEndsAt: true,
      createdAt: true,
      onboardingStage: true,
      memberships: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { email: true } } },
      },
    },
  });

  const ids = stores.map((store) => store.id);
  const where = { storeId: { in: ids } };
  const empty = ids.length === 0;
  const [members, inventory, sales, clients, repairs, audits] = empty
    ? [[], [], [], [], [], []] as [CountRow[], CountActivityRow[], CountActivityRow[], CountActivityRow[], CountRow[], ActivityRow[]]
    : await Promise.all([
      prisma.storeMember.groupBy({ by: ["storeId"], where, _count: { _all: true } }),
      prisma.inventoryItem.groupBy({ by: ["storeId"], where, _count: { _all: true }, _max: { createdAt: true } }),
      prisma.sale.groupBy({ by: ["storeId"], where, _count: { _all: true }, _max: { createdAt: true } }),
      prisma.client.groupBy({ by: ["storeId"], where, _count: { _all: true }, _max: { createdAt: true } }),
      prisma.repairOrder.groupBy({ by: ["storeId"], where, _count: { _all: true } }),
      prisma.auditEvent.groupBy({ by: ["storeId"], where, _max: { createdAt: true } }),
    ]);

  const analytics = new Map((await analyticsSnapshot(ids, now)).map(s => [s.id, s]));
  const memberCounts = countsOf(members);
  const inventoryCounts = countsOf(inventory);
  const saleCounts = countsOf(sales);
  const clientCounts = countsOf(clients);
  const repairCounts = countsOf(repairs);
  const inventoryAt = momentsOf(inventory);
  const salesAt = momentsOf(sales);
  const clientsAt = momentsOf(clients);
  const auditsAt = momentsOf(audits);

  return {
    range,
    generatedAt: now.toISOString(),
    stores: stores.map((store) => ({
      stuckAt: analytics.get(store.id)?.stuckAt ?? null,
      activeDays30: analytics.get(store.id)?.activeDays30 ?? 0,
      id: store.id,
      name: store.name,
      ownerEmail: maskedOwner(store.memberships),
      billingPlan: store.billingPlan,
      billingStatus: store.billingStatus,
      trialEndsAt: store.trialEndsAt?.toISOString() ?? null,
      createdAt: store.createdAt.toISOString(),
      onboardingStage: store.onboardingStage,
      counts: {
        storeMembers: memberCounts.get(store.id) ?? 0,
        inventoryItems: inventoryCounts.get(store.id) ?? 0,
        sales: saleCounts.get(store.id) ?? 0,
        clients: clientCounts.get(store.id) ?? 0,
        repairOrders: repairCounts.get(store.id) ?? 0,
      },
      lastActivityAt: latestIso([
        inventoryAt.get(store.id),
        salesAt.get(store.id),
        clientsAt.get(store.id),
        auditsAt.get(store.id),
      ]),
    })),
  };
}
