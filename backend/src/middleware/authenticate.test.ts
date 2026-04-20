import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdTokenMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
}));

vi.mock("../plugins/firebase-admin.js", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
  }),
}));

import { authenticate } from "./authenticate.js";
import { createTestAuthToken } from "../testing/test-auth.js";

describe("authenticate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid test token in NODE_ENV=test", async () => {
    const request = {
      headers: {
        authorization: `Bearer ${createTestAuthToken({
          uid: "test-user",
          email: "tester@example.com",
          name: "Tester",
        })}`,
      },
    } as any;
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await authenticate(request, reply);

    expect(request.auth).toEqual({
      firebaseUid: "test-user",
      email: "tester@example.com",
      emailVerified: true,
      name: "Tester",
      picture: undefined,
    });
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it("rejects invalid test tokens", async () => {
    const request = {
      headers: {
        authorization: "Bearer test.%7Bbad-json",
      },
    } as any;
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await authenticate(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Invalid token" });
  });

  it("delegates to Firebase Admin for regular tokens", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: "firebase-user",
      email: "owner@example.com",
      email_verified: true,
      name: "Owner",
      picture: "https://example.com/avatar.png",
    });

    const request = {
      headers: {
        authorization: "Bearer firebase-token",
      },
    } as any;
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await authenticate(request, reply);

    expect(verifyIdTokenMock).toHaveBeenCalledWith("firebase-token");
    expect(request.auth?.firebaseUid).toBe("firebase-user");
  });
});
