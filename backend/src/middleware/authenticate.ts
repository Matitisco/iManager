import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { getAdminAuth } from "../plugins/firebase-admin.js";
import { decodeTestAuthToken } from "../testing/test-auth.js";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing bearer token" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const shouldAllowTestBypass = env.NODE_ENV === "test" && env.ENABLE_TEST_AUTH_BYPASS;

  if (shouldAllowTestBypass && token.startsWith("test.")) {
    const testAuth = decodeTestAuthToken(token);
    if (!testAuth) {
      return reply.code(401).send({ error: "Invalid token" });
    }

    request.auth = testAuth;
    return;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);

    request.auth = {
      firebaseUid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
}
