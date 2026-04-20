import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  saleFindManyMock,
  tradeInFindManyMock,
  clientCountMock,
  clientAggregateMock,
  inventoryCountMock,
  inventoryAggregateMock,
} = vi.hoisted(() => ({
  saleFindManyMock: vi.fn(),
  tradeInFindManyMock: vi.fn(),
  clientCountMock: vi.fn(),
  clientAggregateMock: vi.fn(),
  inventoryCountMock: vi.fn(),
  inventoryAggregateMock: vi.fn(),
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
    },
  },
}));

import {
  getReportsErrorStatus,
  getReportsOverview,
  normalizeReportsOverviewInput,
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
    expect(overview.summary.unitsSold).toBe(2);
  });
});
