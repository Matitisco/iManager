import { Decimal } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const allocateDocumentNumber = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  store: {
    findUnique: vi.fn(),
  },
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

import { createCategory, createSale, getSalesErrorStatus, importSales } from "./sales.service.js";

describe("sales.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ currency: "ARS" });
    allocateDocumentNumber.mockResolvedValue(4);
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

  it("records a free-text device without touching stock", async () => {
    prismaMock.sale.create.mockResolvedValue({
      id: "sale-1",
      saleNumber: 4,
      clientId: null,
      clientName: "Mostrador",
      inventoryItemId: null,
      deviceLabel: "iPhone 11 64GB",
      dateLabel: "07/10/2026",
      amount: new Decimal(500),
      paymentMethod: "EFECTIVO",
      status: "COMPLETADA",
      categoryId: null,
      soldAt: new Date("2026-10-07T15:00:00Z"),
      customFields: {},
    });

    await expect(createSale("store-1", {
      date: "07/10/2026",
      clientName: "Mostrador",
      deviceLabel: " iPhone 11 64GB ",
      amount: 500,
      paymentMethod: "EFECTIVO",
      status: "COMPLETADA",
    })).resolves.toMatchObject({
      productId: "",
      deviceLabel: "iPhone 11 64GB",
      clientName: "Mostrador",
    });

    expect(prismaMock.inventoryItem.findFirst).not.toHaveBeenCalled();
    expect(allocateDocumentNumber).toHaveBeenCalledWith(prismaMock, "store-1", "sale");
    expect(prismaMock.sale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        saleNumber: 4,
        inventoryItemId: null,
        deviceLabel: "iPhone 11 64GB",
      }),
    }));
  });

  it("rejects a sale without a device", async () => {
    await expect(createSale("store-1", {
      date: "07/10/2026",
      amount: 500,
      paymentMethod: "EFECTIVO",
      status: "COMPLETADA",
    })).rejects.toMatchObject({
      statusCode: 400,
      message: "Indicá el equipo",
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
