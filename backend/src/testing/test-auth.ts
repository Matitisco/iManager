import type { FirebaseAuthContext } from "../types/auth.js";

export interface TestAuthTokenPayload {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
}

export function createTestAuthToken(payload: TestAuthTokenPayload) {
  return `test.${encodeURIComponent(JSON.stringify(payload))}`;
}

export function decodeTestAuthToken(token: string): FirebaseAuthContext | null {
  if (!token.startsWith("test.")) {
    return null;
  }

  try {
    const encodedPayload = token.slice("test.".length);
    const payload = JSON.parse(decodeURIComponent(encodedPayload)) as TestAuthTokenPayload;

    if (!payload.uid?.trim()) {
      return null;
    }

    return {
      firebaseUid: payload.uid.trim(),
      email: payload.email?.trim() || undefined,
      emailVerified: payload.emailVerified ?? true,
      name: payload.name?.trim() || undefined,
      picture: payload.picture?.trim() || undefined,
    };
  } catch {
    return null;
  }
}
