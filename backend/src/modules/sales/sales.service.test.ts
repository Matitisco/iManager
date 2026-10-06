import { Decimal } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
  },
  inventoryItem: {
    findFirst: vi.fn(),
  },
  saleCategory: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  sale: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import { createCategory, createSale, getSalesErrorStatus, importSales } from "./sales.service.js";

describe("sales.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
  });

  it("fails when the client does not belong to the store", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);

    await expect(
      createSale("store-1", {
        date: "10 abr 2026",
        clientId: "missing-client",
        productId: "item-1",
        amount: 1000,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Client not found",
    });
  });

  it("fails when the inventory item is not available", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1", totalSpent: new Decimal(0) });
    prismaMock.inventoryItem.findFirst.mockResolvedValue({ id: "item-1", status: "VENDIDO" });

    await expect(
      createSale("store-1", {
        date: "10 abr 2026",
        clientId: "client-1",
        productId: "item-1",
        amount: 1000,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Inventory item is not available",
    });
  });

  it("creates categories with dedup protection", async () => {
    prismaMock.saleCategory.findFirst.mockResolvedValue(null);
    prismaMock.saleCategory.count.mockResolvedValue(0);
    prismaMock.saleCategory.create.mockResolvedValue({ id: "cat-1", name: "Ventas mostrador" });

    await expect(createCategory("store-1", " Ventas mostrador ")).resolves.toEqual({
      id: "cat-1",
      name: "Ventas mostrador",
    });
  });

  it("stores the client name without requiring a client row", async () => {
    prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

    const result = await importSales("store-1", [{ clientName: "Alguien", productImei: "IMEI", amount: "1000" }]);

    expect(result.errors).toEqual([{ row: 2, message: 'Producto no encontrado (IMEI): "IMEI"' }]);
    expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
  });

  it("returns null for non-domain errors", () => {
    expect(getSalesErrorStatus(new Error("boom"))).toBeNull();
  });
});
