import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  findOrCreateUserFromFirebaseMock,
  buildAppSessionForUserMock,
} = vi.hoisted(() => ({
  prismaMock: {
    storeMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    store: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  findOrCreateUserFromFirebaseMock: vi.fn(),
  buildAppSessionForUserMock: vi.fn(),
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../users/users.service.js", () => ({
  findOrCreateUserFromFirebase: findOrCreateUserFromFirebaseMock,
}));

vi.mock("../auth/session.service.js", () => ({
  buildAppSessionForUser: buildAppSessionForUserMock,
}));

import { completeOnboarding } from "./onboarding.service.js";

describe("onboarding.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrCreateUserFromFirebaseMock.mockResolvedValue({ id: "user-1" });
    buildAppSessionForUserMock.mockResolvedValue({ onboardingRequired: false });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    prismaMock.store.create.mockResolvedValue({ id: "store-1" });
  });

  it("rejects a blank store name", async () => {
    await expect(
      completeOnboarding({ firebaseUid: "firebase-user" }, { storeName: "   " })
    ).rejects.toThrow("Store name is required");
  });

  it("creates a store and owner membership when the user has none", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue(null);

    await completeOnboarding(
      { firebaseUid: "firebase-user", email: "owner@example.com" },
      { storeName: " Mi Tienda " }
    );

    expect(prismaMock.store.create).toHaveBeenCalledWith({
      data: {
        name: "Mi Tienda",
        currency: "ARS",
        exchangeMode: "auto",
        exchangeSource: "blue",
        manualBuy: null,
        manualSell: null,
      },
    });
    expect(prismaMock.storeMember.create).toHaveBeenCalledWith({
      data: {
        storeId: "store-1",
        userId: "user-1",
        role: "OWNER",
        isDefault: true,
      },
    });
  });
});
