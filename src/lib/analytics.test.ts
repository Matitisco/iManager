import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../services/api-client';
import { enableAnalyticsInTests, flushAnalytics, rowBucket, setAnalyticsUser, track } from './analytics';
import { analyticsDeviceHeader } from './analytics-device';
vi.mock('../services/api-client', () => ({ apiRequest: vi.fn() }));
const user = { uid: 'u', email: null, displayName: null, getIdToken: async () => 'token' };
beforeEach(() => { vi.useFakeTimers(); vi.mocked(apiRequest).mockReset().mockResolvedValue(undefined); setAnalyticsUser(null); enableAnalyticsInTests(true); });
afterEach(() => { setAnalyticsUser(null); enableAnalyticsInTests(false); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('analytics batching', () => {
  it('does nothing without a user and defaults to disabled in vitest', async () => {
    track('onboarding_name_viewed'); await vi.advanceTimersByTimeAsync(4000); await flushAnalytics();
    expect(apiRequest).not.toHaveBeenCalled();
    setAnalyticsUser(user); enableAnalyticsInTests(false); track('onboarding_name_viewed'); await flushAnalytics();
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('queues events and flushes after 3 seconds with Authorization-capable keepalive', async () => {
    setAnalyticsUser(user); track('stock_method_chosen', { method: 'paste' });
    expect(apiRequest).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(2999); expect(apiRequest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(apiRequest).toHaveBeenCalledWith(user, '/api/events', expect.objectContaining({ method: 'POST', keepalive: true, body: { events: [{ name: 'stock_method_chosen', props: { method: 'paste' }, at: expect.any(String) }] } }));
  });
  it('flushes at ten events, on pagehide and on hidden visibility', async () => {
    setAnalyticsUser(user);
    for (let i = 0; i < 10; i++) track('stock_method_chosen', { method: 'manual' });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect((vi.mocked(apiRequest).mock.calls[0][2].body as { events: unknown[] }).events).toHaveLength(10);
    track('onboarding_name_viewed'); window.dispatchEvent(new Event('pagehide')); await Promise.resolve();
    expect(apiRequest).toHaveBeenCalledTimes(2);
    track('onboarding_stock_viewed'); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });
  it('retries once and silently drops a failed batch', async () => {
    setAnalyticsUser(user); vi.mocked(apiRequest).mockRejectedValue(new Error('offline'));
    track('onboarding_name_viewed'); await expect(flushAnalytics()).resolves.toBeUndefined();
    expect(apiRequest).toHaveBeenCalledTimes(2); await vi.advanceTimersByTimeAsync(10000); expect(apiRequest).toHaveBeenCalledTimes(2);
  });
  it('discards queued and retry events when identity changes or logs out', async () => {
    setAnalyticsUser(user); track('onboarding_name_viewed'); setAnalyticsUser({ ...user, uid: 'other' }); await flushAnalytics(); expect(apiRequest).not.toHaveBeenCalled();
    track('onboarding_name_viewed'); setAnalyticsUser(null); await flushAnalytics(); expect(apiRequest).not.toHaveBeenCalled();
    setAnalyticsUser(user); let fail!: (reason: Error) => void;
    vi.mocked(apiRequest).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
    track('onboarding_name_viewed'); const sending = flushAnalytics(); setAnalyticsUser(null); fail(new Error('offline')); await sending;
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
  it('buckets row counts without sending exact import size', () => {
    expect([1, 2, 10, 11, 50, 51, 1000].map(rowBucket)).toEqual(['1', '2-10', '2-10', '11-50', '11-50', '51+', '51+']);
  });
});
describe('coarse device header', () => {
  it('uses viewport and standalone only', () => {
    window.matchMedia = vi.fn(query => ({ matches: query.includes('760') || query.includes('standalone') })) as unknown as typeof window.matchMedia;
    expect(analyticsDeviceHeader()).toBe('phone;pwa=1');
    window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
    expect(analyticsDeviceHeader()).toBe('desktop');
  });
});
