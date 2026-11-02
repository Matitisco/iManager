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
    const rows = await posthogHistory("store'", { ...options, type: 'sales', from: new Date('2026-11-01T03:00:00Z'), cursor: { at: options.until.toISOString(), id: 'p:id' } });
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
    expect(query).toContain('PARTITION BY properties.store_id');
    expect(query).toContain("IN ('a','b')");
  });
});
