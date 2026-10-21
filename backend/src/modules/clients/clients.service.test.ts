import { Decimal } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  clientCategory: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  sale: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import {
  bulkMoveClientCategory,
  createClient,
  createClientCategory,
  importClients,
  serializeClient,
  updateClient,
} from "./clients.service.js";

describe("clients.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ currency: "ARS" });
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.create.mockResolvedValue({
      id: "client-1",
      dni: "30111222",
      name: "Juan",
      email: null,
      phone: null,
      lastPurchaseAt: null,
      totalSpent: new Decimal(0),
      pendingBalance: new Decimal(0),
      categoryId: null,
      customFields: {},
    });
  });

  it("creates a client with only a name", async () => {
    prismaMock.client.create.mockResolvedValueOnce({
      id: "client-2",
      dni: null,
      name: "Ana",
      email: null,
      phone: null,
      lastPurchaseAt: null,
      totalSpent: new Decimal(0),
      pendingBalance: new Decimal(0),
      categoryId: null,
      customFields: {},
    });

    await expect(createClient("store-1", { name: "Ana", dni: "  " })).resolves.toMatchObject({
      name: "Ana",
      dni: "",
    });

    expect(prismaMock.client.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storeId: "store-1",
        dni: null,
        name: "Ana",
      }),
    });
  });

  it("rejects duplicate clients by dni", async () => {
    prismaMock.client.findFirst.mockResolvedValueOnce({ id: "client-1" });

    await expect(
      createClient("store-1", { dni: "30111222", name: "Juan" })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Client already exists",
    });
  });

  it("creates categories with trimmed names and increasing sort order", async () => {
    prismaMock.clientCategory.findFirst.mockResolvedValue(null);
    prismaMock.clientCategory.count.mockResolvedValue(3);
    prismaMock.clientCategory.create.mockResolvedValue({ id: "cat-1", name: "VIP" });

    await expect(createClientCategory("store-1", "  VIP  ")).resolves.toEqual({
      id: "cat-1",
      name: "VIP",
    });
  });

  it("moves clients only when the target category exists", async () => {
    prismaMock.clientCategory.findFirst.mockResolvedValue(null);

    await expect(
      bulkMoveClientCategory("store-1", ["client-1"], "missing-cat")
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Category not found",
    });
  });

  it("imports rows and reports missing names", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);

    const result = await importClients("store-1", [{ name: "  " }, { name: "Juan", dni: "30111222" }]);

    expect(result.errors).toEqual([{ row: 2, message: "Nombre requerido" }]);
    expect(result.imported).toBe(1);
  });

  it("exposes the creation date without changing stored totals", () => {
    const created = serializeClient({
      id: "client-9",
      dni: null,
      name: "Ana",
      email: null,
      phone: null,
      lastPurchaseAt: null,
      totalSpent: new Decimal(0),
      pendingBalance: new Decimal(0),
      categoryId: null,
      customFields: {},
      createdAt: new Date("2026-04-02T15:00:00.000Z"),
    });

    expect(created.createdAt).toBe("2026-04-02T15:00:00.000Z");
    expect(created.totalSpent).toBe(0);
  });

  it("renames a client who already has a sale and blocks only a real balance change", async () => {
    const existing = {
      id: "client-1",
      dni: null,
      name: "Juan",
      email: null,
      phone: null,
      instagram: null,
      categoryId: null,
      lastPurchaseAt: null,
      totalSpent: new Decimal(100),
      pendingBalance: new Decimal(40),
      balanceCurrency: "ARS",
      tag: null,
      birthday: null,
      customFields: {},
      createdAt: new Date("2026-04-02T15:00:00.000Z"),
      archivedAt: null,
      archivedBy: null,
    };
    prismaMock.client.findFirst.mockResolvedValue(existing);
    prismaMock.sale.findFirst.mockResolvedValue({ id: "sale-1" });
    const updated = { ...existing, name: "Ana" };
    prismaMock.$transaction.mockImplementation(async (run: (tx: unknown) => Promise<typeof updated>) => run({
      client: { findFirst: prismaMock.client.findFirst, update: vi.fn().mockResolvedValue(updated) },
      inventoryItem: { updateMany: vi.fn() },
      sale: { findFirst: prismaMock.sale.findFirst, updateMany: vi.fn() },
      tradeIn: { updateMany: vi.fn() },
      auditEvent: { create: vi.fn() },
    }));

    await expect(updateClient("store-1", "client-1", { name: "Ana", totalSpent: 100, pendingBalance: 40 })).resolves.toMatchObject({ name: "Ana" });
    expect(prismaMock.sale.findFirst).not.toHaveBeenCalled();

    prismaMock.sale.findFirst.mockClear();
    await expect(updateClient("store-1", "client-1", { name: "Ana", pendingBalance: 80 })).rejects.toMatchObject({
      message: "Los saldos vinculados a una operación se actualizan desde Operaciones o Pagos",
      statusCode: 409,
    });
    expect(prismaMock.sale.findFirst).toHaveBeenCalled();
  });
});
