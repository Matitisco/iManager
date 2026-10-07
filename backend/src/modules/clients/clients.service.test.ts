import { Decimal } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  clientCategory: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import {
  bulkMoveClientCategory,
  createClient,
  createClientCategory,
  getClientsErrorStatus,
  importClients,
} from "./clients.service.js";

describe("clients.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("maps domain errors into HTTP-friendly payloads", () => {
    const mapped = getClientsErrorStatus(Object.assign(new Error("Client already exists"), { statusCode: 409 }));
    expect(mapped).toBeNull();
  });
});
