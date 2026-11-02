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
    await audit(store!.id, user.id, 'inventory', 'inventory.archived');
    const result = await getStoreHistory(store!.id, historyQuery.parse({ from: '2026-10-31', to: '2026-10-31', type: 'create' }));
    expect(result!.actions.map(a => a.id)).toEqual(['a:end', 'a:start']);
    expect(posthogHistory).toHaveBeenLastCalledWith(store!.id, expect.objectContaining({ from: new Date('2026-10-31T03:00:00Z'), to: new Date('2026-11-01T03:00:00Z'), type: 'create' }));
    expect((await getStoreHistory(store!.id, historyQuery.parse({ type: 'delete' })))!.actions.map(a => a.id)).toEqual(['a:inventory']);
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
  it('shows only the requested domains and successful persisted operations with all four filters', async () => {
    const { store, user } = await seedStoreContext();
    for (const [id, action] of [
      ['load', 'inventory.created'], ['sale', 'sale.created'], ['client', 'client.created'], ['trade', 'trade.created'],
      ['return', 'return.created'], ['repair', 'repair.created'], ['employee', 'member.joined'], ['settings', 'store.updated'],
      ['remove', 'return.cancelled'], ['edit', 'repair.estimate'], ['restore', 'client.restored'],
      ['exclude-cash', 'cash.opened'], ['exclude-supplier', 'supplier.created'], ['exclude-unknown', 'arbitrary.updated'],
      ['exclude-stockcount', 'stockcount.opened'], ['exclude-payment', 'sale.payment'],
    ]) await audit(store!.id, user.id, id, action);
    for (const [name, props] of [['active_day', {}], ['stock_import_finished', { ok: false }], ['stock_import_abandoned', {}], ['first_steps_step_clicked', {}], ['app_installed', {}]] as const) {
      await prisma.productEvent.create({ data: { storeId: store!.id, userId: user.id, name, props, source: 'server', createdAt: at } });
    }
    const all = await getStoreHistory(store!.id, historyQuery.parse({}));
    expect(all!.actions).toHaveLength(12);
    expect(all!.actions.some(a => a.id.includes('exclude-'))).toBe(false);
    for (const [type, count] of [['create', 7], ['delete', 1], ['update', 3], ['connection', 1]] as const) {
      const filtered = await getStoreHistory(store!.id, historyQuery.parse({ type }));
      expect(filtered!.actions).toHaveLength(count);
      expect(filtered!.actions.every(a => a.type === type)).toBe(true);
    }
  });
  it('translates available modified field keys without exposing labels or before/after values', async () => {
    const { store, user } = await seedStoreContext();
    await audit(store!.id, user.id, 'edit', 'client.updated');
    await prisma.auditEvent.update({ where: { id: 'edit' }, data: { changes: [
      { field: 'name', label: 'Private name label', before: 'Private before', after: 'Private after' },
      { field: 'phone', label: 'Private phone', before: '123456789', after: '987654321' },
      { field: '_batchId', after: 'Private batch' }, { field: 'custom:private label', after: 'Private custom value' },
    ] } });
    const response = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/history?type=update`, headers: headers() });
    expect(response.json().actions[0].text).toBe('Editó un cliente · Campos: Nombre, Teléfono');
    expect(response.body).not.toMatch(/Private|private|123456789|987654321|_batchId/);
    const latest = await latestStoreActions([store!.id], new Date('2026-11-02T12:00:00Z'));
    expect(latest.actions.get(store!.id)?.text).toBe('Editó un cliente · Campos: Nombre, Teléfono');
  });
  it('keeps one connection per user and Argentine day before pagination, including remote counterparts outside the page', async () => {
    const { store, user } = await seedStoreContext();
    const other = await prisma.user.create({ data: { firebaseUid: 'employee', email: 'employee@example.test', displayName: 'Empleado' } });
    await prisma.storeMember.create({ data: { storeId: store!.id, userId: other.id, role: 'STAFF' } });
    for (const [id, userId, timestamp] of [
      ['previous-day', user.id, '2026-10-31T02:59:59.999Z'],
      ['first', user.id, '2026-10-31T03:00:00Z'],
      ['repeat', user.id, '2026-10-31T22:00:00Z'],
      ['employee', other.id, '2026-10-31T23:00:00Z'],
      ['next-day', user.id, '2026-11-01T03:00:00Z'],
    ]) await prisma.productEvent.create({ data: { id, storeId: store!.id, userId, name: 'active_day', source: 'server', createdAt: new Date(timestamp) } });
    const external = [remote(store!.id, user.firebaseUid, 'login', 'user_logged_in', new Date('2026-10-31T21:00:00Z'))];
    vi.mocked(posthogHistory).mockImplementation(async (_id, q) => external.filter(e => !q.cursor || e.at < new Date(q.cursor.at) || (e.at.getTime() === Date.parse(q.cursor.at) && e.id < q.cursor.id)).slice(0, q.limit));
    const actions = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await getStoreHistory(store!.id, historyQuery.parse({ type: 'connection', limit: 1, cursor }));
      actions.push(...result!.actions);
      if (!result!.nextCursor) break;
      cursor = result!.nextCursor;
    }
    expect(actions.map(a => a.id)).toEqual(['e:next-day', 'e:employee', 'e:first', 'e:previous-day']);
    expect(actions.every(a => a.text === 'Se conectó')).toBe(true);
    const day = await getStoreHistory(store!.id, historyQuery.parse({ type: 'connection', from: '2026-10-31', to: '2026-10-31' }));
    expect(day!.actions.map(a => a.id)).toEqual(['e:employee', 'e:first']);
    // The latest external query excludes locally recorded days before choosing its last event.
    await latestStoreActions([store!.id], new Date('2026-11-02T12:00:00Z'));
    expect(latestPosthogActions).toHaveBeenLastCalledWith([store!.id], expect.any(Date), expect.arrayContaining([
      { storeId: store!.id, userId: user.id, day: '2026-11-01' },
      { storeId: store!.id, userId: user.firebaseUid, day: '2026-11-01' },
    ]), expect.arrayContaining([{ alias: user.firebaseUid, userId: user.id }]));
  });
  it('deduplicates a former employee connection without revealing their name from external properties', async () => {
    const { store, user } = await seedStoreContext();
    await prisma.productEvent.create({ data: { id: 'connected', storeId: store!.id, userId: user.id, name: 'active_day', source: 'server', createdAt: at } });
    await prisma.storeMember.deleteMany({ where: { storeId: store!.id, userId: user.id } });
    vi.mocked(posthogHistory).mockResolvedValue([remote(store!.id, user.firebaseUid, 'login', 'user_logged_in', new Date(at.getTime() + 1000))]);
    const result = await getStoreHistory(store!.id, historyQuery.parse({ type: 'connection' }));
    expect(result!.actions.map(a => a.id)).toEqual(['e:connected']);
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
    for (const query of ['from=2026-02-30', 'from=2026-11-02&to=2026-11-01', 'cursor=bad', 'type=secret', 'type=navigation', 'type=sales', 'limit=200']) {
      const response = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/history?${query}`, headers: headers() });
      expect(response.statusCode).toBe(400);
    }
  });
  it('gets latest actions in batches, including quieter stores while excluding navigation, with fallback', async () => {
    const one = await seedStoreContext();
    const two = await seedStoreContext({ firebaseUid: 'other' });
    await audit(one.store!.id, one.user.id, 'sale');
    await prisma.productEvent.create({ data: { storeId: two.store!.id, userId: two.user.id, name: 'active_day', source: 'server', createdAt: at } });
    vi.mocked(latestPosthogActions).mockResolvedValue([{ ...remote(one.store!.id, one.user.firebaseUid, 'page', '$pageview', new Date(at.getTime() + 1000)), props: { url: 'https://example.test/#/dashboard' } }]);
    const ids = [one.store!.id, two.store!.id];
    const result = await latestStoreActions(ids, new Date('2026-11-02T12:00:00Z'));
    expect(result.actions.get(one.store!.id)?.text).toBe('Registró una venta');
    expect(result.actions.get(two.store!.id)?.text).toBe('Se conectó');
    expect(latestPosthogActions).toHaveBeenCalledTimes(1);
    vi.mocked(latestPosthogActions).mockRejectedValue(new Error('private'));
    const fallback = await latestStoreActions(ids, new Date('2026-11-02T12:00:00Z'));
    expect(fallback.warning).toBeTruthy();
    expect(fallback.actions.get(one.store!.id)?.text).toBe('Registró una venta');
  });
});
