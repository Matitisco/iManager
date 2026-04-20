import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

import { findOrCreateUserFromFirebase, updateUserProfile } from "./users.service.js";

describe("users.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user when the firebase uid does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "user-1", firebaseUid: "firebase-user" });

    await findOrCreateUserFromFirebase({
      firebaseUid: "firebase-user",
      email: "owner@example.com",
      name: "Owner",
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: "firebase-user",
        email: "owner@example.com",
        displayName: "Owner",
        avatarUrl: undefined,
      },
    });
  });

  it("refreshes sparse fields on an existing user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      firebaseUid: "firebase-user",
      email: null,
      displayName: null,
      avatarUrl: null,
    });

    await findOrCreateUserFromFirebase({
      firebaseUid: "firebase-user",
      email: "owner@example.com",
      name: "Owner",
      picture: "https://example.com/avatar.png",
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        displayName: "Owner",
        avatarUrl: "https://example.com/avatar.png",
        email: "owner@example.com",
      },
    });
  });

  it("updates the profile display name", async () => {
    prismaMock.user.update.mockResolvedValue({ id: "user-1" });

    await updateUserProfile("user-1", { displayName: "Nuevo Nombre" });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "Nuevo Nombre" },
    });
  });
});
