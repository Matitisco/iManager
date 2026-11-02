import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
import { latestPosthogActions, posthogHistory, type PosthogRow } from './posthog-history.js';
import { getStoreHistory, historyQuery, latestStoreActions } from './store-history.service.js';
vi.mock('./posthog-history.js', () => ({ posthogHistory: vi.fn(), latestPosthogActions: vi.fn() }));
const { getApp } = useIntegrationApp();
const headers = () => buildAuthHeaders({ uid: 'admin-reader', email: 'admin@internal.test' });
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', 'admin@internal.test');
  vi.mocked(posthogHistory).mockReset().mockResolvedValue([]);
  vi.mocked(latestPosthogActions).mockReset().mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
const at = new Date('2026-10-31T15:00:00Z');
function audit(storeId: string, userId: string, id: string, action = 'sale.created', createdAt = at, entityId = id) {
  return prisma.auditEvent.create({ data: { id, storeId, actorUserId: userId, actorName: 'Lucía', actorRole: 'OWNER', action, entityType: 'sale', entityId, createdAt,
    entityLabel: 'Cliente secreto', detail: 'Teléfono 1155559999 · $ 99999', changes: [{ field: 'amount', after: '99999' }], reason: 'Cliente privado' } });
}
function remote(storeId: string, userId: string, id: string, name: string, timestamp = at, entityId: string | null = null): PosthogRow {
  return { id: `p:${id}`, storeId, userId, name, at: timestamp, entityId, role: 'OWNER', props: {} };
}

describe('admin store action history', () => {
  it('guards history with 401/403, including unverified admins, before querying any source', async () => {
    const app = getApp();
    expect((await app.inject({ method: 'GET', url: '/admin/stores/secret/history' })).statusCode).toBe(401);
    for (const [email, emailVerified] of [['other@example.test', true], ['admin@internal.test', false]] as const) {
      const response = await app.inject({ method: 'GET', url: '/admin/stores/secret/history', headers: { Authorization: `Bearer ${createTestAuthToken({ uid: 'denied', email, emailVerified })}` } });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(posthogHistory).not.toHaveBeenCalled();
  });
  it('returns newest first, actor and role, never private audit fields or another store', async () => {
    const { store, user } = await seedStoreContext({ displayName: 'Lucía' });
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.test' });
    await audit(store!.id, user.id, 'old', 'inventory.created', new Date(at.getTime() - 1000));
    await audit(store!.id, user.id, 'new');
    await audit(other.store!.id, other.user.id, 'foreign');
    const response = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/history`, headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.json().actions.map((a: { id: string }) => a.id)).toEqual(['a:new', 'a:old']);
    expect(response.json().actions[0]).toMatchObject({ text: 'Registró una venta', actor: { name: 'Lucía', role: 'Dueño' } });
    for (const secret of ['Cliente secreto', '1155559999', '99999', 'Cliente privado', 'foreign', 'entityLabel', 'changes', 'reason']) expect(response.body).not.toContain(secret);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('applies inclusive Buenos Aires dates and categories to local and external sources', async () => {
    const { store, user } = await seedStoreContext();
    for (const [id, timestamp] of [['before', '2026-10-31T02:59:59.999Z'], ['start', '2026-10-31T03:00:00Z'], ['end', '2026-11-01T02:59:59.999Z'], ['after', '2026-11-01T03:00:00Z']]) await audit(store!.id, user.id, id, 'sale.created', new Date(timestamp));
    await audit(store!.id, user.id, 'inventory', 'inventory.created');
    const result = await getStoreHistory(store!.id, historyQuery.parse({ from: '2026-10-31', to: '2026-10-31', type: 'sales' }));
    expect(result!.actions.map(a => a.id)).toEqual(['a:end', 'a:start']);
    expect(posthogHistory).toHaveBeenLastCalledWith(store!.id, expect.objectContaining({ from: new Date('2026-10-31T03:00:00Z'), to: new Date('2026-11-01T03:00:00Z'), type: 'sales' }));
    expect((await getStoreHistory(store!.id, historyQuery.parse({ type: 'inventory' })))!.actions.map(a => a.id)).toEqual(['a:inventory']);
  });
  it('paginates ties, holds the snapshot and has no repeats or missing local actions', async () => {
    const { store, user } = await seedStoreContext();
    for (const id of ['a', 'b', 'c', 'd', 'e']) await audit(store!.id, user.id, id);
    const now = new Date('2026-11-01T12:00:00Z');
    const first = await getStoreHistory(store!.id, historyQuery.parse({ limit: 2 }), now);
    await audit(store!.id, user.id, 'later', 'sale.created', new Date('2026-11-01T12:00:01Z'));
    const second = await getStoreHistory(store!.id, historyQuery.parse({ limit: 2, cursor: first!.nextCursor }));
    const third = await getStoreHistory(store!.id, historyQuery.parse({ limit: 2, cursor: second!.nextCursor }));
    expect([...first!.actions, ...second!.actions, ...third!.actions].map(a => a.id)).toEqual(['a:e', 'a:d', 'a:c', 'a:b', 'a:a']);
    expect(third!.nextCursor).toBeNull();
  });
  it('deduplicates sales by record ID even across pages and preserves different sales', async () => {
    const { store, user } = await seedStoreContext();
    await audit(store!.id, user.id, 'sale-a', 'sale.created', new Date(at.getTime() + 1000), 'record-a');
    const external = [remote(store!.id, user.firebaseUid, 'sale-a', 'sale_created', at, 'record-a'), remote(store!.id, user.firebaseUid, 'sale-b', 'sale_created', at, 'record-b')];
    vi.mocked(posthogHistory).mockImplementation(async (_id, q) => external.filter(e => !q.cursor || e.at < new Date(q.cursor.at) || (e.at.getTime() === Date.parse(q.cursor.at) && e.id < q.cursor.id)).sort((a,b) => b.id.localeCompare(a.id)).slice(0, q.limit));
    const first = await getStoreHistory(store!.id, historyQuery.parse({ limit: 1 }));
    const second = await getStoreHistory(store!.id, historyQuery.parse({ limit: 1, cursor: first!.nextCursor }));
    const third = await getStoreHistory(store!.id, historyQuery.parse({ limit: 1, cursor: second!.nextCursor }));
    expect([...first!.actions, ...second!.actions, ...third!.actions].map(a => a.id)).toEqual(['a:sale-a', 'p:sale-b']);
    expect(third!.nextCursor).toBeNull();
  });
  it('deduplicates invitations across three sources without collapsing two real invitations', async () => {
    const { store, user } = await seedStoreContext({ displayName: 'Lucía' });
    await audit(store!.id, user.id, 'invite-1', 'member.invited');
    await audit(store!.id, user.id, 'invite-2', 'member.invited');
    await prisma.productEvent.create({ data: { name: 'invite_created', storeId: store!.id, userId: user.id, source: 'server', createdAt: at } });
    vi.mocked(posthogHistory).mockResolvedValue([remote(store!.id, user.firebaseUid, 'invite', 'employee_invite_sent')]);
    const result = await getStoreHistory(store!.id, historyQuery.parse({}));
    expect(result!.actions.map(a => a.id)).toEqual(['a:invite-2', 'a:invite-1']);
  });
  it('keeps database data on PostHog failure and does not reveal error details', async () => {
    const { store, user } = await seedStoreContext();
    await audit(store!.id, user.id, 'saved');
    vi.mocked(posthogHistory).mockRejectedValue(new Error('private-api-key upstream body'));
    const response = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/history`, headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.json().actions).toHaveLength(1);
    expect(response.json().warning).toContain('acciones guardadas en la app');
    expect(response.body).not.toContain('private-api-key');
  });
  it('handles missing stores, empty history and invalid queries', async () => {
    expect(await getStoreHistory('missing', historyQuery.parse({}))).toBeNull();
    const { store } = await seedStoreContext();
    expect((await getStoreHistory(store!.id, historyQuery.parse({})))!.actions).toEqual([]);
    for (const query of ['from=2026-02-30', 'from=2026-11-02&to=2026-11-01', 'cursor=bad', 'type=secret', 'limit=200']) {
      const response = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/history?${query}`, headers: headers() });
      expect(response.statusCode).toBe(400);
    }
  });
  it('gets latest actions in batches, including quieter stores and navigation, with fallback', async () => {
    const one = await seedStoreContext();
    const two = await seedStoreContext({ firebaseUid: 'other' });
    await audit(one.store!.id, one.user.id, 'sale');
    await prisma.productEvent.create({ data: { storeId: two.store!.id, userId: two.user.id, name: 'active_day', source: 'server', createdAt: at } });
    vi.mocked(latestPosthogActions).mockResolvedValue([{ ...remote(one.store!.id, one.user.firebaseUid, 'page', '$pageview', new Date(at.getTime() + 1000)), props: { url: 'https://example.test/#/dashboard' } }]);
    const ids = [one.store!.id, two.store!.id];
    const result = await latestStoreActions(ids, new Date('2026-11-02T12:00:00Z'));
    expect(result.actions.get(one.store!.id)?.text).toBe('Abrió Dashboard');
    expect(result.actions.get(two.store!.id)?.text).toBe('Entró a la app');
    expect(latestPosthogActions).toHaveBeenCalledTimes(1);
    vi.mocked(latestPosthogActions).mockRejectedValue(new Error('private'));
    const fallback = await latestStoreActions(ids, new Date('2026-11-02T12:00:00Z'));
    expect(fallback.warning).toBeTruthy();
    expect(fallback.actions.get(one.store!.id)?.text).toBe('Registró una venta');
  });
});
