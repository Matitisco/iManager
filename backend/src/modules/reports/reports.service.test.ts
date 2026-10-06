import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  saleFindManyMock,
  tradeInFindManyMock,
  clientCountMock,
  clientAggregateMock,
  inventoryCountMock,
  inventoryAggregateMock,
  inventoryFindManyMock,
} = vi.hoisted(() => ({
  saleFindManyMock: vi.fn(),
  tradeInFindManyMock: vi.fn(),
  clientCountMock: vi.fn(),
  clientAggregateMock: vi.fn(),
  inventoryCountMock: vi.fn(),
  inventoryAggregateMock: vi.fn(),
  inventoryFindManyMock: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: {
    sale: {
      findMany: saleFindManyMock,
    },
    tradeIn: {
      findMany: tradeInFindManyMock,
    },
    client: {
      count: clientCountMock,
      aggregate: clientAggregateMock,
    },
    inventoryItem: {
      count: inventoryCountMock,
      aggregate: inventoryAggregateMock,
      findMany: inventoryFindManyMock,
    },
  },
}));

import {
  buildInventoryAging,
  changePercent,
  getReportsErrorStatus,
  getReportsOverview,
  normalizeReportsOverviewInput,
  resolvePreviousWindow,
} from "./reports.service.js";

describe("normalizeReportsOverviewInput", () => {
  it("rejects custom ranges without both dates", () => {
    const error = (() => {
      try {
        normalizeReportsOverviewInput({
          rangeKey: "custom",
          startDate: "2026-04-01T00:00:00.000Z",
        });
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(getReportsErrorStatus(error)).toEqual({
      statusCode: 400,
      message: "Custom report range requires startDate and endDate",
    });
  });

  it("rejects inverted ranges", () => {
    const error = (() => {
      try {
        normalizeReportsOverviewInput({
          rangeKey: "custom",
          startDate: "2026-04-10T00:00:00.000Z",
          endDate: "2026-04-01T00:00:00.000Z",
        });
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(getReportsErrorStatus(error)).toEqual({
      statusCode: 400,
      message: "Report startDate must be before endDate",
    });
  });
});

describe("getReportsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleFindManyMock.mockReset();
    inventoryFindManyMock.mockReset();

    saleFindManyMock.mockResolvedValue([
      {
        amount: { toNumber: () => 400 },
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        soldAt: new Date("2026-04-10T12:00:00.000Z"),
        clientId: "client-1",
        inventoryItem: {
          model: "iPhone 14",
          capacity: "128GB",
          color: "Negro",
          cost: { toNumber: () => 250 },
        },
      },
      {
        amount: { toNumber: () => 500 },
        paymentMethod: "TARJETA",
        status: "COMPLETADA",
        soldAt: new Date("2026-04-11T12:00:00.000Z"),
        clientId: "client-2",
        inventoryItem: {
          model: "iPhone 14",
          capacity: "128GB",
          color: "Negro",
          cost: { toNumber: () => 300 },
        },
      },
      {
        amount: { toNumber: () => 900 },
        paymentMethod: "EFECTIVO",
        status: "PENDIENTE",
        soldAt: new Date("2026-04-12T12:00:00.000Z"),
        clientId: "client-3",
        inventoryItem: {
          model: "Galaxy S24",
          capacity: "256GB",
          color: "Azul",
          cost: { toNumber: () => 700 },
        },
      },
    ]);
    tradeInFindManyMock.mockResolvedValue([
      { differencePaid: { toNumber: () => 120 }, status: "APROBADO" },
      { differencePaid: { toNumber: () => 30 }, status: "PENDIENTE" },
    ]);
    clientCountMock.mockResolvedValue(8);
    clientAggregateMock.mockResolvedValue({
      _sum: {
        pendingBalance: { toNumber: () => 1250 },
      },
    });
    inventoryCountMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    inventoryAggregateMock.mockResolvedValue({
      _sum: {
        cost: { toNumber: () => 3000 },
        price: { toNumber: () => 4500 },
      },
    });
    inventoryFindManyMock.mockResolvedValue([]);
  });

  it("returns valuation and topProducts using completed sales only", async () => {
    const overview = await getReportsOverview("store-1", {
      rangeKey: "custom",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T23:59:59.999Z"),
    });

    expect(overview.inventory.valuation).toEqual({
      costValue: 3000,
      retailValue: 4500,
    });
    expect(overview.topProducts).toEqual([
      {
        product: "iPhone 14 128GB Negro",
        unitsSold: 2,
        revenue: 900,
        share: 100,
      },
    ]);
    expect(overview.summary.pendingSales).toBe(1);
    expect(overview.summary.pendingAmount).toBe(900);
    expect(overview.summary.unitsSold).toBe(2);
    expect(overview.summary.marginRate).toBeCloseTo((350 / 900) * 100);
    expect(overview.paymentMethods.map((method) => method.label)).toEqual(["Tarjeta", "Efectivo"]);
    expect(overview.tradeIns.openInRange).toBe(1);
    expect(overview.tradeIns.cashGenerated).toBe(120);
    expect(overview.tradeIns.openCash).toBe(30);
    expect(overview.tradeIns.otherCash).toBe(0);
    expect(overview.comparison.available).toBe(true);
  });

  it("compares the range with the previous window and groups real sales", async () => {
    saleFindManyMock
      .mockResolvedValueOnce([
        {
          amount: { toNumber: () => 400 },
          paymentMethod: "EFECTIVO",
          status: "COMPLETADA",
          soldAt: new Date("2026-04-10T12:00:00.000Z"),
          clientId: "client-1",
          category: { name: "Usados" },
          client: { name: "Ana" },
          inventoryItem: {
            model: "iPhone 14",
            capacity: "128GB",
            color: "Negro",
            cost: { toNumber: () => 250 },
          },
        },
        {
          amount: { toNumber: () => 500 },
          paymentMethod: "TARJETA",
          status: "COMPLETADA",
          soldAt: new Date("2026-04-11T12:00:00.000Z"),
          clientId: "client-2",
          category: { name: "Nuevos" },
          client: { name: "Luis" },
          inventoryItem: {
            model: "Galaxy S24",
            capacity: "256GB",
            color: "Azul",
            cost: { toNumber: () => 300 },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          amount: { toNumber: () => 200 },
          inventoryItem: { cost: { toNumber: () => 100 } },
        },
      ]);
    const now = Date.now();
    inventoryFindManyMock.mockResolvedValueOnce([
      { createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000), cost: { toNumber: () => 100 } },
      { createdAt: new Date(now - 70 * 24 * 60 * 60 * 1000), cost: { toNumber: () => 50 } },
    ]);

    const overview = await getReportsOverview("store-1", {
      rangeKey: "custom",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T23:59:59.999Z"),
    });

    expect(overview.comparison).toMatchObject({
      available: true,
      revenue: 200,
      unitsSold: 1,
    });
    expect(overview.comparison.revenueChange).toBeCloseTo(350);
    expect(overview.categories).toEqual([
      { category: "Nuevos", unitsSold: 1, revenue: 500, share: (500 / 900) * 100 },
      { category: "Usados", unitsSold: 1, revenue: 400, share: (400 / 900) * 100 },
    ]);
    expect(overview.topClients).toEqual([
      { client: "Luis", purchases: 1, revenue: 500 },
      { client: "Ana", purchases: 1, revenue: 400 },
    ]);
    expect(overview.inventory.aging.map((bucket) => bucket.count)).toEqual([1, 0, 0, 1]);
  });

  it("does not invent a previous period for the full history", async () => {
    const overview = await getReportsOverview("store-1", {
      rangeKey: "all_time",
      startDate: null,
      endDate: null,
    });

    expect(saleFindManyMock).toHaveBeenCalledTimes(1);
    expect(overview.comparison.available).toBe(false);
    expect(overview.comparison.revenueChange).toBeNull();
  });
});

describe("report window helpers", () => {
  it("builds the previous window with the same duration", () => {
    const window = resolvePreviousWindow({
      rangeKey: "custom",
      startDate: new Date("2026-04-10T00:00:00.000Z"),
      endDate: new Date("2026-04-12T00:00:00.000Z"),
    });

    expect(window?.endDate.toISOString()).toBe("2026-04-09T23:59:59.999Z");
    expect(window?.startDate.toISOString()).toBe("2026-04-07T23:59:59.999Z");
  });

  it("returns null when the previous value is zero and the current one is not", () => {
    expect(changePercent(10, 0)).toBeNull();
    expect(changePercent(0, 0)).toBe(0);
  });

  it("buckets available stock by how long it has been sitting", () => {
    const now = new Date("2026-04-30T00:00:00.000Z");
    const aging = buildInventoryAging(
      [
        { createdAt: new Date("2026-04-25T00:00:00.000Z"), cost: 10 },
        { createdAt: new Date("2026-04-10T00:00:00.000Z"), cost: 20 },
        { createdAt: new Date("2026-03-15T00:00:00.000Z"), cost: 30 },
        { createdAt: new Date("2026-01-01T00:00:00.000Z"), cost: 40 },
      ],
      now
    );

    expect(aging).toEqual([
      { label: "0-14 días", count: 1, costValue: 10 },
      { label: "15-30 días", count: 1, costValue: 20 },
      { label: "31-60 días", count: 1, costValue: 30 },
      { label: "Más de 60 días", count: 1, costValue: 40 },
    ]);
  });
});
