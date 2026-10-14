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
    $executeRaw: vi.fn(),
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

import { MANUAL_QUOTE_ORDER_ERROR } from "../../lib/manual-quote.js";
import { completeOnboarding } from "./onboarding.service.js";

describe("onboarding.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrCreateUserFromFirebaseMock.mockResolvedValue({ id: "user-1" });
    buildAppSessionForUserMock.mockResolvedValue({ onboardingRequired: false });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    prismaMock.store.create.mockResolvedValue({ id: "store-1" });
  });

  it("rejects a missing or invalid instagram", async () => {
    await expect(
      completeOnboarding({ firebaseUid: "firebase-user" }, { storeName: "Mi Tienda", instagram: "  " })
    ).rejects.toThrow(/Instagram/);
    await expect(
      completeOnboarding({ firebaseUid: "firebase-user" }, { storeName: "Mi Tienda", instagram: "mi tienda" })
    ).rejects.toThrow(/perfil/);
    expect(prismaMock.store.create).not.toHaveBeenCalled();
  });

  it("rejects a manual buy rate above the sell rate", async () => {
    await expect(completeOnboarding(
      { firebaseUid: "firebase-user" },
      { storeName: "Mi Tienda", instagram: "@tienda", exchangeMode: "manual", manualBuy: 1400, manualSell: 1300 },
    )).rejects.toMatchObject({
      statusCode: 400,
      message: MANUAL_QUOTE_ORDER_ERROR,
    });
    expect(prismaMock.store.create).not.toHaveBeenCalled();
  });

  it("rejects a blank store name", async () => {
    await expect(
      completeOnboarding({ firebaseUid: "firebase-user" }, { storeName: "   ", instagram: "@tienda" })
    ).rejects.toThrow("Completá el nombre de la tienda");
  });

  it("creates a store and owner membership when the user has none", async () => {
    prismaMock.storeMember.findFirst.mockResolvedValue(null);

    await completeOnboarding(
      { firebaseUid: "firebase-user", email: "owner@example.com" },
      { storeName: " Mi Tienda ", instagram: "https://www.instagram.com/mi.tienda/" }
    );

    expect(prismaMock.store.create).toHaveBeenCalledWith({
      data: {
        name: "Mi Tienda",
        instagram: "mi.tienda",
        currency: "USD",
        onboardingStartedAt: expect.any(Date),
        onboardingStage: "invite",
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
    expect(prismaMock.storeMember.findFirst).toHaveBeenCalledTimes(2);
  });

  it("does not create a second store when a concurrent onboarding already wrote the membership", async () => {
    prismaMock.storeMember.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "member-1" });

    await completeOnboarding(
      { firebaseUid: "firebase-user", email: "owner@example.com" },
      { storeName: "Mi Tienda", instagram: "@tienda" }
    );

    expect(prismaMock.store.create).not.toHaveBeenCalled();
    expect(prismaMock.storeMember.create).not.toHaveBeenCalled();
    expect(buildAppSessionForUserMock).toHaveBeenCalled();
  });
});
