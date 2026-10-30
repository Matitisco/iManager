import { listTacMisses } from '../imei-tac-misses/service.js';
import { getFunnel, getTimeline } from './funnel.service.js';
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePlatformAdmin } from "./access.js";
import { listStoreActivity } from "./store-activity.service.js";
import { inventoryDuplicatesQuery, listInventoryDuplicates } from "./inventory-duplicates.service.js";

const querySchema = z.object({
  range: z.enum(["7d", "30d", "all"]).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => { reply.header("cache-control", "no-store"); });
  app.get('/inventory-duplicates', { preHandler: [authenticate, requirePlatformAdmin] }, async (request) => {
    return listInventoryDuplicates(inventoryDuplicatesQuery.parse(request.query));
  });
  app.get('/imei-tac-misses', { preHandler: [authenticate, requirePlatformAdmin] }, async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).strict().parse(request.query);
    return listTacMisses(limit);
  });
  app.get('/funnel', { preHandler: [authenticate, requirePlatformAdmin] }, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const query = z.object({ range: z.enum(['7d', '30d', 'all']).default('30d'), tests: z.enum(['hide', 'show']).default('hide') }).strict().parse(request.query);
    return getFunnel(query.range, query.tests);
  });
  app.get('/stores/:id/timeline', { preHandler: [authenticate, requirePlatformAdmin] }, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const { id } = z.object({ id: z.string().min(1).max(160) }).parse(request.params);
    const result = await getTimeline(id);
    return result ?? reply.code(404).send({ error: 'Not found' });
  });
  // INTERNAL marks every store that predates subscriptions. It does not identify a person.
  // Only verified token emails in ADMIN_EMAILS can read internal activity.
  app.get("/store-activity", { preHandler: [authenticate, requirePlatformAdmin] }, async (request, reply) => {
    reply.header("cache-control", "no-store");
    const query = querySchema.parse(request.query);
    return listStoreActivity(query.range ?? "30d");
  });
}
