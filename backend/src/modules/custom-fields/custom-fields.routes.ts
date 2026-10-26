import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { requireMember, requireSectionAccess } from '../../middleware/section-access.js';
import { prisma } from '../../plugins/prisma.js';
import { definitionSchema, listDefinitions } from './custom-fields.service.js';

export async function customFieldRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', resolveAppUser);
  app.addHook('preHandler', requireSectionAccess('inventory'));
  app.get('/', async request => { requireMember(request); return { definitions: await listDefinitions(request.appUser.storeId) }; });
  app.post('/', async (request, reply) => {
    requireMember(request);
    const input = definitionSchema.parse(request.body);
    const definition = await prisma.customFieldDefinition.create({ data: { ...input, storeId: request.appUser.storeId } });
    return reply.code(201).send({ definition });
  });
  app.patch('/:id', async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    // Key and type are immutable so stored values keep their meaning.
    const data = definitionSchema.pick({ label: true, order: true }).partial().strict().parse(request.body);
    const updated = await prisma.customFieldDefinition.updateMany({ where: { id, storeId: request.appUser.storeId, archivedAt: null }, data });
    if (!updated.count) return reply.code(404).send({ error: 'No encontramos ese campo' });
    return { definition: await prisma.customFieldDefinition.findFirst({ where: { id, storeId: request.appUser.storeId } }) };
  });
  app.delete('/:id', async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const updated = await prisma.customFieldDefinition.updateMany({ where: { id, storeId: request.appUser.storeId, archivedAt: null }, data: { archivedAt: new Date() } });
    return updated.count ? reply.code(204).send() : reply.code(404).send({ error: 'No encontramos ese campo' });
  });
}
