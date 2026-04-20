import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import {
  getReportsErrorStatus,
  getReportsOverview,
  normalizeReportsOverviewInput,
  type ReportsRangeKey,
} from "./reports.service.js";

const reportsQuerySchema = z.object({
  rangeKey: z
    .enum(["this_month", "last_90_days", "this_year", "all_time", "custom"])
    .default("this_month"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function reportsRoutes(app: FastifyInstance) {
  app.get(
    "/overview",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const query = reportsQuerySchema.parse(request.query);

      try {
        const overview = await getReportsOverview(
          request.appUser.storeId,
          normalizeReportsOverviewInput({
            rangeKey: query.rangeKey as ReportsRangeKey,
            startDate: query.startDate,
            endDate: query.endDate,
          })
        );

        return { overview };
      } catch (error) {
        const mapped = getReportsErrorStatus(error);
        if (mapped) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        throw error;
      }
    }
  );
}
