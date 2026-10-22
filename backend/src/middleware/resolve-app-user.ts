import { trackActiveDay } from '../modules/analytics/active-day.js';
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
  request.analyticsUserId = user.id;
  const membership = await getDefaultMembershipForUser(user.id);

  if (!membership) {
    return;
  }

  const path = request.url.split('?')[0];
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const accountWrite = path === '/api/events' || path.startsWith('/api/billing') || path.startsWith('/api/notifications') || path.startsWith('/api/section-views') || path.startsWith('/api/security');
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
  trackActiveDay(request.appUser, request.headers['x-im-device']);
}
