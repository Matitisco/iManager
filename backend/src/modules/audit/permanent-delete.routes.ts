import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireMember, requireSectionAccess } from "../../middleware/section-access.js";
import type { SectionId } from "../stores/sections.js";
import { actorFor } from "./audit.js";
import { permanentlyDelete, type PermanentDeleteEntity } from "./permanent-delete.js";

const OWNER_ONLY = "Solo el dueño de la tienda puede borrar definitivamente.";

/** Mount inside the existing module prefix. Ordinary DELETE remains reversible. */
export function registerPermanentDelete(app: FastifyInstance, entity: PermanentDeleteEntity, section: SectionId) {
  app.delete("/:id/permanent", {
    preHandler: [authenticate, resolveAppUser, requireSectionAccess(section)],
  }, async (request, reply) => {
    requireMember(request);
    if (request.appUser.role !== "OWNER") return reply.code(403).send({ error: OWNER_ONLY });
    const { id } = z.object({ id: z.string().min(1).max(120) }).parse(request.params);
    await permanentlyDelete(request.appUser.storeId, entity, id, await actorFor(request.appUser));
    return reply.code(204).send();
  });
}
