import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireMember } from "../../middleware/section-access.js";
import { canAccessSection } from "../stores/sections.js";
import { listHistory, listHistoryActors } from "./history.service.js";

const querySchema = z.object({
  actorUserId: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  group: z.string().trim().min(1).optional(),
  section: z.string().trim().min(1).optional(),
  q: z.string().trim().max(120).optional(),
  entityType: z.string().trim().min(1).max(40).optional(),
  entityId: z.string().trim().min(1).max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

function periodStart(preset: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === "7") start.setDate(start.getDate() - 6);
  if (preset === "30") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  return start;
}

export async function historyRoutes(app: FastifyInstance) {
  const guard = { preHandler: [authenticate, resolveAppUser] };

  app.get("/", guard, async (request, reply) => {
    requireMember(request);
    if (!canAccessSection("history", request.appUser)) {
      return reply.code(403).send({ error: "No tenés acceso al historial" });
    }
    const query = querySchema.parse(request.query);
    const preset = z.object({ period: z.enum(["today", "7", "30", "month"]).optional() }).parse(request.query).period;
    const from = query.from ? new Date(query.from) : preset ? periodStart(preset === "today" ? "today" : preset) : undefined;
    const events = await listHistory(request.appUser.storeId, {
      actorUserId: query.actorUserId,
      from: preset === "today" ? periodStart("today") : from,
      to: query.to ? new Date(query.to) : undefined,
      group: query.group,
      section: query.section,
      q: query.q,
      entityType: query.entityType,
      entityId: query.entityId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return events;
  });

  app.get("/actors", guard, async (request, reply) => {
    requireMember(request);
    if (!canAccessSection("history", request.appUser)) {
      return reply.code(403).send({ error: "No tenés acceso al historial" });
    }
    return { actors: await listHistoryActors(request.appUser.storeId) };
  });
}
