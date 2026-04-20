import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findOrCreateUserFromFirebaseMock,
  getDefaultMembershipForUserMock,
} = vi.hoisted(() => ({
  findOrCreateUserFromFirebaseMock: vi.fn(),
  getDefaultMembershipForUserMock: vi.fn(),
}));

vi.mock("../modules/users/users.service.js", () => ({
  findOrCreateUserFromFirebase: findOrCreateUserFromFirebaseMock,
}));

vi.mock("../modules/stores/stores.service.js", () => ({
  getDefaultMembershipForUser: getDefaultMembershipForUserMock,
}));

import { resolveAppUser } from "./resolve-app-user.js";

describe("resolveAppUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth is missing", async () => {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await resolveAppUser({ auth: undefined } as any, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unauthenticated" });
  });

  it("attaches the default membership context when available", async () => {
    findOrCreateUserFromFirebaseMock.mockResolvedValue({ id: "user-1" });
    getDefaultMembershipForUserMock.mockResolvedValue({
      storeId: "store-1",
      role: "OWNER",
    });

    const request = {
      auth: { firebaseUid: "firebase-user" },
    } as any;
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await resolveAppUser(request, reply);

    expect(request.appUser).toEqual({
      userId: "user-1",
      storeId: "store-1",
      role: "OWNER",
    });
  });
});
