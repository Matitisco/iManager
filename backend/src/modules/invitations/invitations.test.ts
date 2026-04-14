import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirebaseAuthContext } from "../../types/auth.js";

const {
  prismaMock,
  findOrCreateUserFromFirebaseMock,
  buildAppSessionForUserMock,
} = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findFirst: vi.fn(),
    },
    storeInvitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    storeMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
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

import {
  acceptInvitation,
  createInvitation,
  previewInvitation,
} from "./invitations.service.js";

describe("invitations.service", () => {
  const auth: FirebaseAuthContext = {
    firebaseUid: "firebase-user-1",
    email: "invitee@example.com",
    name: "Invited User",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    prismaMock.storeMember.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.storeInvitation.update.mockResolvedValue({});
    process.env.FRONTEND_URL = "https://app.imanager.test";
  });

  it("creates an invitation link using FRONTEND_URL", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.storeInvitation.create.mockResolvedValue({
      id: "inv-1",
      token: "token-12345678",
      email: null,
      role: "SELLER",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const result = await createInvitation("store-1", "OWNER", undefined, "SELLER");

    expect(result.inviteUrl).toBe("https://app.imanager.test/invite/token-12345678");
    expect(prismaMock.storeInvitation.create).toHaveBeenCalledWith({
      data: {
        storeId: "store-1",
        email: undefined,
        role: "SELLER",
        expiresAt: expect.any(Date),
      },
    });
  });

  it("fails clearly when FRONTEND_URL is missing", async () => {
    process.env.FRONTEND_URL = "";

    await expect(createInvitation("store-1", "OWNER", undefined, "ADMIN")).rejects.toMatchObject({
      statusCode: 500,
      message: "FRONTEND_URL no está configurado en el backend. No se puede generar el enlace de invitación.",
    });
  });

  it("previews a valid pending invitation", async () => {
    prismaMock.storeInvitation.findUnique.mockResolvedValue({
      id: "inv-1",
      token: "token-1",
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
      store: { name: "Tienda Centro" },
    });

    await expect(previewInvitation("token-1")).resolves.toEqual({
      storeName: "Tienda Centro",
      role: "ADMIN",
    });
  });

  it("accepts an invitation end-to-end and switches the invited store as default", async () => {
    const invitationRecord = {
      id: "inv-1",
      token: "token-1",
      storeId: "store-invited",
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    };

    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.storeInvitation.create.mockResolvedValue({
      ...invitationRecord,
      email: null,
    });
    prismaMock.storeInvitation.findUnique.mockResolvedValueOnce({
      ...invitationRecord,
      store: { name: "Tienda Norte" },
    });
    prismaMock.storeInvitation.findUnique.mockResolvedValueOnce(invitationRecord);
    findOrCreateUserFromFirebaseMock.mockResolvedValue({
      id: "user-1",
      firebaseUid: auth.firebaseUid,
      email: auth.email,
      displayName: auth.name,
      avatarUrl: null,
      twoFactorEnabled: false,
    });
    prismaMock.storeMember.findUnique.mockResolvedValue(null);
    prismaMock.storeMember.count.mockResolvedValue(1);
    prismaMock.storeMember.create.mockResolvedValue({
      id: "member-2",
      storeId: "store-invited",
      userId: "user-1",
      role: "ADMIN",
      isDefault: false,
    });
    buildAppSessionForUserMock.mockResolvedValue({
      user: { id: "user-1" },
      store: { id: "store-invited", name: "Tienda Norte" },
      membership: { role: "ADMIN", isDefault: true },
      onboardingRequired: false,
    });

    const created = await createInvitation("store-owner", "OWNER", undefined, "ADMIN");
    const preview = await previewInvitation(created.token);
    const session = await acceptInvitation(created.token, auth);

    expect(preview).toEqual({ storeName: "Tienda Norte", role: "ADMIN" });
    expect(prismaMock.storeMember.create).toHaveBeenCalledWith({
      data: {
        storeId: "store-invited",
        userId: "user-1",
        role: "ADMIN",
        isDefault: false,
      },
    });
    expect(prismaMock.storeMember.updateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "user-1", NOT: { storeId: "store-invited" }, isDefault: true },
      data: { isDefault: false },
    });
    expect(prismaMock.storeMember.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: "user-1", storeId: "store-invited" },
      data: { isDefault: true },
    });
    expect(prismaMock.storeInvitation.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "ACCEPTED" },
    });
    expect(buildAppSessionForUserMock).toHaveBeenCalledWith(auth, "store-invited");
    expect(session.store?.id).toBe("store-invited");
  });

  it("rejects the creator or an existing member using the same invite link", async () => {
    prismaMock.storeInvitation.findUnique.mockResolvedValue({
      id: "inv-1",
      token: "token-creator",
      storeId: "store-owner",
      role: "SELLER",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    });
    findOrCreateUserFromFirebaseMock.mockResolvedValue({
      id: "user-owner",
      firebaseUid: auth.firebaseUid,
      email: auth.email,
      displayName: auth.name,
      avatarUrl: null,
      twoFactorEnabled: false,
    });
    prismaMock.storeMember.findUnique.mockResolvedValue({
      id: "member-owner",
      storeId: "store-owner",
      userId: "user-owner",
      role: "OWNER",
      isDefault: true,
    });

    await expect(acceptInvitation("token-creator", auth)).rejects.toMatchObject({
      statusCode: 409,
      message: "Ya formás parte de esta tienda. El creador o un miembro existente no puede usar este enlace.",
    });
  });
});
