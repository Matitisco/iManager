import type { FastifyReply } from "fastify";
import { loadActor, type Actor } from "../audit/audit.js";

export const SENSITIVE_DENIED = "No tenés permiso para esta acción";

export function canManageSensitive(member: { role: string; sensitiveAccess?: boolean | null } | null | undefined): boolean {
  if (!member) return false;
  if (member.role === "OWNER") return true;
  if (member.sensitiveAccess === true) return true;
  if (member.sensitiveAccess === false) return false;
  return member.role === "MANAGER";
}

export async function requireSensitiveActor(
  member: { userId: string; role: string; sensitiveAccess?: boolean | null } | null | undefined,
  reply: FastifyReply,
): Promise<Actor | null> {
  if (!canManageSensitive(member)) {
    reply.code(403).send({ error: SENSITIVE_DENIED });
    return null;
  }
  return loadActor(member!.userId);
}
