import { isSaleCancelled } from '../../lib/accounting-states.js';
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

/** Legacy status fields also accept the cancellation aliases displayed by Desk.
 * Check both sale and nested trade status before any mutation, including drafts. */
export function requireStatusAccess(
  member: Parameters<typeof canManageSensitive>[0],
  reply: FastifyReply,
  ...statuses: Array<string | null | undefined>
): boolean {
  const cancelling = statuses.some(status => isSaleCancelled(status));
  if (!cancelling || canManageSensitive(member)) return true;
  reply.code(403).send({ error: SENSITIVE_DENIED });
  return false;
}

export async function requireSensitiveActor(
  member: { userId: string; role: string; sensitiveAccess?: boolean | null } | null | undefined,
  reply: FastifyReply,
): Promise<Actor | null> {
  if (!canManageSensitive(member)) {
    reply.code(403).send({ error: SENSITIVE_DENIED });
    return null;
  }
  const actor = await loadActor(member!.userId);
  return { ...actor, role: member!.role };
}
