import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  storeMember: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  store: {
    update: vi.fn(),
    create: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import {
  activateStoreForUser,
  createStoreForUser,
  listStoresForUser,
  removeMember,
  updateMemberRole,
} from "./stores.service.js";

describe("stores.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents a manager from promoting someone to OWNER", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue({
      id: "member-2",
      role: "STAFF",
      storeId: "store-1",
      userId: "user-2",
    });

    await expect(
      updateMemberRole("store-1", "member-2", "OWNER", "MANAGER", "user-1")
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "No pod\u00e9s asignar el rol Propietario",
    });
  });

  it("prevents removing the only owner", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue({
      id: "member-owner",
      role: "OWNER",
      storeId: "store-1",
      userId: "user-1",
      user: { id: "user-1" },
    });
    prismaMock.storeMember.count.mockResolvedValue(1);

    await expect(
      removeMember("store-1", "member-owner", "OWNER", "user-1")
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "No puede haber una tienda sin Propietario",
    });
  });

  it("lists the stores a user can manage", async () => {
    prismaMock.storeMember.findMany.mockResolvedValue([
      {
        role: "OWNER",
        isDefault: true,
        store: { id: "store-1", name: "Casa Central" },
      },
      {
        role: "STAFF",
        isDefault: false,
        store: { id: "store-2", name: "Sucursal Norte" },
      },
    ]);

    await expect(listStoresForUser("user-1")).resolves.toEqual([
      { id: "store-1", name: "Casa Central", role: "OWNER", isDefault: true },
      { id: "store-2", name: "Sucursal Norte", role: "STAFF", isDefault: false },
    ]);
  });

  it("creates another owned store and makes it the active one", async () => {
    prismaMock.storeMember.count.mockResolvedValue(1);
    prismaMock.store.create.mockResolvedValue({ id: "store-2", name: "Sucursal Norte" });
    prismaMock.storeMember.create.mockResolvedValue({ id: "member-2" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock)
    );

    await createStoreForUser("user-1", "  Sucursal Norte  ");

    expect(prismaMock.storeMember.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    });
    expect(prismaMock.store.create).toHaveBeenCalledWith({
      data: { name: "Sucursal Norte" },
    });
    expect(prismaMock.storeMember.create).toHaveBeenCalledWith({
      data: {
        storeId: "store-2",
        userId: "user-1",
        role: "OWNER",
        isDefault: true,
      },
    });
  });

  it("rejects a blank store name", async () => {
    await expect(createStoreForUser("user-1", "   ")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("activates a store the user already belongs to", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue({ id: "member-2", storeId: "store-2" });
    prismaMock.$transaction.mockResolvedValue([]);

    await activateStoreForUser("user-1", "store-2");

    expect(prismaMock.storeMember.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    });
    expect(prismaMock.storeMember.update).toHaveBeenCalledWith({
      where: { id: "member-2" },
      data: { isDefault: true },
    });
  });

  it("refuses to activate a store outside the user memberships", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue(null);

    await expect(activateStoreForUser("user-1", "store-9")).rejects.toMatchObject({
      statusCode: 404,
      message: "No pertenecés a esa tienda",
    });
  });
});
