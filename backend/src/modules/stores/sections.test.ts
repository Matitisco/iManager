import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  storeMember: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import { updateMemberSections } from "./stores.service.js";
import { assertSectionList, canAccessSection, normalizeSections } from "./sections.js";

const staff = {
  id: "member-2",
  userId: "user-2",
  role: "STAFF",
  isDefault: false,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  sections: null,
  user: { id: "user-2", displayName: "Luis", email: "luis@test.com", avatarUrl: null },
};

describe("member sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a missing list as full access and rejects unknown ids", () => {
    expect(normalizeSections(null)).toBeNull();
    expect(normalizeSections(["sales", "sales", "nope"])).toEqual(["sales"]);
    expect(() => assertSectionList(["ventas"])).toThrow(/no existe/);
  });

  it("lets the owner and a partner open commissions, and keeps staff out", () => {
    expect(canAccessSection("commissions", { role: "OWNER", sections: [] })).toBe(true);
    expect(canAccessSection("commissions", { role: "MANAGER", sections: null })).toBe(true);
    expect(canAccessSection("commissions", { role: "MANAGER", sections: ["sales"] })).toBe(false);
    expect(canAccessSection("commissions", { role: "MANAGER", sections: ["commissions"] })).toBe(true);
    expect(canAccessSection("commissions", { role: "STAFF", sections: null })).toBe(false);
    expect(canAccessSection("commissions", { role: "STAFF", sections: ["commissions"] })).toBe(false);
    expect(canAccessSection("service", { role: "STAFF", sections: ["service"] })).toBe(true);
    expect(canAccessSection("service", { role: "STAFF", sections: ["sales"] })).toBe(false);
    expect(canAccessSection("service", { role: "OWNER", sections: [] })).toBe(true);
  });

  it("saves the chosen sections for a staff member and protects the owner", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue(staff);
    prismaMock.storeMember.update.mockResolvedValue({ ...staff, sections: ["sales"] });

    await expect(updateMemberSections("store-1", "member-2", ["sales", "sales"], "OWNER", "user-1")).resolves.toMatchObject({
      id: "member-2",
      sections: ["sales"],
    });
    expect(prismaMock.storeMember.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { sections: ["sales"] },
    }));

    prismaMock.storeMember.findFirst.mockResolvedValue({ ...staff, role: "OWNER" });
    await expect(updateMemberSections("store-1", "member-1", ["sales"], "MANAGER", "user-9")).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(updateMemberSections("store-1", "member-2", ["sales"], "STAFF", "user-2")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
