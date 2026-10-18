import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { CLIENT_EVENT_NAMES } from './events.js';
import { trackMany } from './track.js';

const eventSchema = z.object({ name: z.enum(CLIENT_EVENT_NAMES), props: z.record(z.unknown()).optional(), at: z.string().datetime().optional() }).strict();
// Legacy/forged identity fields are explicitly ignored, while all other unknown keys fail validation.
const ignoredId = z.unknown().optional();
const bodySchema = z.object({ events: z.array(eventSchema.extend({ storeId: ignoredId, userId: ignoredId })).min(1).max(20), storeId: ignoredId, userId: ignoredId }).strict();
export async function analyticsRoutes(app: FastifyInstance) {
  const limits = new Map<string, { start: number; count: number }>();
  app.post('/events', { bodyLimit: 16 * 1024, preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    const body = bodySchema.parse(request.body);
    const userId = request.appUser?.userId ?? request.analyticsUserId!;
    const storeId = request.appUser?.storeId ?? null;
    const now = Date.now();
    let limit = limits.get(userId);
    if (!limit || now - limit.start >= 60000) limit = { start: now, count: 0 };
    const allowed = body.events.slice(0, Math.max(0, 60 - limit.count));
    limit.count += allowed.length;
    limits.delete(userId); limits.set(userId, limit);
    for (const [id, entry] of limits) if (now - entry.start >= 60000) limits.delete(id);
    if (limits.size > 5000) limits.delete(limits.keys().next().value!);
    void trackMany(allowed.map(e => ({ name: e.name, storeId, userId, source: 'client', props: e.props as Record<string, string | number | boolean>, clientAt: e.at ? new Date(e.at) : undefined,
      dedupeKey: e.name === 'onboarding_name_viewed' ? `name_viewed:${userId}` : e.name === 'onboarding_stock_viewed' ? `stock_viewed:${storeId ?? userId}` : undefined,
    })));
    return reply.code(204).send();
  });
}
