import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DomainError } from "../../lib/domain-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canAccessSection } from "../stores/sections.js";
import { IMPORT_CATALOGS, IMPORT_SECTIONS } from "./import-catalog.js";
import { suggestColumnMapping, type SuggestMappingInput } from "./suggest-mapping.service.js";

const bodySchema = z.object({
  section: z.enum(IMPORT_SECTIONS),
  columns: z.array(z.object({
    header: z.string().trim().min(1).max(200),
    samples: z.array(z.string().max(120)).max(10),
  })).min(1).max(40),
});

export async function importRoutes(app: FastifyInstance) {
  app.post(
    "/suggest-mapping",
    { preHandler: [authenticate, resolveAppUser] },
    async (request) => {
      requireMember(request);
      const body = bodySchema.parse(request.body) as SuggestMappingInput;
      const catalog = IMPORT_CATALOGS[body.section];
      if (!canAccessSection(catalog.access, request.appUser)) {
        throw new DomainError(`No tenés acceso a ${catalog.accessLabel}`, 403);
      }

      return suggestColumnMapping(body, {
        log: (entry) => request.log.info(entry, "import mapping usage"),
      });
    },
  );
}
