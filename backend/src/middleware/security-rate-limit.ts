import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from './authenticate.js';

const MINUTE = 60_000;
type Policy = { group: string; user: number; ip: number; windowMs: number };
const policy = (group: string, user: number, windowMs = MINUTE): Policy => ({ group, user, ip: 600, windowMs });

/** Group related routes; query strings, invitation guesses and refreshed tokens never create new quotas. */
export function securityPolicy(method: string, route: string): Policy | undefined {
  const path = route.replace(/\/$/, '');
  const read = method === 'GET' || method === 'HEAD';
  if (read && path === '/api/invitations/preview/:token') return { group: 'invite-preview', user: 0, ip: 60, windowMs: MINUTE };
  if (read && (path === '/api/me' || path === '/api/me/admin')) return policy('session', 120);
  if (method === 'POST' && path === '/api/onboarding') return policy('onboarding', 10);
  if (method === 'POST' && path === '/api/invitations/accept') return policy('invite-accept', 20);
  if (path === '/api/invitations' && read) return policy('invite-list', 60);
  if ((method === 'POST' && path === '/api/invitations') || (method === 'DELETE' && path === '/api/invitations/:id')) return policy('invite-manage', 30);
  if (method === 'POST' && path === '/api/import/analyze-text') return policy('ai-text', 20, 10 * MINUTE);
  if (method === 'POST' && ['/api/import/analyze', '/api/import/apply'].includes(path)) return policy('import-analysis', 20);
  if (method === 'POST' && ['/api/inventory/import', '/api/sales/import', '/api/clients/import', '/api/trade-ins/import', '/admin/inventory-import'].includes(path)) return policy('import-write', 20);
  if (read && path.startsWith('/api/reports/')) return policy('reports', 60);
  if (method === 'POST' && path === '/api/stores/current/periodic-report/test') return policy('report-mail', 5);
  return undefined;
}

/** Fixed windows, bounded memory, no token/email storage and no eviction of live quotas. Per app instance. */
export function createSecurityQuota(now: () => number = Date.now, capacity = 20_000) {
  const entries = new Map<string, { count: number; expires: number }>();
  let nextSweep = 0;
  return (key: string, limit: number, windowMs: number): number => {
    const time = now();
    if (time >= nextSweep || entries.size >= capacity) {
      for (const [id, entry] of entries) if (entry.expires <= time) entries.delete(id);
      nextSweep = time + MINUTE;
    }
    let entry = entries.get(key);
    if (!entry || entry.expires <= time) {
      if (!entry && entries.size >= capacity) return Math.ceil(windowMs / 1000);
      entry = { count: 0, expires: time + windowMs };
      entries.set(key, entry);
    }
    if (entry.count >= limit) return Math.max(1, Math.ceil((entry.expires - time) / 1000));
    entry.count++;
    return 0;
  };
}

function tooMany(reply: FastifyReply, retry: number) {
  return reply.header('Retry-After', String(retry)).code(429).send({ error: 'Demasiadas solicitudes. Esperá y volvé a intentar.' });
}

/** Install before routes. IP runs before parsing/auth; UID runs immediately after authentication, before PG. */
export function registerSecurityRateLimits(app: FastifyInstance) {
  const consume = createSecurityQuota();
  const installed = new WeakSet<Function>();
  app.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const selected = methods.map(method => securityPolicy(method, route.url)).find(Boolean);
    if (!selected) return;
    const requestHooks = Array.isArray(route.onRequest) ? route.onRequest : route.onRequest ? [route.onRequest] : [];
    // Fastify reuses options for the slash/no-slash aliases of prefixed root routes.
    if (requestHooks.some(hook => installed.has(hook))) return;
    const ipLimit = async (request: FastifyRequest, reply: FastifyReply) => {
      const retry = consume(`ip:${selected.group}:${request.ip}`, selected.ip, MINUTE);
      if (retry) return tooMany(reply, retry);
    };
    installed.add(ipLimit);
    route.onRequest = [ipLimit, ...requestHooks];
    if (!selected.user) return;
    const handlers = Array.isArray(route.preHandler) ? [...route.preHandler] : route.preHandler ? [route.preHandler] : [];
    const authIndex = handlers.indexOf(authenticate);
    if (authIndex < 0) throw new Error(`Security quota requires explicit authenticate on ${route.url}`);
    handlers.splice(authIndex + 1, 0, async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: 'Unauthenticated' });
      const retry = consume(`user:${selected.group}:${request.auth.firebaseUid}`, selected.user, selected.windowMs);
      if (retry) return tooMany(reply, retry);
    });
    route.preHandler = handlers;
  });
}
