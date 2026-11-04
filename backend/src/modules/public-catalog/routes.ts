import { canSeeFinancials } from '../stores/sections.js';
import { catalogPreviewPng } from './preview.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveAppUser } from '../../middleware/resolve-app-user.js';
import { requireMember, requireSectionAccess } from '../../middleware/section-access.js';
import { loadActor } from '../audit/audit.js';
import { catalogEditSchema, catalogPreviewSchema, catalogIdSchema, settingsSchema, visibilitySchema, slugSchema } from './schema.js';
import { createStoreCatalog, deleteStoreCatalog, editStoreCatalog, listStoreCatalogs, previewStoreCatalog, getSettings, saveSettings, setVisibility, setStoreCatalogVisibility, getPublicCatalog } from './service.js';

async function owner(request: FastifyRequest, reply: FastifyReply) {
  requireMember(request);
  if (request.appUser.role !== 'OWNER') return reply.code(403).send({ error: 'Solo el propietario puede regenerar el link o borrar un catálogo' });
}
export async function catalogManagementRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', resolveAppUser);
  app.addHook('preHandler', requireSectionAccess('publicCatalog'));
  const permissions = (request: FastifyRequest) => { requireMember(request); return { canChangeActive: request.appUser.role === 'OWNER', financials: canSeeFinancials(request.appUser) }; };
  app.get('/list', async request => {
    requireMember(request);
    return { catalogs: await listStoreCatalogs(request.appUser.storeId, canSeeFinancials(request.appUser)) };
  });
  app.post('/list', async request => {
    requireMember(request);
    return { catalog: await createStoreCatalog(request.appUser.storeId, catalogEditSchema.parse(request.body), await loadActor(request.appUser.userId), permissions(request)) };
  });
  app.patch('/list/:id', async request => {
    requireMember(request);
    const { id } = catalogIdSchema.parse(request.params);
    return { catalog: await editStoreCatalog(request.appUser.storeId, id, catalogEditSchema.parse(request.body), await loadActor(request.appUser.userId), permissions(request)) };
  });
  app.patch('/list/:id/items', async request => {
    requireMember(request);
    const { id } = catalogIdSchema.parse(request.params);
    const { ids, visible } = visibilitySchema.parse(request.body);
    return { catalog: await setStoreCatalogVisibility(request.appUser.storeId, id, ids, visible, await loadActor(request.appUser.userId), canSeeFinancials(request.appUser)) };
  });
  app.post('/list/:id/regenerate', { preHandler: owner }, async request => {
    requireMember(request);
    return { catalog: await editStoreCatalog(request.appUser.storeId, catalogIdSchema.parse(request.params).id, {}, await loadActor(request.appUser.userId), permissions(request), true) };
  });
  app.delete('/list/:id', { preHandler: owner }, async request => {
    requireMember(request);
    await deleteStoreCatalog(request.appUser.storeId, catalogIdSchema.parse(request.params).id, await loadActor(request.appUser.userId));
    return { ok: true };
  });
  app.post('/preview', async request => {
    requireMember(request);
    const { catalogId, ...input } = catalogPreviewSchema.parse(request.body);
    return previewStoreCatalog(request.appUser.storeId, catalogId, input, canSeeFinancials(request.appUser));
  });
  app.get('/', async request => { requireMember(request); return { catalog: await getSettings(request.appUser.storeId, canSeeFinancials(request.appUser)) }; });
  app.patch('/', async request => {
    requireMember(request);
    return { catalog: await saveSettings(request.appUser.storeId, settingsSchema.parse(request.body), await loadActor(request.appUser.userId), false, { canChangeActive: request.appUser.role === 'OWNER', financials: canSeeFinancials(request.appUser) }) };
  });
  app.post('/regenerate', { preHandler: owner }, async request => {
    requireMember(request);
    return { catalog: await saveSettings(request.appUser.storeId, {}, await loadActor(request.appUser.userId), true) };
  });
  app.patch('/items', async request => {
    requireMember(request);
    const body = visibilitySchema.parse(request.body);
    return { catalog: await setVisibility(request.appUser.storeId, body.ids, body.visible, await loadActor(request.appUser.userId), canSeeFinancials(request.appUser)) };
  });
}
// Bounded, per-process limiter. Never trust caller-supplied X-Forwarded-For.
export function createPublicRateLimiter(limit = 60, windowMs = 60_000) {
  const clients = new Map<string, { count: number; expires: number }>();
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now();
    for (const [ip, entry] of clients) if (entry.expires <= now) clients.delete(ip);
    let entry = clients.get(request.ip);
    if (!entry) {
      if (clients.size >= 10000) return reply.header('Retry-After', '60').code(429).send({ error: 'Demasiadas consultas. Volvé a intentar en un minuto.' });
      entry = { count: 0, expires: now + windowMs }; clients.set(request.ip, entry);
    }
    if (++entry.count > limit) return reply.header('Retry-After', String(Math.max(1, Math.ceil((entry.expires - now) / 1000)))).code(429).send({ error: 'Demasiadas consultas. Volvé a intentar en un minuto.' });
  };
}
export async function publicCatalogRoutes(app: FastifyInstance, { readLimit = 60 }: { readLimit?: number }) {
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); reply.header('X-Content-Type-Options', 'nosniff'); });
  app.addHook('onRequest', createPublicRateLimiter(readLimit));
  app.get('/:slug/preview.png', async (request, reply) => {
    const { slug } = slugSchema.parse(request.params);
    const catalog = await getPublicCatalog(slug);
    if (!catalog) return reply.code(404).send({ error: 'Catálogo no disponible' });
    return reply.type('image/png').send(await catalogPreviewPng(catalog));
  });
  app.get('/:slug', async (request, reply) => {
    const { slug } = slugSchema.parse(request.params);
    const catalog = await getPublicCatalog(slug);
    if (!catalog) return reply.code(404).send({ error: 'Catálogo no disponible' });
    return catalog;
  });
}
