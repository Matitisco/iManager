import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { env } from './config/env.js';

let app: FastifyInstance;
const initialOrigins = env.CORS_ALLOWED_ORIGINS;
afterEach(async () => { env.CORS_ALLOWED_ORIGINS = initialOrigins; await app?.close(); });

describe('HTTP security boundaries', () => {
  it('does not reflect arbitrary or null origins when the allowlist is absent', async () => {
    env.CORS_ALLOWED_ORIGINS = undefined;
    app = buildApp();
    for (const origin of ['https://attacker.example', 'null', 'https://app.imanager.com.ar.attacker.example']) {
      const response = await app.inject({ url: '/api/health', headers: { origin } });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    }
    const same = await app.inject({ url: '/api/health' });
    expect(same.statusCode).toBe(200);
  });
  it('allows exact configured origins and authenticated preflight without cookie credentials', async () => {
    env.CORS_ALLOWED_ORIGINS = 'https://allowed.example, https://second.example';
    app = buildApp();
    const response = await app.inject({ method: 'OPTIONS', url: '/api/me', headers: {
      origin: 'https://allowed.example', 'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization,x-im-device',
    } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    const blocked = await app.inject({ url: '/api/health', headers: { origin: 'https://allowed.example.attacker.example' } });
    expect(blocked.statusCode).not.toBe(500);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
  it.each(['/api/health', '/api/me', '/api/missing?email=qa-sec-1@example.com', '/swagger.json', '/docs'])('protects success and error responses at %s', async url => {
    app = buildApp();
    const response = await app.inject({ url });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.body).not.toContain('qa-sec-1@example.com');
    if (url.startsWith('/api')) expect(response.headers['cache-control']).toBe('no-store');
  });
});
