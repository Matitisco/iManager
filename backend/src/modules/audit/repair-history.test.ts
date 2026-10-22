import { beforeEach, expect, it, vi } from "vitest";
import { repairHistoryRows } from "./repair-history.js";
import { prisma } from "../../plugins/prisma.js";
import type { HistoryQuery } from "./history.service.js";

vi.mock("../../plugins/prisma.js", () => ({ prisma: { $queryRaw: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it.each<HistoryQuery>([
  {},
  { entityType: "repair" },
  { entityType: "sale", entityId: "order" },
  { entityType: "repair", entityId: "order", actorUserId: "ana" },
])("does not load unattributed repair events for unscoped, other-record or actor-filtered history: %j", async query => {
  expect(await repairHistoryRows("store", query, null, null, 51)).toEqual([]);
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
});
