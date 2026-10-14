import { getCommissionReport } from "../commissions/commissions.service.js";
import { commissionPeriodSchema } from "../commissions/commissions.routes.js";
import { requireSectionAccess } from "../../middleware/section-access.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canSeeFinancials } from "../stores/sections.js";
import { requireMember } from "../../middleware/section-access.js";
import {
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
  app.get("/commissions", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("commissions"), requireSectionAccess("reports")] }, async request => {
    requireMember(request);
    const { from, to } = z.object({ from: commissionPeriodSchema, to: commissionPeriodSchema }).strict().parse(request.query);
    return getCommissionReport(request.appUser.storeId, from, to);
  });

  app.get(
    "/overview",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      requireMember(request);
      if (!canSeeFinancials(request.appUser)) {
        return reply.code(403).send({ error: "No tenés acceso a Reportes" });
      }

      const query = reportsQuerySchema.parse(request.query);

      const overview = await getReportsOverview(
        request.appUser.storeId,
        normalizeReportsOverviewInput({
          rangeKey: query.rangeKey as ReportsRangeKey,
          startDate: query.startDate,
          endDate: query.endDate,
        })
      );

      return { overview };
    }
  );
}
