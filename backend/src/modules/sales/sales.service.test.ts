import { Decimal } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../commissions/commission-ledger.js", () => ({
  assertSeller: vi.fn(), recordSaleCommission: vi.fn(), refreshSaleCommission: vi.fn(), voidSaleCommission: vi.fn(),
}));

const allocateDocumentNumber = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  store: {
    findUnique: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  inventoryItem: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  storeMember: {
    findMany: vi.fn(),
  },
  tradeIn: {
    findMany: vi.fn(),
  },
  saleCategory: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  commissionAccrual: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  sale: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    aggregate: vi.fn(),
  },
  $queryRaw: vi.fn().mockResolvedValue([]),
  $executeRaw: vi.fn().mockResolvedValue(0),
  cashRegister: { findFirst: vi.fn().mockResolvedValue(null) },
  cashMovement: { findMany: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../lib/store-sequence.js", () => ({
  allocateDocumentNumber,
}));

import { createCategory, createSale, deleteSale, importSales, updateSale } from "./sales.service.js";

describe("sales.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ currency: "ARS" });
    allocateDocumentNumber.mockResolvedValue(4);
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.create.mockResolvedValue({
      id: "client-new",
      name: "Alguien",
      dni: null,
      phone: null,
      email: null,
      totalSpent: new Decimal(0),
      lastPurchaseAt: null,
    });
    prismaMock.client.update.mockResolvedValue({});
    prismaMock.storeMember.findMany.mockResolvedValue([]);
    prismaMock.tradeIn.findMany.mockResolvedValue([]);
    prismaMock.sale.findFirst.mockResolvedValue(null);
    prismaMock.sale.create.mockResolvedValue({ id: "sale-1" });
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

  it.each([false, true])("deletes cancelled sales without touching stock or client stats (integrated: %s)", async (integratedOperation) => {
    prismaMock.sale.findFirst.mockResolvedValue({ id: "sale-1", status: "CANCELADA", integratedOperation, tradeInId: "trade-1", inventoryItemId: "item-1", clientId: "client-1" });
    await expect(deleteSale("store-1", "sale-1")).resolves.toBe(true);
    expect(prismaMock.sale.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sale-1" }, data: expect.objectContaining({ voidedAt: expect.any(Date), tradeInId: null }) }));
    expect(prismaMock.inventoryItem.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.client.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.sale.aggregate).not.toHaveBeenCalled();
  });

  it("keeps rejecting direct deletion of active linked sales", async () => {
    prismaMock.sale.findFirst.mockResolvedValue({ id: "sale-1", status: "COMPLETADA", integratedOperation: true });
    await expect(deleteSale("store-1", "sale-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.sale.update).not.toHaveBeenCalled();
  });

  it("keeps restoring stock and recomputing client stats for active historical sales", async () => {
    prismaMock.sale.findFirst.mockResolvedValue({ id: "sale-1", status: "COMPLETADA", inventoryItemId: "item-1", clientId: "client-1" });
    prismaMock.sale.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(500) }, _max: { soldAt: null } });
    await expect(deleteSale("store-1", "sale-1")).resolves.toBe(true);
    expect(prismaMock.sale.aggregate).toHaveBeenCalledWith({
      where: { storeId: "store-1", clientId: "client-1", id: { not: "sale-1" }, voidedAt: null, status: { notIn: ["CANCELADA", "ANULADA"] } },
      _sum: { amount: true }, _max: { soldAt: true },
    });
    expect(prismaMock.inventoryItem.updateMany).toHaveBeenCalledWith({ where: { id: "item-1", storeId: "store-1" }, data: { status: "DISPONIBLE" } });
    expect(prismaMock.client.updateMany).toHaveBeenCalledWith({ where: { id: "client-1", storeId: "store-1" }, data: { totalSpent: new Decimal(500), lastPurchaseAt: null } });
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

  it.each(["CANCELADA", "ANULADA"])("does not add a historical %s sale to client spending", async (status) => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1", name: "Ana", totalSpent: new Decimal(100) });
    prismaMock.sale.create.mockResolvedValue({
      id: "sale-1", saleNumber: 4, clientId: "client-1", clientName: "Ana", inventoryItemId: null,
      deviceLabel: "iPhone 11", amount: new Decimal(500), soldAt: new Date("2026-10-07T15:00:00Z"),
      dateLabel: "07/10/2026", paymentMethod: "EFECTIVO", status, customFields: {},
    });
    await createSale("store-1", { date: "07/10/2026", clientId: "client-1", deviceLabel: "iPhone 11", amount: 500, paymentMethod: "EFECTIVO", status });
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });

  it.each(["CANCELADA", "ANULADA"])("recalculates spending when only the status changes to %s", async (status) => {
    const existing = {
      id: "sale-1", saleNumber: 4, clientId: "client-1", clientName: "Ana", inventoryItemId: null,
      deviceLabel: "iPhone 11", amount: new Decimal(500), soldAt: new Date("2026-10-07T15:00:00Z"),
      dateLabel: "07/10/2026", paymentMethod: "EFECTIVO", status: "COMPLETADA", customFields: {},
    };
    prismaMock.sale.findFirst.mockResolvedValue(existing);
    prismaMock.sale.update.mockResolvedValue({ ...existing, status });
    prismaMock.sale.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(100) }, _max: { soldAt: null } });
    await updateSale("store-1", "sale-1", { status });
    expect(prismaMock.sale.aggregate).toHaveBeenCalledWith({ where: { storeId: "store-1", clientId: "client-1", voidedAt: null, status: { notIn: ["CANCELADA", "ANULADA"] } }, _sum: { amount: true }, _max: { soldAt: true } });
    expect(prismaMock.client.updateMany).toHaveBeenCalledWith({ where: { id: "client-1", storeId: "store-1" }, data: { totalSpent: new Decimal(100), lastPurchaseAt: null } });
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

  it("keeps a sale when the IMEI is not in stock and does not create an item", async () => {
    prismaMock.inventoryItem.findFirst.mockResolvedValue(null);

    const result = await importSales("store-1", [{
      clientName: "Alguien",
      device: "iPhone 13 128 GB",
      productImei: "350000000000095",
      amount: "1000",
      seller: "Luis",
    }]);

    expect(result).toEqual({ imported: 1, updated: 0, errors: [] });
    expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientName: "Alguien",
        inventoryItemId: null,
        deviceLabel: "iPhone 13 128 GB · 350000000000095",
        customFields: expect.objectContaining({ vendedor: "Luis", imei: "350000000000095" }),
      }),
    });
  });

  it("links a disponible item and marks only that item as sold", async () => {
    prismaMock.inventoryItem.findFirst.mockResolvedValue({ id: "item-1", status: "DISPONIBLE", archivedAt: null });

    const result = await importSales("store-1", [{ clientName: "Alguien", productImei: "350000000000095", amount: "1000" }]);

    expect(result.imported).toBe(1);
    expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { status: "VENDIDO" },
    });
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ inventoryItemId: "item-1" }),
    });
  });

  it("does not relink or change an item that already has a sale", async () => {
    prismaMock.inventoryItem.findFirst.mockResolvedValue({ id: "item-1", status: "VENDIDO", archivedAt: null });
    prismaMock.sale.findFirst.mockImplementation(async ({ where }) => where.inventoryItemId ? { id: "sale-old" } : null);

    const result = await importSales("store-1", [{ clientName: "Alguien", device: "iPhone 13", productImei: "350000000000095", amount: "1000" }]);

    expect(result.imported).toBe(1);
    expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryItemId: null,
        deviceLabel: "iPhone 13 · 350000000000095",
      }),
    });
  });

  it("reuses a client with the same name and does not create another", async () => {
    prismaMock.client.findMany.mockResolvedValue([{
      id: "client-1",
      name: "Ana Gómez",
      dni: null,
      phone: null,
      email: null,
      totalSpent: new Decimal(10),
      lastPurchaseAt: null,
    }]);

    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1", name: "Ana Gómez", lastPurchaseAt: null });
    const result = await importSales("store-1", [{ clientName: "ana gómez", device: "iPhone 13", amount: "1000" }]);

    expect(result.imported).toBe(1);
    expect(prismaMock.client.create).not.toHaveBeenCalled();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: "client-1", clientName: "ana gómez" }),
    });
    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({ totalSpent: { increment: new Decimal(1000) } }),
    });
  });

  it("imports a sale without an IMEI and without linking stock", async () => {
    const result = await importSales("store-1", [{ clientName: "Alguien", amount: "1000" }]);

    expect(result).toEqual({ imported: 1, updated: 0, errors: [] });
    expect(prismaMock.inventoryItem.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientName: "Alguien", inventoryItemId: null }),
    });
  });

  it("keeps a sale when the IMEI is not 15 digits and does not link stock", async () => {
    const result = await importSales("store-1", [{ clientName: "Alguien", device: "iPhone 11", productImei: "12345", amount: "1000" }]);

    expect(result).toEqual({ imported: 1, updated: 0, errors: [] });
    expect(prismaMock.inventoryItem.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ inventoryItemId: null, deviceLabel: "iPhone 11" }),
    });
  });

  it('rejects repeated rows and retries before changing client balances or stock', async () => {
    const fingerprints = new Set<string>();
    prismaMock.sale.findFirst.mockImplementation(async ({ where }) => {
      const fingerprint = where.customFields?.equals;
      return fingerprint && fingerprints.has(fingerprint) ? { id: 'imported-sale' } : null;
    });
    prismaMock.sale.create.mockImplementation(async ({ data }) => {
      fingerprints.add(data.customFields.importFingerprint);
      return { id: 'imported-sale' };
    });
    prismaMock.inventoryItem.findFirst.mockResolvedValue(null);
    const row = { clientName: 'Lucía Fernández', device: 'iPhone 13', date: '22/10/2026', amount: '1.250,50', currency: 'USD' };
    const result = await importSales('store-1', [row, row]);
    expect(result).toMatchObject({ imported: 1, errors: [{ row: 3, message: 'Esta venta ya fue importada; no se duplicó' }] });
    expect(prismaMock.sale.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.client.create).toHaveBeenCalledTimes(1);
    const writes = prismaMock.client.update.mock.calls.length;
    expect(await importSales('store-1', [{ ...row, amount: '1250.50' }])).toMatchObject({ imported: 0, errors: [{ row: 2 }] });
    expect(prismaMock.client.update).toHaveBeenCalledTimes(writes);
    expect(prismaMock.sale.create).toHaveBeenCalledTimes(1);
    // A different amount represents a different historical sale.
    expect(await importSales('store-1', [{ ...row, amount: '1300' }])).toMatchObject({ imported: 1, errors: [] });
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-1' }) }));
  });
});
