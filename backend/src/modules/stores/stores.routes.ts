import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { updateStore } from "./stores.service.js";

const storePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  legalName: z.string().max(160).nullable().optional(),
  taxId: z.string().max(50).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(80).optional(),
});

export async function storesRoutes(app: FastifyInstance) {
  app.patch(
    "/current",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const body = storePatchSchema.parse(request.body);
      const store = await updateStore(request.appUser.storeId, body);
      return { store };
    }
  );
}
