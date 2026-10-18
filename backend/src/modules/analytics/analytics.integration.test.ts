import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
import { completeOnboarding } from '../onboarding/onboarding.service.js';
import { createSale, importSales } from '../sales/sales.service.js';
import { track, trackMany } from './track.js';
import { getGettingStarted } from '../onboarding/getting-started.service.js';
const { getApp } = useIntegrationApp();
const inventoryDefaults = { capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '', cost: 0, price: 0, status: 'DISPONIBLE' };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const eventCount = (name: string, storeId?: string) => prisma.productEvent.count({ where: { name, ...(storeId ? { storeId } : {}) } });
const eventuallyCount = async (name: string, count: number, storeId?: string) => vi.waitFor(async () => { expect(await eventCount(name, storeId)).toBe(count); });

describe('client analytics ingestion', () => {
  it('uses session identity before membership, sanitizes props and builds viewed dedupe keys', async () => {
    const headers = buildAuthHeaders({ uid: 'pre-store', email: 'owner@phone.shop' });
    for (let i = 0; i < 2; i++) {
      const response = await getApp().inject({ method: 'POST', url: '/api/events', headers, payload: { storeId: 'forged-store', userId: 'forged-user', events: [{ name: 'onboarding_name_viewed', storeId: 'forged', userId: 'forged', at: '2026-01-01T00:00:00.000Z', props: { email: 'private@phone.shop', storeName: 'private', ip: '127.0.0.1' } }] } });
      expect(response.statusCode).toBe(204); expect(response.body).toBe('');
    }
    await eventuallyCount('onboarding_name_viewed', 1);
    const user = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: 'pre-store' } });
    const event = await prisma.productEvent.findFirstOrThrow({ where: { name: 'onboarding_name_viewed' } });
    expect(event).toMatchObject({ userId: user.id, storeId: null, source: 'client', props: {}, dedupeKey: `name_viewed:${user.id}`, clientAt: new Date('2026-01-01T00:00:00.000Z') });
  });

  it('requires authentication, rejects server names and unknown keys and bounds request sizes', async () => {
    const app = getApp(); const headers = buildAuthHeaders();
    expect((await app.inject({ method: 'POST', url: '/api/events', payload: { events: [{ name: 'onboarding_name_viewed' }] } })).statusCode).toBe(401);
    for (const payload of [
      { events: [{ name: 'first_sale' }] }, { events: [{ name: 'active_day' }] },
      { events: [{ name: 'stock_method_chosen', dedupeKey: 'forged' }] },
      { unknown: true, events: [{ name: 'stock_method_chosen' }] },
      { events: [] }, { events: Array.from({ length: 21 }, () => ({ name: 'stock_method_chosen' })) },
    ]) expect((await app.inject({ method: 'POST', url: '/api/events', headers, payload })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/events', headers, payload: { events: [{ name: 'stock_method_chosen', props: { text: 'x'.repeat(17000) } }] } })).statusCode).toBe(413);
    expect(await eventCount('first_sale')).toBe(0);
  });

  it('silently drops events above 60 per minute per user and resets the window', async () => {
    const { store, user } = await seedStoreContext();
    const headers = buildAuthHeaders();
    const post = (n: number) => getApp().inject({ method: 'POST', url: '/api/events', headers, payload: { storeId: 'wrong', events: Array.from({ length: n }, () => ({ name: 'stock_method_chosen', props: { method: 'excel', amount: 9000 } })) } });
    for (let i = 0; i < 4; i++) expect((await post(20)).statusCode).toBe(204);
    await eventuallyCount('stock_method_chosen', 60);
    const events = await prisma.productEvent.findMany({ where: { name: 'stock_method_chosen' } });
    expect(events.every(e => e.storeId === store!.id && e.userId === user.id && JSON.stringify(e.props) === '{"method":"excel"}')).toBe(true);
    const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 60001);
    expect((await post(1)).statusCode).toBe(204);
    await eventuallyCount('stock_method_chosen', 61);
  });

  it('continues collecting in billing read-only mode and records active_day only once', async () => {
    const { store, user } = await seedStoreContext({ firebaseUid: 'read-only-analytics' });
    await prisma.store.update({ where: { id: store!.id }, data: { billingPlan: 'TRIAL', billingStatus: 'EXPIRED', trialEndsAt: new Date(0) } });
    const headers = { ...buildAuthHeaders({ uid: user.firebaseUid }), 'x-im-device': 'phone;pwa=1' };
    for (let i = 0; i < 2; i++) expect((await getApp().inject({ method: 'POST', url: '/api/events', headers, payload: { events: [{ name: 'onboarding_stock_viewed' }] } })).statusCode).toBe(204);
    await eventuallyCount('active_day', 1); await eventuallyCount('onboarding_stock_viewed', 1);
    expect(await prisma.productEvent.findFirst({ where: { name: 'active_day' } })).toMatchObject({ userId: user.id, storeId: store!.id, props: { role: 'OWNER', device: 'phone', pwa: true } });
  });
});

describe('verified admin access and JSON', () => {
  it('enforces 401/403/200 and no-store on every admin endpoint and capability probe', async () => {
    vi.stubEnv('ADMIN_EMAILS', ' Admin@Internal.Test ');
    const { store } = await seedStoreContext();
    const urls = ['/admin/store-activity', '/admin/funnel', `/admin/stores/${store!.id}/timeline`, '/api/me/admin'];
    const headers = (email: string, emailVerified: boolean) => ({ Authorization: `Bearer ${createTestAuthToken({ uid: 'admin-check', email, emailVerified })}` });
    for (const url of urls) {
      for (const badHeaders of [undefined, { Authorization: 'Bearer test.invalid' }]) {
        const result = await getApp().inject({ method: 'GET', url, headers: badHeaders });
        expect(result.statusCode).toBe(401); expect(result.headers['cache-control']).toBe('no-store');
      }
      for (const denied of [headers('other@internal.test', true), headers('admin@internal.test', false)]) {
        const result = await getApp().inject({ method: 'GET', url, headers: denied });
        expect(result.statusCode).toBe(403); expect(result.json()).toEqual({ error: 'Forbidden' }); expect(result.headers['cache-control']).toBe('no-store');
      }
      const allowed = await getApp().inject({ method: 'GET', url, headers: headers('  ADMIN@Internal.TEST  ', true) });
      expect(allowed.statusCode, allowed.body).toBe(200); expect(allowed.headers['cache-control']).toBe('no-store');
      if (url === '/api/me/admin') expect(allowed.json()).toEqual({ isAdmin: true });
    }
  });

  it('aggregates historical milestones, methods, AR retention, test filtering and invitee exclusion', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@internal.test');
    const now = new Date(); const start = new Date(now.getTime() - 4 * 86400000);
    const { store, user, membership } = await seedStoreContext({ firebaseUid: 'funnel-owner', email: 'owner@phones.shop' });
    await prisma.user.update({ where: { id: user.id }, data: { createdAt: new Date(start.getTime() - 3600000) } });
    await prisma.store.update({ where: { id: store!.id }, data: { name: 'Palermo', createdAt: start, onboardingStartedAt: start, onboardingCompletedAt: new Date(start.getTime() + 7200000) } });
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { createdAt: start, appInstalled: true } });
    await prisma.inventoryItem.create({ data: { ...inventoryDefaults, storeId: store!.id, model: 'Real', createdAt: new Date(start.getTime() + 3600000) } });
    await prisma.inventoryItem.create({ data: { ...inventoryDefaults, storeId: store!.id, model: 'Sample', sampleBatchId: 'sample', createdAt: new Date(start.getTime() - 3600000) } });
    await prisma.sale.create({ data: { storeId: store!.id, dateLabel: '1/10/2026', soldAt: start, amount: 1, status: 'COMPLETADA', paymentMethod: 'EFECTIVO', createdAt: new Date(start.getTime() + 10800000) } });
    const invitee = await prisma.user.create({ data: { firebaseUid: 'funnel-employee', email: 'staff@phones.shop' } });
    await prisma.storeMember.create({ data: { storeId: store!.id, userId: invitee.id, role: 'STAFF', createdAt: new Date(start.getTime() + 14400000) } });
    await prisma.storeInvitation.create({ data: { storeId: store!.id, role: 'STAFF', status: 'ACCEPTED', expiresAt: now, createdAt: new Date(start.getTime() + 10000000) } });
    const legacy = await prisma.store.create({ data: { name: 'Antigua', createdAt: new Date(start.getTime() - 100 * 86400000) } });
    await prisma.inventoryItem.create({ data: { ...inventoryDefaults, storeId: legacy.id, model: 'Old real' } });
    const test = await seedStoreContext({ firebaseUid: 'funnel-test', email: 'qa@example.com' });
    await trackMany([
      { name: 'onboarding_stock_viewed', storeId: store!.id },
      { name: 'stock_method_chosen', storeId: store!.id, props: { method: 'paste' } },
      { name: 'stock_import_finished', storeId: store!.id, props: { method: 'paste', ok: true, rows: '1', errors: 0 } },
      { name: 'stock_import_abandoned', storeId: store!.id, props: { method: 'excel', at: 'file' } },
      { name: 'invite_accepted', storeId: store!.id, userId: invitee.id },
    ]);
    // Multiple users on one AR date count as one active store day.
    for (const [offset, actor] of [[0, user.id], [1, user.id], [1, invitee.id]] as const) await prisma.productEvent.create({ data: { name: 'active_day', source: 'server', storeId: store!.id, userId: actor, createdAt: new Date(start.getTime() + offset * 86400000) } });
    const headers = buildAuthHeaders({ uid: 'funnel-admin', email: 'admin@internal.test' });
    const response = await getApp().inject({ method: 'GET', url: '/admin/funnel?range=7d&tests=hide', headers });
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json(); const count = (id: string) => body.steps.find((s: { id: string }) => s.id === id).count;
    expect(body.steps.map((s: { id: string }) => s.id)).toHaveLength(12);
    for (const id of ['signup', 'store_created', 'real_stock', 'first_sale', 'team_joined', 'installed', 'steps_done', 'returned']) expect(count(id), id).toBe(1);
    expect(body.retention).toEqual({ nextDay: 1, week1Active: 1, cohort: 1 });
    expect(body.medianHours).toEqual({ signupToStore: 1, storeToRealStock: 1, storeToFirstSale: 3 });
    expect(body.stockMethods.find((m: { method: string }) => m.method === 'paste')).toEqual({ method: 'paste', chosen: 1, finishedOk: 1, abandoned: 0 });
    expect(body.stockMethods.find((m: { method: string }) => m.method === 'excel').abandoned).toBe(1);
    expect((await getApp().inject({ method: 'GET', url: '/admin/funnel?range=all&tests=show', headers })).json().retention.cohort).toBe(3);
    const timeline = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/timeline`, headers });
    expect(timeline.statusCode, timeline.body).toBe(200);
    expect(timeline.json().store).toMatchObject({ ownerEmail: 'ow***@phones.shop', stuckAt: null, activeDays30: 2 });
    const dates = timeline.json().events.map((e: { at: string }) => e.at);
    expect(dates).toEqual([...dates].sort());
    expect(timeline.json().events).toContainEqual(expect.objectContaining({ name: 'real_stock', source: 'derived' }));
    expect(timeline.body).not.toContain('owner@phones.shop');
    const oldTimeline = (await getApp().inject({ method: 'GET', url: `/admin/stores/${legacy.id}/timeline`, headers })).json();
    expect(oldTimeline.events).toContainEqual(expect.objectContaining({ name: 'real_stock', source: 'derived' }));
    const activity = (await getApp().inject({ method: 'GET', url: '/admin/store-activity?range=all', headers })).json();
    expect(activity.stores.find((s: { id: string }) => s.id === store!.id)).toMatchObject({ stuckAt: null, activeDays30: 2 });
    expect(activity.stores.find((s: { id: string }) => s.id === test.store!.id)).toMatchObject({ stuckAt: 'stock_viewed', activeDays30: 0 });
    expect((await getApp().inject({ method: 'GET', url: '/admin/stores/missing/timeline', headers })).statusCode).toBe(404);
    for (const query of ['range=1d', 'tests=maybe']) expect((await getApp().inject({ method: 'GET', url: `/admin/funnel?${query}`, headers })).statusCode).toBe(400);
  });

  it('caps a timeline at 500 events and keeps stored free text out of JSON props', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@internal.test');
    const { store } = await seedStoreContext();
    await prisma.productEvent.createMany({ data: Array.from({ length: 510 }, (_, i) => ({ storeId: store!.id, name: 'stock_method_chosen', source: 'client', props: { method: 'manual', email: 'private@host.com' }, createdAt: new Date(Date.now() + i) })) });
    const response = await getApp().inject({ method: 'GET', url: `/admin/stores/${store!.id}/timeline`, headers: buildAuthHeaders({ email: 'admin@internal.test' }) });
    expect(response.json().events).toHaveLength(500); expect(response.body).not.toContain('private@host.com');
  });
});

describe('server events after successful domain commits', () => {
  it('creates signup, store and first step only once across concurrent onboarding requests', async () => {
    const auth = { firebaseUid: 'new-analytics-owner', email: 'owner@phone.shop', signInProvider: 'google.com' };
    const sessions = await Promise.all([completeOnboarding(auth, { storeName: 'Palermo' }), completeOnboarding(auth, { storeName: 'Palermo' })]);
    expect(sessions[0].store!.id).toBe(sessions[1].store!.id);
    await eventuallyCount('signup', 1); await eventuallyCount('onboarding_name_completed', 1); await eventuallyCount('first_step_completed', 1);
    expect(await prisma.productEvent.findFirst({ where: { name: 'signup' } })).toMatchObject({ props: { via: 'direct', provider: 'google' } });
    const headers = buildAuthHeaders({ uid: auth.firebaseUid, email: auth.email });
    for (let i = 0; i < 2; i++) expect((await getApp().inject({ method: 'PATCH', url: '/api/onboarding/progress', headers, payload: { complete: true, completedVia: 'skip', installed: true, installedHow: 'manual' } })).statusCode).toBe(200);
    await eventuallyCount('onboarding_completed', 1); await eventuallyCount('app_installed', 1);
    expect(await prisma.productEvent.findFirst({ where: { name: 'onboarding_completed' } })).toMatchObject({ props: { via: 'skip' } });
  });

  it('tracks first sale once through legacy and import paths, with no event on rollback', async () => {
    const { store } = await seedStoreContext();
    const input = { deviceLabel: 'Equipo', amount: 10, date: '18/10/2026', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' };
    await expect(createSale(store!.id, { ...input, productId: 'missing' })).rejects.toThrow();
    expect(await eventCount('first_sale')).toBe(0);
    await createSale(store!.id, input); await createSale(store!.id, input);
    await eventuallyCount('first_sale', 1, store!.id);
    expect(await prisma.productEvent.findFirst({ where: { name: 'first_sale', storeId: store!.id } })).toMatchObject({ props: { source: 'form' } });
    const importedStore = await prisma.store.create({ data: { name: 'Importada' } });
    expect(await importSales(importedStore.id, [{ device: 'Equipo', amount: '10' }, { device: 'Otro', amount: '20' }])).toMatchObject({ imported: 2, errors: [] });
    await eventuallyCount('first_sale', 1, importedStore.id);
    expect(await prisma.productEvent.findFirst({ where: { name: 'first_sale', storeId: importedStore.id } })).toMatchObject({ props: { source: 'import' } });
  });

  it('covers the real sales HTTP operation path and preserves the response', async () => {
    const { store } = await seedStoreContext({ firebaseUid: 'operation-analytics' });
    const headers = buildAuthHeaders({ uid: 'operation-analytics' });
    const response = await getApp().inject({ method: 'POST', url: '/api/sales', headers, payload: { deviceLabel: 'Equipo', amount: 10, date: '18/10/2026', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' } });
    expect(response.statusCode, response.body).toBe(201); expect(response.json().sale).toBeTruthy();
    await eventuallyCount('first_sale', 1, store!.id);
  });

  it('tracks each created invitation and only one acceptance, then marks five steps idempotently', async () => {
    const { store, user, membership } = await seedStoreContext({ firebaseUid: 'inviter-analytics' });
    const headers = buildAuthHeaders({ uid: user.firebaseUid });
    const created = await getApp().inject({ method: 'POST', url: '/api/invitations', headers, payload: { role: 'STAFF' } });
    expect(created.statusCode, created.body).toBe(201); await eventuallyCount('invite_created', 1);
    const token = created.json().token;
    const accept = () => getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: buildAuthHeaders({ uid: 'accepted-analytics' }), payload: { token } });
    expect((await accept()).statusCode).toBe(200); expect((await accept()).statusCode).toBe(410);
    await eventuallyCount('invite_accepted', 1);
    expect(await prisma.productEvent.findFirst({ where: { name: 'invite_created' } })).toMatchObject({ props: { role: 'STAFF', nth: 1 } });
    expect(await prisma.productEvent.findFirst({ where: { name: 'invite_accepted' } })).toMatchObject({ dedupeKey: `invite_acc:${created.json().id}`, props: { role: 'STAFF', hoursToAccept: expect.any(Number) } });
    await prisma.inventoryItem.create({ data: { ...inventoryDefaults, storeId: store!.id, model: 'Real' } });
    await createSale(store!.id, { deviceLabel: 'Equipo', amount: 10, date: '18/10/2026', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' });
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { appInstalled: true } });
    for (let i = 0; i < 2; i++) await getGettingStarted({ storeId: store!.id, userId: user.id, role: 'OWNER' });
    await eventuallyCount('first_step_completed', 5); await eventuallyCount('first_steps_finished', 1);
  });

  it('tracks sample loading/deleting without advancing real-stock progress and cascades on store deletion', async () => {
    const { store, user } = await seedStoreContext({ firebaseUid: 'sample-analytics' });
    await prisma.store.update({ where: { id: store!.id }, data: { onboardingStartedAt: new Date() } });
    const headers = buildAuthHeaders({ uid: user.firebaseUid });
    for (let i = 0; i < 2; i++) expect((await getApp().inject({ method: 'POST', url: '/api/onboarding/samples', headers })).statusCode).toBe(200);
    await eventuallyCount('sample_stock_loaded', 1); await eventuallyCount('onboarding_completed', 1);
    expect(await prisma.productEvent.findFirst({ where: { name: 'onboarding_completed' } })).toMatchObject({ props: { via: 'sample' } });
    const progress = await getGettingStarted({ storeId: store!.id, userId: user.id, role: 'OWNER' }); expect(progress.steps.stock).toBe(false);
    for (let i = 0; i < 2; i++) expect((await getApp().inject({ method: 'DELETE', url: '/api/onboarding/samples', headers })).statusCode).toBe(200);
    await eventuallyCount('sample_stock_deleted', 1);
    await prisma.store.delete({ where: { id: store!.id } });
    expect(await prisma.productEvent.count({ where: { storeId: store!.id } })).toBe(0);
  });
});
