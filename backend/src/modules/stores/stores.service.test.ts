import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  storeMember: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  store: {
    update: vi.fn(),
  },
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import { removeMember, updateMemberRole } from "./stores.service.js";

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
});
