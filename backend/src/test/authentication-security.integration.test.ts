import { describe, expect, it, vi } from 'vitest';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { prisma } from '../plugins/prisma.js';

vi.mock('../plugins/firebase-admin.js', () => ({
  getAdminAuth: () => ({
    verifyIdToken: async (_token: string, checkRevoked?: boolean) => {
      if (checkRevoked) throw Object.assign(new Error('fixture revoked'), { code: 'auth/id-token-revoked' });
      return { uid: 'qa-sec-revoked', email: 'qa-sec-1@example.com', email_verified: true };
    },
  }),
}));

const { getApp } = useIntegrationApp();
const identity = (n: number) => buildAuthHeaders({ uid: `qa-sec-${n}`, email: `qa-sec-${n}@example.com` });

describe('authentication security against local PostgreSQL', () => {
  it('rejects a revoked Firebase session before creating a PostgreSQL user', async () => {
    const response = await getApp().inject({ url: '/api/me', headers: { authorization: 'Bearer fixture-revoked' } });
    expect(response.statusCode).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it('limits bridge requests per verified UID, including refreshed tokens and changed IPs', async () => {
    const app = getApp();
    for (let n = 0; n < 120; n++) {
      const response = await app.inject({ url: '/api/me', headers: identity(2) });
      expect(response.statusCode).toBe(200);
    }
    const blocked = await app.inject({ url: '/api/me?bypass=1', remoteAddress: '192.0.2.123', headers: buildAuthHeaders({ uid: 'qa-sec-2', email: 'qa-sec-2@example.com', name: 'Refreshed' }) });
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Another employee at the same NAT still works.
    expect((await app.inject({ url: '/api/me', headers: identity(3) })).statusCode).toBe(200);
  });

  it('limits public preview across different guessed tokens and spoofed forwarding headers', async () => {
    const app = getApp();
    for (let n = 0; n < 60; n++) {
      const response = await app.inject({ url: `/api/invitations/preview/guess-${n}`, headers: { 'x-forwarded-for': `192.0.2.${n + 1}`, 'cf-connecting-ip': `192.0.2.${n + 1}`, 'x-real-ip': `192.0.2.${n + 1}` } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'not_found' });
    }
    expect((await app.inject({ url: '/api/invitations/preview/another-guess' })).statusCode).toBe(429);
    expect((await app.inject({ url: '/api/invitations/preview/another-guess', remoteAddress: '192.0.2.222' })).statusCode).toBe(200);
  });

  it('limits anonymous bridge attempts before Firebase and ignores untrusted forwarding headers', async () => {
    const app = getApp();
    for (let n = 0; n < 600; n++) {
      expect((await app.inject({ url: '/api/me', headers: { 'x-forwarded-for': `192.0.2.${n % 255}` } })).statusCode).toBe(401);
    }
    expect((await app.inject({ url: '/api/me/admin' })).statusCode).toBe(429);
    expect(await prisma.user.count()).toBe(0);
    expect((await app.inject({ url: '/api/me', remoteAddress: '192.0.2.200' })).statusCode).toBe(401);
  });

  it('retains the body size ceiling before processing invitation input', async () => {
    const response = await getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: identity(8), payload: { token: 'x'.repeat(1024 * 1024) } });
    expect(response.statusCode).toBe(413);
    expect(await prisma.user.count()).toBe(0);
  });

  it('answers real loopback HTTP requests with a PostgreSQL session', async () => {
    const app = getApp();
    const origin = await app.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`${origin}/api/me`, { headers: identity(9) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { firebaseUid: 'qa-sec-9', email: 'qa-sec-9@example.com' }, onboardingRequired: true });
  });

  it('limits onboarding while retaining repeated legitimate submissions', async () => {
    const app = getApp();
    for (let n = 0; n < 10; n++) {
      const response = await app.inject({ method: 'POST', url: '/api/onboarding', headers: identity(4), payload: { storeName: 'qa-sec-local' } });
      expect(response.statusCode).toBe(200);
    }
    expect((await app.inject({ method: 'POST', url: '/api/onboarding', headers: identity(4), payload: { storeName: 'qa-sec-local' } })).statusCode).toBe(429);
    expect(await prisma.store.count()).toBe(1);
  });

  it('limits failed invitation acceptance without consuming or altering invitations', async () => {
    const app = getApp();
    for (let n = 0; n < 20; n++) {
      expect((await app.inject({ method: 'POST', url: '/api/invitations/accept', headers: identity(5), payload: { token: `guess-${n}` } })).statusCode).toBe(410);
    }
    expect((await app.inject({ method: 'POST', url: '/api/invitations/accept', headers: identity(5), payload: { token: 'another-guess' } })).statusCode).toBe(429);
    expect(await prisma.storeMember.count()).toBe(0);
  });

  it('limits expensive import analysis before validation, DB work or AI calls', async () => {
    const app = getApp();
    await seedStoreContext({ firebaseUid: 'qa-sec-6', email: 'qa-sec-6@example.com' });
    for (let n = 0; n < 20; n++) {
      expect((await app.inject({ method: 'POST', url: '/api/import/analyze', headers: identity(6), payload: {} })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/api/import/analyze', headers: identity(6), payload: {} })).statusCode).toBe(429);
  });
});
