import { assertBillingWrite } from '../modules/billing/service.js';
import type { FastifyReply, FastifyRequest } from "fastify";
import { findOrCreateUserFromFirebase } from "../modules/users/users.service.js";
import { normalizeSections } from "../modules/stores/sections.js";
import { getDefaultMembershipForUser } from "../modules/stores/stores.service.js";

export async function resolveAppUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) {
    return reply.code(401).send({ error: "Unauthenticated" });
  }

  const user = await findOrCreateUserFromFirebase(request.auth);
  const membership = await getDefaultMembershipForUser(user.id);

  if (!membership) {
    return;
  }

  const path = request.url.split('?')[0];
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const accountWrite = path.startsWith('/api/billing') || path.startsWith('/api/notifications') || path.startsWith('/api/security');
  // Owners can remove excess members after a plan change, including in read-only mode.
  const removingMember = request.method === 'DELETE' && /^\/api\/stores\/[^/]+\/members\/[^/]+$/.test(path) && membership.role === 'OWNER';
  if (!safeMethod && !accountWrite && !removingMember) await assertBillingWrite(membership.storeId);

  request.appUser = {
    userId: user.id,
    storeId: membership.storeId,
    role: membership.role,
    sections: membership.role === "OWNER" ? null : normalizeSections(membership.sections),
    sensitiveAccess: membership.sensitiveAccess ?? null,
  };
}
