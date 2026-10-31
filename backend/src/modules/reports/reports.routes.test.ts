import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateMock,
  resolveAppUserMock,
  getReportsOverviewMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
  getReportsOverviewMock: vi.fn(),
}));

vi.mock("../../middleware/authenticate.js", () => ({
  authenticate: authenticateMock,
}));

vi.mock("../../middleware/resolve-app-user.js", () => ({
  resolveAppUser: resolveAppUserMock,
}));

vi.mock("./reports.service.js", async () => {
  const actual = await vi.importActual<typeof import("./reports.service.js")>("./reports.service.js");

  return {
    ...actual,
    getReportsOverview: getReportsOverviewMock,
  };
});

import { registerApiErrorHandler } from "../../lib/api-error.js";
import { reportsRoutes } from "./reports.routes.js";

function buildApp() {
  const app = Fastify();
  registerApiErrorHandler(app);
  return app;
}

describe("reportsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authenticateMock.mockImplementation(async () => undefined);
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = {
        storeId: "store-1",
        role: "OWNER",
      };
    });
    getReportsOverviewMock.mockResolvedValue({
      filters: {
        rangeKey: "custom",
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-30T23:59:59.999Z",
      },
      summary: {
        revenue: 0,
        grossProfit: 0,
        unitsSold: 0,
        averageTicket: 0,
        pendingSales: 0,
        approvedTradeIns: 0,
      },
      salesSeries: [],
      topProducts: [],
      paymentMethods: [],
      inventory: {
        totalItems: 0,
        availableItems: 0,
        soldItems: 0,
        inReviewItems: 0,
        valuation: {
          costValue: 0,
          retailValue: 0,
        },
      },
      clients: {
        totalClients: 0,
        activeClients: 0,
        pendingBalance: 0,
      },
      tradeIns: {
        totalInRange: 0,
        approvedInRange: 0,
        cashGenerated: 0,
      },
    });
  });

  it("accepts a custom range and forwards normalized dates to the service", async () => {
    const app = buildApp();
    await app.register(reportsRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/overview?rangeKey=custom&startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-30T23:59:59.999Z",
    });

    expect(response.statusCode).toBe(200);
    expect(getReportsOverviewMock).toHaveBeenCalledWith("store-1", {
      rangeKey: "custom",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T23:59:59.999Z"),
    });

    await app.close();
  });


  it("accepts Total without date boundaries", async () => {
    const app = buildApp();
    await app.register(reportsRoutes);
    const response = await app.inject({ method: "GET", url: "/overview?rangeKey=all_time" });
    expect(response.statusCode).toBe(200);
    expect(getReportsOverviewMock).toHaveBeenCalledWith("store-1", { rangeKey: "all_time", startDate: null, endDate: null });
    await app.close();
  });

  it("accepts the overview when the employee has reports listed", async () => {
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "STAFF", sections: ["reports", "inventory"] };
    });
    const listed = buildApp();
    await listed.register(reportsRoutes);
    const listedResponse = await listed.inject({ method: "GET", url: "/overview" });
    expect(listedResponse.statusCode).toBe(200);
    expect(getReportsOverviewMock).toHaveBeenCalledWith("store-1", expect.objectContaining({ rangeKey: "this_month" }));
    await listed.close();
  });

  it("temporarily accepts the overview when the employee has no saved sections", async () => {
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "STAFF", sections: null };
    });
    const open = buildApp();
    await open.register(reportsRoutes);
    const openResponse = await open.inject({ method: "GET", url: "/overview" });
    expect(openResponse.statusCode).toBe(200);
    expect(getReportsOverviewMock).toHaveBeenCalled();
    await open.close();
  });

  it("temporarily accepts the overview when the employee cannot open reports", async () => {
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "STAFF", sections: ["inventory"] };
    });
    const app = buildApp();
    await app.register(reportsRoutes);

    const response = await app.inject({ method: "GET", url: "/overview" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ overview: { summary: { revenue: 0, grossProfit: 0 } } });
    expect(getReportsOverviewMock).toHaveBeenCalled();
    await app.close();
  });

  it("rejects custom ranges that omit one of the dates", async () => {
    const app = buildApp();
    await app.register(reportsRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/overview?rangeKey=custom&startDate=2026-04-01T00:00:00.000Z",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Custom report range requires startDate and endDate",
    });
    expect(getReportsOverviewMock).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects invalid custom ranges where the start date is after the end date", async () => {
    const app = buildApp();
    await app.register(reportsRoutes);

    const response = await app.inject({
      method: "GET",
      url: "/overview?rangeKey=custom&startDate=2026-04-30T23:59:59.999Z&endDate=2026-04-01T00:00:00.000Z",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Report startDate must be before endDate",
    });
    expect(getReportsOverviewMock).not.toHaveBeenCalled();

    await app.close();
  });
});
