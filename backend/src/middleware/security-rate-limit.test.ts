import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { createSecurityQuota, registerSecurityRateLimits, securityPolicy } from './security-rate-limit.js';
import { authenticate } from './authenticate.js';
import { createTestAuthToken } from '../testing/test-auth.js';

const headers = (uid = 'qa-sec-10', name?: string) => ({ authorization: `Bearer ${createTestAuthToken({ uid, name })}` });

describe('security quota lifecycle', () => {
  it('counts denied retries without extending the window and resets at expiry', () => {
    let now = 0;
    const consume = createSecurityQuota(() => now);
    expect(consume('user:session:fixture', 2, 60_000)).toBe(0);
    expect(consume('user:session:fixture', 2, 60_000)).toBe(0);
    now = 15_000;
    expect(consume('user:session:fixture', 2, 60_000)).toBe(45);
    now = 60_000;
    expect(consume('user:session:fixture', 2, 60_000)).toBe(0);
  });

  it('refuses new keys at capacity without evicting active quotas, then reclaims expired entries', () => {
    let now = 0;
    const consume = createSecurityQuota(() => now, 1);
    expect(consume('first', 1, 60_000)).toBe(0);
    expect(consume('second', 1, 60_000)).toBe(60);
    expect(consume('first', 1, 60_000)).toBe(60);
    now = 60_000;
    expect(consume('second', 1, 60_000)).toBe(0);
  });
});

describe('Fastify security hooks', () => {
  it('shares GET and HEAD quota, ignores forged identities, and runs before business lookups', async () => {
    const app = Fastify();
    registerSecurityRateLimits(app);
    const lookup = vi.fn(async () => {});
    app.get('/api/me', { preHandler: [authenticate, lookup] }, async () => ({ ok: true }));
    try {
      for (let n = 0; n < 120; n++) expect((await app.inject({ method: n % 2 ? 'GET' : 'HEAD', url: '/api/me', headers: headers() })).statusCode).toBe(200);
      const blocked = await app.inject({ method: 'HEAD', url: '/api/me?fresh=1', headers: { ...headers(undefined, 'Refreshed'), 'x-test-user': 'different-user' }, remoteAddress: '192.0.2.222' });
      expect(blocked.statusCode).toBe(429);
      expect(lookup).toHaveBeenCalledTimes(120);
      expect((await app.inject({ url: '/api/me', headers: headers('qa-sec-11') })).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it('counts prefixed root aliases once and shares their quota', async () => {
    const app = Fastify();
    registerSecurityRateLimits(app);
    app.register(async child => {
      child.post('/', { preHandler: [authenticate] }, async () => ({ ok: true }));
    }, { prefix: '/api/invitations' });
    try {
      for (let n = 0; n < 30; n++) expect((await app.inject({ method: 'POST', url: n % 2 ? '/api/invitations/' : '/api/invitations', headers: headers() })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/api/invitations/', headers: headers() })).statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it('uses the closest untrusted IP only when the socket peer is explicitly trusted', async () => {
    const app = Fastify({ trustProxy: ['127.0.0.1'] });
    registerSecurityRateLimits(app);
    app.get('/api/invitations/preview/:token', async () => ({ ok: true }));
    try {
      for (let n = 0; n < 60; n++) expect((await app.inject({ url: '/api/invitations/preview/guess', headers: { 'x-forwarded-for': `192.0.2.${n + 1}, 198.51.100.1` } })).statusCode).toBe(200);
      expect((await app.inject({ url: '/api/invitations/preview/other-guess', headers: { 'x-forwarded-for': '192.0.2.250, 198.51.100.1' } })).statusCode).toBe(429);
      expect((await app.inject({ url: '/api/invitations/preview/guess', headers: { 'x-forwarded-for': '198.51.100.2' } })).statusCode).toBe(200);
      // Direct callers cannot choose the client IP via headers.
      for (let n = 0; n < 60; n++) expect((await app.inject({ url: '/api/invitations/preview/guess', remoteAddress: '203.0.113.1', headers: { 'x-forwarded-for': `192.0.2.${n + 1}` } })).statusCode).toBe(200);
      expect((await app.inject({ url: '/api/invitations/preview/guess', remoteAddress: '203.0.113.1', headers: { 'x-forwarded-for': '192.0.2.250' } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it.each([
    ['POST', '/api/import/analyze', 20],
    ['POST', '/api/import/apply', 20],
    ['POST', '/api/import/analyze-text', 20],
    ['POST', '/api/sales/import', 20],
    ['POST', '/api/inventory/import', 20],
    ['POST', '/api/clients/import', 20],
    ['POST', '/api/trade-ins/import', 20],
    ['POST', '/admin/inventory-import', 20],
    ['GET', '/api/reports/overview', 60],
    ['POST', '/api/stores/current/periodic-report/test', 5],
    ['POST', '/api/onboarding', 10],
    ['POST', '/api/invitations/accept', 20],
  ] as const)('protects %s %s with an authenticated quota before the handler', async (method, url, limit) => {
    const app = Fastify();
    registerSecurityRateLimits(app);
    const handler = vi.fn(async () => ({ ok: true }));
    app.route({ method, url, preHandler: [authenticate], handler });
    try {
      for (let n = 0; n < limit; n++) expect((await app.inject({ method, url, headers: headers() })).statusCode).toBe(200);
      const blocked = await app.inject({ method, url, headers: headers() });
      expect(blocked.statusCode).toBe(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(handler).toHaveBeenCalledTimes(limit);
    } finally { await app.close(); }
  });

  it('does not impose these quotas on normal POS writes or health checks', () => {
    expect(securityPolicy('POST', '/api/operations')).toBeUndefined();
    expect(securityPolicy('GET', '/api/health')).toBeUndefined();
  });
});
