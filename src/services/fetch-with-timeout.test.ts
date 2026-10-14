import { afterEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from '../lib/user-message';
import { fetchWithTimeout } from './fetch-with-timeout';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchWithTimeout', () => {
  it('honors caller cancellation and clears the timeout', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const result = expect(fetchWithTimeout('/api/public/catalog/store', { signal: caller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    caller.abort(); await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])('normalizes %s at the fetch boundary and keeps the name for retries', async (message) => {
    const cause = new TypeError(message);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause));
    await expect(fetchWithTimeout('/api/trade-ins/1')).rejects.toMatchObject({ name: 'TypeError', message: NETWORK_ERROR_MESSAGE, cause });
  });

  it('recognizes an arbitrary TypeError rejected by fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch rejected')));
    await expect(fetchWithTimeout('/api/me')).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });

  it('distinguishes a timer abort from a network failure even when Safari rejects with TypeError', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new TypeError('Load failed')), { once: true });
    })));
    const result = expect(fetchWithTimeout('/api/me', {}, 50)).rejects.toMatchObject({ name: 'TimeoutError', message: TIMEOUT_ERROR_MESSAGE });
    await vi.advanceTimersByTimeAsync(50);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('maps the default 15-second timeout when fetch throws AbortError', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
    })));
    const result = expect(fetchWithTimeout('/api/me')).rejects.toThrow(TIMEOUT_ERROR_MESSAGE);
    await vi.advanceTimersByTimeAsync(15000);
    await result;
  });

  it('clears the timer after successful and failed requests', async () => {
    vi.useFakeTimers();
    const response = new Response('{}');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response).mockRejectedValueOnce(new TypeError('Failed to fetch')));
    await expect(fetchWithTimeout('/api/me')).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
    await expect(fetchWithTimeout('/api/me')).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(vi.getTimerCount()).toBe(0);
  });
});
