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

  request.appUser = {
    userId: user.id,
    storeId: membership.storeId,
    role: membership.role,
    sections: membership.role === "OWNER" ? null : normalizeSections(membership.sections),
  };
}
