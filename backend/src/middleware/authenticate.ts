import type { FastifyReply, FastifyRequest } from "fastify";
import { adminAuth } from "../plugins/firebase-admin.js";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing bearer token" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = await adminAuth.verifyIdToken(token);

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
