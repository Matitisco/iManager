import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
  },
  tradeIn: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  tradeInCategory: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import {
  createTradeIn,
  createTradeInCategory,
  getTradeInsErrorStatus,
  importTradeIns,
} from "./trade-ins.service.js";

describe("trade-ins.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when the client does not exist", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);

    await expect(
      createTradeIn("store-1", {
        date: "10 abr 2026",
        clientId: "missing-client",
        deviceReceived: "iPhone 11",
        deviceReceivedImei: "IMEI-1",
        takeValue: 500,
        deviceGiven: "iPhone 14",
        differencePaid: 700,
        status: "PENDIENTE",
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Client not found",
    });
  });

  it("creates categories with trimmed names", async () => {
    prismaMock.tradeInCategory.findFirst.mockResolvedValue(null);
    prismaMock.tradeInCategory.count.mockResolvedValue(0);
    prismaMock.tradeInCategory.create.mockResolvedValue({ id: "cat-1", name: "Canjes premium" });

    await expect(createTradeInCategory("store-1", "  Canjes premium ")).resolves.toEqual({
      id: "cat-1",
      name: "Canjes premium",
    });
  });

  it("imports a trade-in without an imei", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" });
    prismaMock.tradeIn.create.mockResolvedValue({ id: "trade-1" });

    const result = await importTradeIns("store-1", [{
      clientName: "Juan",
      deviceReceived: "iPhone 12",
      deviceGiven: "iPhone 14",
    }]);

    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(1);
    expect(prismaMock.tradeIn.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.tradeIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceReceived: "iPhone 12",
        deviceReceivedImei: "",
        deviceGiven: "iPhone 14",
      }),
    });
  });

  it("reports invalid take values during import", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" });

    const result = await importTradeIns("store-1", [{
      clientName: "Juan",
      deviceReceived: "iPhone 12",
      deviceReceivedImei: "IMEI-1",
      deviceGiven: "iPhone 14",
      takeValue: "-1",
      differencePaid: "100",
    }]);

    expect(result.errors).toEqual([{ row: 2, message: "Valor de toma invalido" }]);
  });

  it("returns null for generic errors", () => {
    expect(getTradeInsErrorStatus(new Error("boom"))).toBeNull();
  });
});
