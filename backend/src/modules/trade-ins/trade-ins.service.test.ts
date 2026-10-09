import { beforeEach, describe, expect, it, vi } from "vitest";

const allocateDocumentNumber = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  store: {
    findUnique: vi.fn(),
  },
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
  $transaction: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../lib/store-sequence.js", () => ({
  allocateDocumentNumber,
}));

import {
  createTradeIn,
  createTradeInCategory,
  getTradeInsErrorStatus,
  importTradeIns,
  updateTradeIn,
} from "./trade-ins.service.js";

function tradeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-1",
    tradeNumber: 4,
    clientId: null,
    clientName: "Mostrador",
    categoryId: null,
    dateLabel: "7 oct 2026",
    deviceReceived: "iPhone 11",
    deviceReceivedImei: "",
    takeValue: { toNumber: () => 500 },
    deviceGiven: "iPhone 14",
    differencePaid: { toNumber: () => 700 },
    status: "PENDIENTE",
    batteryHealth: null,
    grade: null,
    tradeAt: new Date("2026-10-07T15:00:00.000Z"),
    customFields: null,
    ...overrides,
  };
}

describe("trade-ins.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ currency: "ARS" });
    allocateDocumentNumber.mockResolvedValue(4);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
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

  it("stores a free client name without linking a client", async () => {
    prismaMock.tradeIn.create.mockResolvedValue(tradeRecord());

    const result = await createTradeIn("store-1", {
      clientName: "  Mostrador  ",
      deviceReceived: "iPhone 11",
      deviceGiven: "iPhone 14",
      takeValue: 500,
      differencePaid: 700,
    });

    expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
    expect(allocateDocumentNumber).toHaveBeenCalledWith(prismaMock, "store-1", "trade");
    expect(prismaMock.tradeIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tradeNumber: 4,
        clientId: null,
        clientName: "Mostrador",
        deviceReceived: "iPhone 11",
        deviceGiven: "iPhone 14",
      }),
    });
    expect(result.clientId).toBe("");
    expect(result.clientName).toBe("Mostrador");
  });

  it("rejects a trade-in without a client name", async () => {
    await expect(createTradeIn("store-1", {
      clientName: "   ",
      deviceReceived: "iPhone 11",
      deviceGiven: "iPhone 14",
    })).rejects.toMatchObject({
      statusCode: 400,
      message: "Nombre de cliente requerido",
    });
    expect(prismaMock.tradeIn.create).not.toHaveBeenCalled();
  });

  it("keeps a typed name when a trade-in is unlinked from a client", async () => {
    prismaMock.tradeIn.findFirst.mockResolvedValue(tradeRecord({ clientId: "client-1", clientName: "Ana" }));
    prismaMock.tradeIn.update.mockResolvedValue(tradeRecord({ clientId: null, clientName: "Mostrador" }));

    const result = await updateTradeIn("store-1", "trade-1", {
      clientId: "",
      clientName: "Mostrador",
    });

    expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.tradeIn.update).toHaveBeenCalledWith({
      where: { id: "trade-1" },
      data: expect.objectContaining({ clientId: null, clientName: "Mostrador" }),
    });
    expect(result).toMatchObject({ clientId: "", clientName: "Mostrador" });
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
    expect(allocateDocumentNumber).toHaveBeenCalledWith(prismaMock, "store-1", "trade");
    expect(prismaMock.tradeIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tradeNumber: 4,
        clientId: "client-1",
        clientName: "Juan",
        deviceReceived: "iPhone 12",
        deviceReceivedImei: "",
        deviceGiven: "iPhone 14",
      }),
    });
  });

  it("rejects a received IMEI that is not 15 digits", async () => {
    await expect(createTradeIn("store-1", {
      clientName: "Ana",
      deviceReceived: "iPhone 11",
      deviceReceivedImei: "12345",
      deviceGiven: "iPhone 14",
    })).rejects.toMatchObject({
      statusCode: 400,
      message: "El IMEI tiene 15 dígitos",
    });
    expect(prismaMock.tradeIn.create).not.toHaveBeenCalled();
  });

  it("reports an invalid received IMEI during import", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" });

    const result = await importTradeIns("store-1", [{
      clientName: "Juan",
      deviceReceived: "iPhone 12",
      deviceReceivedImei: "12345",
      deviceGiven: "iPhone 14",
      takeValue: "100",
      differencePaid: "50",
    }]);

    expect(result.errors).toEqual([{ row: 2, message: "El IMEI tiene 15 dígitos" }]);
    expect(prismaMock.tradeIn.create).not.toHaveBeenCalled();
  });

  it("reports invalid take values during import", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" });

    const result = await importTradeIns("store-1", [{
      clientName: "Juan",
      deviceReceived: "iPhone 12",
      deviceReceivedImei: "350000000000095",
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
