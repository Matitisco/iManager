import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ productEvent: { createMany: vi.fn() } }));
vi.mock('../../plugins/prisma.js', () => ({ prisma: db }));
import { sanitizeProps, EVENT_NAMES } from './events.js';
import { log, track, trackMany, markFirstSteps } from './track.js';
import { arDayKey, trackActiveDay } from './active-day.js';
import { funnelSteps, stuckAt, median, isOwnerSignup, type FunnelStepId, FUNNEL_STEPS } from '../admin/funnel.service.js';
import { isTestStore } from '../admin/test-stores.js';

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ANALYTICS_DISABLED', '0'); db.productEvent.createMany.mockResolvedValue({ count: 1 }); vi.spyOn(log, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('private props', () => {
  it('drops private keys, free text, wrong enums, non-finite and wrong types', () => {
    expect(sanitizeProps('signup', { via: 'direct', provider: 'google', email: 'private@host.com', name: 'Private' })).toEqual({ via: 'direct', provider: 'google' });
    expect(sanitizeProps('stock_import_finished', { method: 'phone secret', ok: 'true', errors: Infinity, rows: '51+', imei: '123' })).toEqual({ rows: '51+' });
    expect(sanitizeProps('active_day', { device: 'phone', pwa: true, role: 'OWNER', ua: 'private' })).toEqual({ device: 'phone', pwa: true, role: 'OWNER' });
    expect(sanitizeProps('first_steps_opened', { done: 6 })).toEqual({});
    expect(sanitizeProps('first_steps_opened', { done: NaN })).toEqual({});
    for (const name of EVENT_NAMES) expect(sanitizeProps(name, { private: 'never save' })).toEqual({});
  });
  it('accepts only finite bounded counters, booleans and enumerated strings', () => {
    expect(sanitizeProps('stock_import_finished', { method: 'excel', ok: false, rows: '2-10', errors: 2 })).toEqual({ method: 'excel', ok: false, rows: '2-10', errors: 2 });
    expect(sanitizeProps('stock_method_chosen', null)).toEqual({});
  });
});
describe('best-effort writes', () => {
  it('never throws, including when logging fails; disabled means no write', async () => {
    db.productEvent.createMany.mockRejectedValue(new Error('database unavailable'));
    await expect(track({ name: 'signup', userId: 'u' })).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledOnce();
    vi.mocked(log.warn).mockImplementation(() => { throw new Error('logger failed'); });
    await expect(trackMany([{ name: 'first_sale', storeId: 's' }])).resolves.toBeUndefined();
    db.productEvent.createMany.mockClear(); vi.stubEnv('ANALYTICS_DISABLED', '1');
    await track({ name: 'signup' }); expect(db.productEvent.createMany).not.toHaveBeenCalled();
  });
  it('sanitizes and uses skipDuplicates for batch deduplication', async () => {
    await track({ name: 'signup', userId: 'u', dedupeKey: 'signup:u', props: { via: 'direct', email: 'secret' } });
    expect(db.productEvent.createMany).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ source: 'server', props: { via: 'direct' }, dedupeKey: 'signup:u' })] });
  });
  it('marks the five flags and completion with stable store keys', async () => {
    await markFirstSteps('s', 'u', { store: true, stock: true, sale: true, team: true, install: true }, new Date());
    expect(db.productEvent.createMany.mock.calls[0][0].data).toHaveLength(6);
    expect(db.productEvent.createMany.mock.calls[0][0].data.map((e: { dedupeKey: string }) => e.dedupeKey)).toEqual(['step:s:store', 'step:s:stock', 'step:s:sale', 'step:s:team', 'step:s:install', 'steps_done:s']);
  });
});
describe('AR active days', () => {
  it('changes at AR midnight and deduplicates in memory with coarse header props', async () => {
    expect(arDayKey(new Date('2026-10-19T02:59:59Z'))).toBe('2026-10-18');
    expect(arDayKey(new Date('2026-10-19T03:00:00Z'))).toBe('2026-10-19');
    const member = { userId: 'ar-user', storeId: 's', role: 'OWNER' as const };
    trackActiveDay(member, 'phone;pwa=1', new Date('2026-10-19T02:00:00Z'));
    trackActiveDay(member, 'desktop', new Date('2026-10-19T02:30:00Z'));
    trackActiveDay(member, 'private user agent', new Date('2026-10-19T03:00:00Z'));
    await Promise.resolve();
    expect(db.productEvent.createMany).toHaveBeenCalledTimes(2);
    expect(db.productEvent.createMany.mock.calls[0][0].data[0]).toMatchObject({ dedupeKey: 'day:ar-user:2026-10-18', props: { role: 'OWNER', device: 'phone', pwa: true } });
    expect(db.productEvent.createMany.mock.calls[1][0].data[0].props).toEqual({ role: 'OWNER', pwa: false });
  });
});
describe('funnel computation', () => {
  it('finds the first missing core milestone and floors nonsequential dropoffs', () => {
    expect(stuckAt({})).toBe('store_created');
    expect(stuckAt({ store_created: new Date(), first_sale: new Date() })).toBe('stock_viewed');
    const complete = Object.fromEntries(FUNNEL_STEPS.map(([id]) => [id, new Date()]));
    expect(stuckAt(complete)).toBeNull();
    const counts = Object.fromEntries(FUNNEL_STEPS.map(([id]) => [id, 0])) as Record<FunnelStepId, number>;
    Object.assign(counts, { signup: 10, store_created: 8, stock_viewed: 9 });
    expect(funnelSteps(counts)[1]).toMatchObject({ count: 8, pctOfStart: 80, dropFromPrev: 2 });
    expect(funnelSteps(counts)[2].dropFromPrev).toBe(0);
    expect(funnelSteps({ ...counts, signup: 0 })[0].pctOfStart).toBe(0);
    expect(median([8, 2, 4, 6])).toBe(5); expect(median([])).toBeNull();
  });
  it('excludes test stores and invite-only signups but retains invitees who own a store', () => {
    expect(isTestStore({ name: 'QA-caja', ownerEmail: null })).toBe(true);
    expect(isTestStore({ name: 'Local', ownerEmail: 'ab***@EXAMPLE.COM' })).toBe(true);
    expect(isTestStore({ name: 'Palermo', ownerEmail: 'owner@store.com' })).toBe(false);
    expect(isOwnerSignup({ memberships: [], accepted: true, createdStore: false })).toBe(false);
    expect(isOwnerSignup({ memberships: [{ role: 'STAFF' }], accepted: false, createdStore: false })).toBe(false);
    expect(isOwnerSignup({ memberships: [{ role: 'STAFF' }], accepted: true, createdStore: true })).toBe(true);
    expect(isOwnerSignup({ memberships: [], accepted: false, createdStore: false })).toBe(true);
  });
});
