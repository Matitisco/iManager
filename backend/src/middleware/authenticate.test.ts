import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdTokenMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
}));

vi.mock("../plugins/firebase-admin.js", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
  }),
}));

import { env } from "../config/env.js";
import { authenticate } from "./authenticate.js";
import { createTestAuthToken } from "../testing/test-auth.js";

describe("authenticate", () => {
  const originalMode = env.NODE_ENV;
  const originalBypass = env.ENABLE_TEST_AUTH_BYPASS;
  beforeEach(() => {
    vi.resetAllMocks();
    verifyIdTokenMock.mockRejectedValue(new Error('Invalid fixture'));
  });
  afterEach(() => {
    env.NODE_ENV = originalMode;
    env.ENABLE_TEST_AUTH_BYPASS = originalBypass;
  });

  it.each(['production', 'development', 'test'] as const)('rejects test tokens without explicit opt-in in %s', async mode => {
    env.NODE_ENV = mode;
    env.ENABLE_TEST_AUTH_BYPASS = mode !== 'test';
    const request = { headers: { authorization: `Bearer ${createTestAuthToken({ uid: 'qa-sec-7' })}` } } as any;
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() } as any;
    await authenticate(request, reply);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(request.auth).toBeUndefined();
  });

  it('never accepts test identity headers without a bearer token', async () => {
    const request = { headers: { 'x-test-user': 'qa-sec-7', 'x-test-uid': 'qa-sec-7' } } as any;
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() } as any;
    await authenticate(request, reply);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it.each(['auth/id-token-expired', 'auth/argument-error', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/invalid-audience', 'auth/invalid-issuer', 'auth/user-not-found'])(
    'returns the same public error for %s', async code => {
      verifyIdTokenMock.mockRejectedValue(Object.assign(new Error('Internal provider detail'), { code }));
      const request = { headers: { authorization: 'Bearer fixture-invalid' } } as any;
      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() } as any;
      await authenticate(request, reply);
      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(request.auth).toBeUndefined();
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

    expect(verifyIdTokenMock).toHaveBeenCalledWith("firebase-token", true);
    expect(request.auth?.firebaseUid).toBe("firebase-user");
  });
});
