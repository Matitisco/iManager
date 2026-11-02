import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { latestPosthogActions, posthogHistory } from './posthog-history.js';
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'test-private-key'); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const options = { until: new Date('2026-11-02T15:00:00Z'), limit: 3 };
const reply = (results: unknown) => ({ ok: true, json: async () => ({ results }) });
describe('server-only PostHog queries', () => {
  it('authenticates in headers, bounds/scopes queries, escapes literals and selects no full props', async () => {
    fetchMock.mockResolvedValue(reply([['id', "store'", 1793631600000, 'sale_created', 'uid', 'OWNER', null, null, 'sale-1']]));
    const rows = await posthogHistory("store'", { ...options, type: 'create', from: new Date('2026-11-01T03:00:00Z'), cursor: { at: options.until.toISOString(), id: 'p:id' } });
    expect(rows).toHaveLength(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://us.posthog.com/api/projects/689030/query/');
    expect(request.headers.Authorization).toBe('Bearer test-private-key');
    const query = JSON.parse(request.body).query.query;
    expect(query).toContain("properties.store_id = 'store\\''");
    expect(query).toContain('LIMIT 3');
    expect(query).toContain('concat(\'p:\'');
    expect(query).not.toContain('test-private-key');
    expect(query).not.toContain('SELECT *');
    expect(request.redirect).toBe('error');
  });
  it.each([401, 429, 500])('does not propagate upstream bodies on %s', async status => {
    fetchMock.mockResolvedValue({ ok: false, status, text: async () => 'test-private-key and private body' });
    await expect(posthogHistory('store', options)).rejects.toThrow('Activity source unavailable');
  });
  it('fails safely without a key, on network timeout and malformed payloads', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '');
    await expect(posthogHistory('store', options)).rejects.toThrow('Activity source unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'test-private-key');
    fetchMock.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    await expect(posthogHistory('store', options)).rejects.toThrow();
    fetchMock.mockResolvedValue(reply([['malformed']]));
    await expect(posthogHistory('store', options)).rejects.toThrow('Activity source unavailable');
    fetchMock.mockResolvedValue(reply(null));
    await expect(posthogHistory('store', options)).rejects.toThrow('Activity source unavailable');
  });
  it('queries latest events in one batch with a rank per store', async () => {
    fetchMock.mockResolvedValue(reply([]));
    await latestPosthogActions(['a', 'b'], options.until);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const query = JSON.parse(fetchMock.mock.calls[0][1].body).query.query;
    expect(query).toContain('PARTITION BY store_id');
    expect(query).toContain("IN ('a','b')");
  });
  it('collapses logins per user/day in Argentina before applying the cursor and excludes navigation', async () => {
    fetchMock.mockResolvedValue(reply([]));
    await posthogHistory('store', { ...options, type: 'connection', cursor: { at: options.until.toISOString(), id: 'p:id' } });
    const query = JSON.parse(fetchMock.mock.calls[0][1].body).query.query;
    expect(query).toContain("event IN ('user_logged_in')");
    expect(query).toContain("PARTITION BY properties.store_id, distinct_id, toDate(toTimeZone(timestamp, 'America/Argentina/Buenos_Aires')), event ORDER BY timestamp ASC, uuid ASC");
    expect(query).toContain("WHERE (event != 'user_logged_in' OR daily_rank = 1) AND (at,");
    expect(query).not.toMatch(/pageview|current_url|autocapture/);
  });
  it('excludes local daily connections before selecting the latest action for each store', async () => {
    fetchMock.mockResolvedValue(reply([]));
    await latestPosthogActions(['a'], options.until, [{ storeId: 'a', userId: "u'", day: '2026-11-02' }]);
    const query = JSON.parse(fetchMock.mock.calls[0][1].body).query.query;
    expect(query).toContain("NOT IN (('a', 'u\\'', '2026-11-02'))");
    expect(query).toContain('daily_rank = 1');
    expect(query).not.toContain('$pageview');
  });
  it('does not query the external source for types with no eligible events', async () => {
    expect(await posthogHistory('store', { ...options, type: 'update' })).toEqual([]);
    expect(await posthogHistory('store', { ...options, type: 'delete' })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('consolidates legacy Firebase and internal identities before the daily rank and cursor', async () => {
    fetchMock.mockResolvedValue(reply([]));
    await posthogHistory('store', { ...options, type: 'connection', aliases: [{ alias: 'firebase-id', userId: 'internal-id' }] });
    const query = JSON.parse(fetchMock.mock.calls[0][1].body).query.query;
    expect(query).toContain("PARTITION BY properties.store_id, multiIf(distinct_id = 'firebase-id', 'internal-id', distinct_id)");
    await latestPosthogActions(['store'], options.until, [], [{ alias: 'firebase-id', userId: 'internal-id' }]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).query.query).toContain("PARTITION BY properties.store_id, multiIf(distinct_id = 'firebase-id', 'internal-id', distinct_id)");
  });

});
