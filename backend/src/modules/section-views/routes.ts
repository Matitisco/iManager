import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { requireMember, requireSectionAccess } from '../../middleware/section-access.js';
import { canAccessSection } from '../stores/sections.js';
import { listSectionChanges, markSectionViewed, VIEW_SECTIONS } from './service.js';

const params = z.object({ section: z.enum(VIEW_SECTIONS) });
const body = z.object({ versions: z.array(z.object({ id: z.string().min(1).max(120), updatedAt: z.string().datetime() })).max(10000) });

export async function sectionViewsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];
  app.get('/', { preHandler }, async request => {
    requireMember(request);
    const { storeId, userId } = request.appUser;
    const entries = await Promise.all(VIEW_SECTIONS.filter(section => canAccessSection(section, request.appUser)).map(async section =>
      [section, await listSectionChanges(storeId, userId, section)] as const));
    return { sections: Object.fromEntries(entries) };
  });
  app.post('/:section', { preHandler: [...preHandler, async (request, reply) => {
    const { section } = params.parse(request.params);
    return requireSectionAccess(section)(request, reply);
  }] }, async request => {
    requireMember(request);
    const { section } = params.parse(request.params);
    const { versions } = body.parse(request.body);
    return markSectionViewed(request.appUser.storeId, request.appUser.userId, section, versions);
  });
}
