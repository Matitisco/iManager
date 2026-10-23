import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
const { getApp } = useIntegrationApp();
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const post = (tac: string, uid = 'test-owner') => getApp().inject({ method: 'POST', url: '/api/imei-tac-misses', headers: buildAuthHeaders({ uid }), payload: { tac } });

describe('TAC miss ingestion', () => {
  it('requires auth and strictly accepts only eight digit TAC', async () => {
    expect((await getApp().inject({ method: 'POST', url: '/api/imei-tac-misses', payload: { tac: '00000001' } })).statusCode).toBe(401);
    for (const payload of [{ tac: '1234567' }, { tac: '123456789' }, { tac: '123456781234567' }, { tac: 'abcdefgh' }, { tac: '12345678\n' }, { tac: 12345678 }, { tac: '00000001', imei: '123456781234567' }, {}]) {
      const response = await getApp().inject({ method: 'POST', url: '/api/imei-tac-misses', headers: buildAuthHeaders(), payload });
      expect(response.statusCode, response.body).toBe(400);
    }
    expect(await prisma.imeiTacMiss.count()).toBe(0);
  });
  it('increments atomically across users, retains firstSeenAt and updates lastSeenAt', async () => {
    await seedStoreContext();
    expect((await post('00000001')).statusCode).toBe(204);
    const first = await prisma.imeiTacMiss.findUniqueOrThrow({ where: { tac: '00000001' } });
    await prisma.imeiTacMiss.update({ where: { tac: first.tac }, data: { lastSeenAt: new Date(0) } });
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => post('00000001', i % 2 ? 'test-owner' : 'second-user')));
    expect(responses.every(response => response.statusCode === 204 && response.body === '')).toBe(true);
    const result = await prisma.imeiTacMiss.findUniqueOrThrow({ where: { tac: '00000001' } });
    expect(result.count).toBe(11);
    expect(result.firstSeenAt).toEqual(first.firstSeenAt);
    expect(result.lastSeenAt.getTime()).toBeGreaterThan(0);
    expect(Object.keys(result).sort()).toEqual(['count', 'firstSeenAt', 'lastSeenAt', 'tac']);
  });
  it('limits each user to 60 per minute, silently drops excess and resets the window', async () => {
    await seedStoreContext();
    for (let i = 0; i < 62; i++) expect((await post('00000002')).statusCode).toBe(204);
    expect((await prisma.imeiTacMiss.findUniqueOrThrow({ where: { tac: '00000002' } })).count).toBe(60);
    expect((await post('00000002', 'other-user')).statusCode).toBe(204);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60001);
    expect((await post('00000002')).statusCode).toBe(204);
    expect((await prisma.imeiTacMiss.findUniqueOrThrow({ where: { tac: '00000002' } })).count).toBe(62);
  });
});

describe('platform admin TAC misses', () => {
  it('denies store owners and unverified admins, orders by count, limits and exposes no identity', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'platform@example.com');
    await seedStoreContext();
    await prisma.imeiTacMiss.createMany({ data: [{ tac: '00000003', count: 2 }, { tac: '00000001', count: 5 }, { tac: '00000002', count: 5 }] });
    const url = '/admin/imei-tac-misses';
    expect((await getApp().inject({ method: 'GET', url })).statusCode).toBe(401);
    expect((await getApp().inject({ method: 'GET', url, headers: buildAuthHeaders() })).statusCode).toBe(403);
    const headers = { Authorization: `Bearer ${createTestAuthToken({ uid: 'platform', email: 'platform@example.com', emailVerified: true })}` };
    const unverified = { Authorization: `Bearer ${createTestAuthToken({ uid: 'platform', email: 'platform@example.com', emailVerified: false })}` };
    expect((await getApp().inject({ method: 'GET', url, headers: unverified })).statusCode).toBe(403);
    const response = await getApp().inject({ method: 'GET', url, headers });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().items.map((item: { tac: string }) => item.tac)).toEqual(['00000001', '00000002', '00000003']);
    expect(Object.keys(response.json().items[0]).sort()).toEqual(['count', 'firstSeenAt', 'lastSeenAt', 'tac']);
    expect((await getApp().inject({ method: 'GET', url: `${url}?limit=1`, headers })).json().items).toHaveLength(1);
    for (const limit of ['0', '501', '1.5', 'bad']) expect((await getApp().inject({ method: 'GET', url: `${url}?limit=${limit}`, headers })).statusCode).toBe(400);
    expect((await getApp().inject({ method: 'GET', url: `${url}?limit=500`, headers })).statusCode).toBe(200);
  });
});
