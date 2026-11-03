import { writeFile } from 'node:fs/promises';
import type { InjectOptions } from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

// Every unauthenticated route is explicit. Token preview and public catalog reads
// intentionally use opaque capability URLs; the payment webhook verifies its signature.
const publicRoutes = new Set([
  'GET /api/health',
  'GET /api/invitations/preview/:token',
  'GET /api/public/catalog/:slug',
  'GET /api/public/catalog/:slug/preview.png',
  'POST /webhooks/mercadopago',
]);

describe('security: complete backend authentication inventory', () => {
  it('requires authentication on every registered business route', async () => {
    const app = buildApp();
    const routes: { method: string; url: string; preHandlers: string[] }[] = [];
    app.addHook('onRoute', route => {
      const preHandlers = !route.preHandler ? [] : Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler];
      for (const method of Array.isArray(route.method) ? route.method : [route.method]) {
        if (method === 'HEAD' || method === 'OPTIONS') continue;
        routes.push({ method, url: route.url, preHandlers: preHandlers.map(fn => fn.name) });
      }
    });
    try {
      await app.ready();
      expect(routes.length).toBeGreaterThan(150);
      const uniqueRoutes = [...new Map(routes.map(route => [`${route.method} ${route.url}`, route])).values()];
      const observedPublic: string[] = [];
      const inventory = [];
      for (const route of uniqueRoutes) {
        const key = `${route.method} ${route.url}`;
        const url = route.url.replace(/:[^/]+/g, 'security-nonexistent');
        const response = await app.inject({ method: route.method as InjectOptions['method'], url, ...(route.method === 'QUERY' ? { payload: {} } : {}) });
        if (publicRoutes.has(key)) observedPublic.push(key);
        else expect(response.statusCode, key).toBe(401);
        inventory.push({ ...route, anonymousStatus: response.statusCode, public: publicRoutes.has(key) });
      }
      expect(observedPublic.sort()).toEqual([...publicRoutes].sort());
      // Optional local report contains route names/statuses only, never requests or credentials.
      if (process.env.SECURITY_ROUTE_INVENTORY) await writeFile(process.env.SECURITY_ROUTE_INVENTORY, JSON.stringify(inventory, null, 2));
    } finally {
      await app.close();
    }
  }, 60_000);
});
