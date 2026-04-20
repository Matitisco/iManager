import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findOrCreateUserFromFirebaseMock,
  getDefaultMembershipForUserMock,
  getMembershipForUserAndStoreMock,
} = vi.hoisted(() => ({
  findOrCreateUserFromFirebaseMock: vi.fn(),
  getDefaultMembershipForUserMock: vi.fn(),
  getMembershipForUserAndStoreMock: vi.fn(),
}));

vi.mock("../users/users.service.js", () => ({
  findOrCreateUserFromFirebase: findOrCreateUserFromFirebaseMock,
}));

vi.mock("../stores/stores.service.js", () => ({
  getDefaultMembershipForUser: getDefaultMembershipForUserMock,
  getMembershipForUserAndStore: getMembershipForUserAndStoreMock,
}));

import { buildAppSessionForUser } from "./session.service.js";

describe("session.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrCreateUserFromFirebaseMock.mockResolvedValue({
      id: "user-1",
      firebaseUid: "firebase-user",
      email: "owner@example.com",
      displayName: "Owner",
      avatarUrl: null,
      twoFactorEnabled: false,
    });
  });

  it("returns onboardingRequired when there is no membership", async () => {
    getMembershipForUserAndStoreMock.mockResolvedValue(null);
    getDefaultMembershipForUserMock.mockResolvedValue(null);

    await expect(
      buildAppSessionForUser({ firebaseUid: "firebase-user" })
    ).resolves.toMatchObject({
      onboardingRequired: true,
      store: null,
      membership: null,
    });
  });

  it("prefers the requested store membership when available", async () => {
    getMembershipForUserAndStoreMock.mockResolvedValue({
      store: {
        id: "store-2",
        name: "Sucursal Norte",
        legalName: null,
        taxId: null,
        phone: null,
        address: null,
        currency: "ARS",
        timezone: "America/Argentina/Buenos_Aires",
      },
      role: "MANAGER",
      isDefault: false,
    });

    const session = await buildAppSessionForUser({ firebaseUid: "firebase-user" }, "store-2");

    expect(session.onboardingRequired).toBe(false);
    expect(session.store?.id).toBe("store-2");
    expect(session.membership?.role).toBe("MANAGER");
  });
});
