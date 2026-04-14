import Fastify from "fastify";
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

vi.mock("../../middleware/authenticate.js", () => ({
  authenticate: authenticateMock,
}));

vi.mock("../../middleware/resolve-app-user.js", () => ({
  resolveAppUser: resolveAppUserMock,
}));

vi.mock("./invitations.service.js", () => ({
  previewInvitation: previewInvitationMock,
  acceptInvitation: acceptInvitationMock,
  listInvitations: listInvitationsMock,
  createInvitation: createInvitationMock,
  revokeInvitation: revokeInvitationMock,
}));

import { invitationsRoutes } from "./invitations.routes.js";

describe("invitations.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps preview public without requiring authentication", async () => {
    const app = Fastify();
    await app.register(invitationsRoutes, { prefix: "/api/invitations" });

    previewInvitationMock.mockResolvedValue({
      storeName: "Tienda Centro",
      role: "ADMIN",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/invitations/preview/token-123",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      storeName: "Tienda Centro",
      role: "ADMIN",
    });
    expect(authenticateMock).not.toHaveBeenCalled();
    expect(resolveAppUserMock).not.toHaveBeenCalled();

    await app.close();
  });

  it("still protects invitation listing with authentication", async () => {
    const app = Fastify();
    await app.register(invitationsRoutes, { prefix: "/api/invitations" });

    authenticateMock.mockImplementation(async (request) => {
      request.auth = {
        firebaseUid: "firebase-user-1",
        email: "owner@example.com",
      };
    });
    resolveAppUserMock.mockImplementation(async (request) => {
      request.appUser = {
        userId: "user-1",
        storeId: "store-1",
        role: "OWNER",
      };
    });
    listInvitationsMock.mockResolvedValue([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/invitations",
      headers: {
        authorization: "Bearer fake-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(authenticateMock).toHaveBeenCalledTimes(1);
    expect(resolveAppUserMock).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
