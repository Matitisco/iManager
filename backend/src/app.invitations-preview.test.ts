import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateMock,
  resolveAppUserMock,
  previewInvitationMock,
  acceptInvitationMock,
  listInvitationsMock,
  createInvitationMock,
  revokeInvitationMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
  previewInvitationMock: vi.fn(),
  acceptInvitationMock: vi.fn(),
  listInvitationsMock: vi.fn(),
  createInvitationMock: vi.fn(),
  revokeInvitationMock: vi.fn(),
}));

vi.mock("./config/env.js", () => ({
  env: {
    PORT: 3000,
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/imanager_test",
    FIREBASE_PROJECT_ID: "demo-project",
    FIREBASE_CLIENT_EMAIL: "demo@example.com",
    FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
    FIRESTORE_DATABASE_ID: "demo-database",
    SMTP_PORT: 587,
  },
}));

vi.mock("./middleware/authenticate.js", () => ({
  authenticate: authenticateMock,
}));

vi.mock("./middleware/resolve-app-user.js", () => ({
  resolveAppUser: resolveAppUserMock,
}));

vi.mock("./modules/invitations/invitations.service.js", () => ({
  previewInvitation: previewInvitationMock,
  acceptInvitation: acceptInvitationMock,
  listInvitations: listInvitationsMock,
  createInvitation: createInvitationMock,
  revokeInvitation: revokeInvitationMock,
}));

import { buildApp } from "./app.js";

describe("buildApp invitations integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateMock.mockImplementation(async (request: { headers: { authorization?: string }; auth?: unknown }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) => {
      if (!request.headers.authorization?.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "Missing bearer token" });
      }

      request.auth = {
        firebaseUid: "firebase-user-1",
        email: "owner@example.com",
      };
    });

    resolveAppUserMock.mockImplementation(async (request: { auth?: unknown; appUser?: unknown }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      request.appUser = {
        userId: "user-1",
        storeId: "store-1",
        role: "OWNER",
      };
    });
  });

  it("serves invite preview publicly through the full app router", async () => {
    const app = buildApp();

    previewInvitationMock.mockResolvedValue({
      storeName: "Tienda Centro",
      role: "MANAGER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/invitations/preview/token-123",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      storeName: "Tienda Centro",
      role: "MANAGER",
    });
    expect(authenticateMock).not.toHaveBeenCalled();
    expect(resolveAppUserMock).not.toHaveBeenCalled();

    await app.close();
  });

  it("still rejects the protected invitation list without a bearer token", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/invitations",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Missing bearer token" });
    expect(authenticateMock).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
