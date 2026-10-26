import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import { DomainError } from "../../lib/domain-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { FREQUENCIES } from "./schedule.js";
import { getPeriodicReportSettings, savePeriodicReportSettings, sendTestReport, type PeriodicReportInput } from "./service.js";

const bodySchema = z.object({
  sendDay: z.number().int().min(1).max(28).optional(),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  enabled: z.boolean(),
  frequency: z.enum(FREQUENCIES),
  recipients: z.array(z.string().max(2000)).max(20),
}).strict();

const OWNER_ONLY = "Solo el dueño puede configurar el reporte automático";

function ownerOnly(role: string) {
  return role === "OWNER";
}

export async function periodicReportRoutes(app: FastifyInstance) {
  app.get("/current/periodic-report", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    requireMember(request);
    if (!ownerOnly(request.appUser.role)) return reply.code(403).send({ error: OWNER_ONLY });
    return { settings: await getPeriodicReportSettings(request.appUser.storeId) };
  });

  app.put("/current/periodic-report", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    requireMember(request);
    if (!ownerOnly(request.appUser.role)) return reply.code(403).send({ error: OWNER_ONLY });
    try {
      const body = bodySchema.parse(request.body) as PeriodicReportInput;
      return { settings: await savePeriodicReportSettings(request.appUser.storeId, body) };
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "Revisá los datos del reporte" });
      if (error instanceof DomainError) return reply.code(error.statusCode).send({ error: error.message });
      throw error;
    }
  });
  app.post("/current/periodic-report/test", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    requireMember(request);
    if (!ownerOnly(request.appUser.role)) return reply.code(403).send({ error: OWNER_ONLY });
    try {
      return await sendTestReport(request.appUser.storeId, bodySchema.parse(request.body), { log: { info: message => app.log.info(message), warn: message => app.log.warn(message) } });
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "Revisá los datos del reporte" });
      if (error instanceof DomainError) return reply.code(error.statusCode).send({ error: error.message });
      throw error;
    }
  });

}
