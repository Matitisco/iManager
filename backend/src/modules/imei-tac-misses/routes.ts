import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { recordTacMiss } from './service.js';

const bodySchema = z.object({ tac: z.string().length(8).regex(/^\d{8}$/) }).strict();
export async function imeiTacMissRoutes(app: FastifyInstance) {
  const limits = new Map<string, { start: number; count: number }>();
  app.post('/imei-tac-misses', { bodyLimit: 1024, preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    const { tac } = bodySchema.parse(request.body);
    const userId = request.appUser?.userId ?? request.analyticsUserId!;
    const now = Date.now();
    let limit = limits.get(userId);
    if (!limit || now - limit.start >= 60000) limit = { start: now, count: 0 };
    const allowed = limit.count < 60;
    if (allowed) limit.count++;
    limits.delete(userId); limits.set(userId, limit);
    for (const [id, entry] of limits) if (now - entry.start >= 60000) limits.delete(id);
    if (limits.size > 5000) limits.delete(limits.keys().next().value!);
    if (allowed) await recordTacMiss(tac);
    return reply.code(204).send();
  });
}
