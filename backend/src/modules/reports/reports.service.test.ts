import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  storeFindMock,
  rateMock,
  saleFindManyMock,
  tradeInFindManyMock,
  clientCountMock,
  clientAggregateMock,
  inventoryCountMock,
  inventoryAggregateMock,
  inventoryFindManyMock,
  returnCaseFindManyMock,
} = vi.hoisted(() => ({
  storeFindMock: vi.fn(),
  rateMock: vi.fn(),
  saleFindManyMock: vi.fn(),
  tradeInFindManyMock: vi.fn(),
  clientCountMock: vi.fn(),
  clientAggregateMock: vi.fn(),
  inventoryCountMock: vi.fn(),
  inventoryAggregateMock: vi.fn(),
  inventoryFindManyMock: vi.fn(),
  returnCaseFindManyMock: vi.fn(),
}));

vi.mock("./net-profit.service.js", () => ({ reportSellRate: rateMock }));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: {
    store: { findUniqueOrThrow: storeFindMock },
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
    returnCase: {
      findMany: returnCaseFindManyMock,
    },
  },
}));

import {
  buildInventoryAging,
  changePercent,
  getReportsOverview,
  normalizeReportsOverviewInput,
  resolvePreviousWindow,
} from "./reports.service.js";

describe("normalizeReportsOverviewInput", () => {
  it("clears stale boundaries for Total", () => {
    expect(normalizeReportsOverviewInput({ rangeKey: "all_time", startDate: "2026-10-01", endDate: "2026-10-22" })).toEqual({ rangeKey: "all_time", startDate: null, endDate: null });
  });
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

    expect(error).toMatchObject({
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

    expect(error).toMatchObject({
      statusCode: 400,
      message: "Report startDate must be before endDate",
    });
  });
});

describe("getReportsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeFindMock.mockResolvedValue({ currency: "ARS" });
    rateMock.mockResolvedValue(1565);
    saleFindManyMock.mockReset();
    inventoryFindManyMock.mockReset();
    returnCaseFindManyMock.mockReset();
    returnCaseFindManyMock.mockResolvedValue([]);

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
      {
        differencePaid: { toNumber: () => 120 },
        status: "APROBADO",
        tradeAt: new Date("2026-04-10T12:00:00.000Z"),
      },
      {
        differencePaid: { toNumber: () => 30 },
        status: "PENDIENTE",
        tradeAt: new Date("2026-04-12T12:00:00.000Z"),
      },
      {
        differencePaid: { toNumber: () => 500 },
        status: "CANCELADO",
        tradeAt: new Date("2026-04-11T12:00:00.000Z"),
      },
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

  it.each([
    ['USD', 'ARS', 2278000, 2212872, 1456, 42],
    ['ARS', 'USD', 100, 80, 156500, 31300],
  ])('converts %s store sales and costs recorded in %s before every sales aggregate', async (active, stored, amount, cost, revenue, profit) => {
    storeFindMock.mockResolvedValue({ currency: active });
    saleFindManyMock.mockResolvedValue([{ amount, amountCurrency: stored, status: 'COMPLETADA', paymentMethod: 'EFECTIVO', soldAt: new Date('2026-04-10T12:00:00Z'), clientId: 'c', inventoryItem: { model: 'Phone', cost, currency: stored } }]);
    const result = await getReportsOverview('store-1', { rangeKey: 'custom', startDate: new Date('2026-04-01'), endDate: new Date('2026-04-30') });
    expect(result.currency).toBe(active);
    expect(result.summary).toMatchObject({ revenue, grossProfit: profit, unitsSold: 1 });
    expect(result.comparison.revenue).toBe(revenue);
    expect(result.salesSeries.reduce((n, row) => n + row.revenue, 0)).toBe(revenue);
    expect(result.paymentMethods[0].revenue).toBe(revenue);
  });
  it('combines pesos and dollars and converts cost independently from sale currency', async () => {
    storeFindMock.mockResolvedValue({ currency: 'USD' });
    const common = { status: 'COMPLETADA', paymentMethod: 'EFECTIVO', soldAt: new Date('2026-04-10'), clientId: 'c' };
    saleFindManyMock.mockResolvedValue([
      { ...common, amount: 156500, amountCurrency: 'ARS', inventoryItem: { model: 'A', cost: 80, currency: 'USD' } },
      { ...common, amount: 200, amountCurrency: 'USD', inventoryItem: { model: 'B', cost: 156500, currency: 'ARS' } },
    ]);
    const result = await getReportsOverview('store-1', { rangeKey: 'all_time', startDate: null, endDate: null });
    expect(result.summary).toMatchObject({ revenue: 300, grossProfit: 120, unitsSold: 2, marginRate: 40 });
    expect(result.paymentMethods[0]).toMatchObject({ revenue: 300, count: 2, share: 100 });
  });

  it('rejects cross-currency totals when the quote is missing', async () => {
    storeFindMock.mockResolvedValue({ currency: 'USD' });
    rateMock.mockResolvedValue(null);
    saleFindManyMock.mockResolvedValue([{ amount: 2278000, amountCurrency: 'ARS', status: 'COMPLETADA', inventoryItem: null }]);
    await expect(getReportsOverview('store-1', { rangeKey: 'all_time', startDate: null, endDate: null })).rejects.toMatchObject({ statusCode: 503 });
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
    expect(overview.tradeIns.series.length).toBeGreaterThan(28);
    expect(overview.tradeIns.series.reduce((sum, point) => sum + point.revenue, 0)).toBe(150);
    expect(overview.inventory.series.length).toBe(overview.tradeIns.series.length);
    expect(inventoryCountMock).toHaveBeenNthCalledWith(1, {
      where: {
        archivedAt: null,
        storeId: "store-1",
        createdAt: {
          gte: new Date("2026-04-01T00:00:00.000Z"),
          lte: new Date("2026-04-30T23:59:59.999Z"),
        },
      },
    });
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

  it("queries the same-duration previous window without voided sales", async () => {
    await getReportsOverview("store-1", {
      rangeKey: "custom",
      startDate: new Date("2026-10-01T00:00:00-03:00"),
      endDate: new Date("2026-10-22T23:59:59.999-03:00"),
    });
    expect(saleFindManyMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        storeId: "store-1", status: "COMPLETADA", voidedAt: null,
        soldAt: { gte: new Date("2026-09-09T00:00:00-03:00"), lte: new Date("2026-09-30T23:59:59.999-03:00") },
      },
    }));
  });

  it("groups midnight sales by Argentine days rather than UTC days", async () => {
    saleFindManyMock.mockResolvedValueOnce([
      { amount: 100, paymentMethod: "EFECTIVO", status: "COMPLETADA", soldAt: new Date("2026-10-02T02:59:59Z"), inventoryItem: { cost: 50 } },
      { amount: 200, paymentMethod: "EFECTIVO", status: "COMPLETADA", soldAt: new Date("2026-10-02T03:00:00Z"), inventoryItem: { cost: 50 } },
    ]).mockResolvedValueOnce([]);
    const overview = await getReportsOverview("store-1", {
      rangeKey: "custom", startDate: new Date("2026-10-01T00:00:00-03:00"), endDate: new Date("2026-10-02T23:59:59.999-03:00"),
    });
    expect(overview.salesSeries).toEqual([
      { start: "2026-10-01", label: "01/10/2026", revenue: 100, unitsSold: 1 },
      { start: "2026-10-02", label: "02/10/2026", revenue: 200, unitsSold: 1 },
    ]);
    expect(overview.comparison.revenueChange).toBeNull();
  });

  it("aggregates all historical sales by Argentine month with no date condition or previous query", async () => {
    saleFindManyMock.mockResolvedValue([
      { amount: 100, paymentMethod: "EFECTIVO", status: "COMPLETADA", soldAt: new Date("2025-12-01T02:59:59Z"), inventoryItem: { cost: 20 } },
      { amount: 200, paymentMethod: "TARJETA", status: "COMPLETADA", soldAt: new Date("2026-01-01T03:00:00Z"), inventoryItem: { cost: 40 } },
      { amount: 900, paymentMethod: "EFECTIVO", status: "PENDIENTE", soldAt: new Date("2026-02-01T12:00:00Z") },
    ]);
    const overview = await getReportsOverview("store-1", normalizeReportsOverviewInput({ rangeKey: "all_time" }));
    expect(saleFindManyMock).toHaveBeenCalledTimes(1);
    expect(saleFindManyMock.mock.calls[0][0].where).toEqual({ storeId: "store-1", voidedAt: null });
    expect(overview.summary).toMatchObject({ revenue: 300, grossProfit: 240, unitsSold: 2, marginRate: 80 });
    expect(overview.salesSeries).toEqual([
      { start: "2025-11-01", label: "01/11/2025", revenue: 100, unitsSold: 1 },
      { start: "2025-12-01", label: "01/12/2025", revenue: 0, unitsSold: 0 },
      { start: "2026-01-01", label: "01/01/2026", revenue: 200, unitsSold: 1 },
    ]);
    expect(overview.paymentMethods.reduce((sum, method) => sum + method.revenue, 0)).toBe(300);
    expect(overview.comparison).toMatchObject({ available: false, revenueChange: null, grossProfitChange: null, unitsChange: null });
    expect(overview.filters).toEqual({ rangeKey: "all_time", startDate: null, endDate: null });
  });

  it("does not invent a previous period for the full history", async () => {
    const overview = await getReportsOverview("store-1", {
      rangeKey: "all_time",
      startDate: null,
      endDate: null,
    });

    expect(saleFindManyMock).toHaveBeenCalledTimes(1);
    expect(inventoryCountMock).toHaveBeenNthCalledWith(1, { where: { storeId: "store-1", archivedAt: null } });
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
    expect(changePercent(0, 0)).toBeNull();
  });

  it("omits tiny and invalid bases without capping legitimate growth", () => {
    expect(changePercent(1000, 0.01)).toBeNull();
    expect(changePercent(1000, -0.5)).toBeNull();
    expect(changePercent(1000, NaN)).toBeNull();
    expect(changePercent(Infinity, 100)).toBeNull();
    expect(changePercent(498, 100)).toBe(398);
    expect(changePercent(0, 100)).toBe(-100);
    expect(changePercent(50, -100)).toBe(150);
  });

  it.each([
    ["2026-03-01T00:00:00-03:00", "2026-03-31T23:59:59.999-03:00"],
    ["2024-03-01T00:00:00-03:00", "2024-03-22T23:59:59.999-03:00"],
    ["2026-01-01T00:00:00-03:00", "2026-01-01T23:59:59.999-03:00"],
  ])("keeps inclusive duration through month/year/leap boundaries: %s", (start, end) => {
    const input = { rangeKey: "custom" as const, startDate: new Date(start), endDate: new Date(end) };
    const previous = resolvePreviousWindow(input)!;
    expect(previous.endDate.getTime() + 1).toBe(input.startDate.getTime());
    expect(previous.endDate.getTime() - previous.startDate.getTime()).toBe(input.endDate.getTime() - input.startDate.getTime());
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
