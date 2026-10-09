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

  it("reloads the user when a concurrent create hits the firebase uid unique index", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-1",
        firebaseUid: "firebase-user",
        email: null,
        displayName: null,
        avatarUrl: null,
      });
    prismaMock.user.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed on the fields: (`firebaseUid`)"), { code: "P2002" })
    );
    prismaMock.user.update.mockResolvedValue({ id: "user-1", firebaseUid: "firebase-user" });

    const user = await findOrCreateUserFromFirebase({
      firebaseUid: "firebase-user",
      email: "owner@example.com",
      name: "Owner",
      picture: "https://example.com/avatar.png",
    });

    expect(user).toMatchObject({ id: "user-1" });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        displayName: "Owner",
        avatarUrl: "https://example.com/avatar.png",
        email: "owner@example.com",
      },
    });
  });

  it("rethrows errors that are not a unique constraint violation", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockRejectedValue(Object.assign(new Error("database unavailable"), { code: "P1001" }));

    await expect(
      findOrCreateUserFromFirebase({
        firebaseUid: "firebase-user",
        email: "owner@example.com",
      })
    ).rejects.toThrow("database unavailable");
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
