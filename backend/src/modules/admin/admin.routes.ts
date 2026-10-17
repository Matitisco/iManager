import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { isPlatformAdmin } from "./access.js";
import { listStoreActivity } from "./store-activity.service.js";

const querySchema = z.object({
  range: z.enum(["30d", "all"]).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  // INTERNAL marks every store that predates subscriptions. It does not identify a person.
  // Anyone outside ADMIN_EMAILS gets the same 404 as a route that does not exist.
  app.get("/store-activity", { preHandler: [authenticate] }, async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (!isPlatformAdmin(request.auth?.email)) {
      return reply.code(404).send({ error: "Not found" });
    }
    const query = querySchema.parse(request.query);
    return listStoreActivity(query.range === "all" ? "all" : "30d");
  });
}
