import type { FastifyReply, FastifyRequest } from 'fastify';
/** Login emails allowed to open the internal store-activity panel. */
export function platformAdminEmails(raw = process.env.ADMIN_EMAILS): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.includes("@")),
  );
}

export function isPlatformAdmin(email: string | null | undefined, verified: boolean | undefined, raw = process.env.ADMIN_EMAILS): boolean {
  const normalized = email?.trim().toLowerCase();
  if (verified !== true || !normalized) return false;
  return platformAdminEmails(raw).has(normalized);
}

/** First two characters of the local part, then the domain. Never returns the full address. */
export function maskEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain || domain.includes("@") || /\s/.test(domain)) return null;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!isPlatformAdmin(request.auth?.email, request.auth?.emailVerified)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
}
