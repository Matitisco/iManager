import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIST_REFRESH_INTERVAL_MS, LIST_SYNC_CHANNEL, LIST_SYNC_STORAGE_KEY, createRefreshGate, publishListMutation, subscribeListSync, useListRefresh } from './list-sync';

describe('list refresh gate', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('drops recent events and measures the gate from completion, with immediate mutation reconciliation', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const refresh = vi.fn<() => void | Promise<void>>().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const gate = createRefreshGate(refresh);
    gate.request();
    vi.advanceTimersByTime(20_000);
    gate.request();
    expect(refresh).toHaveBeenCalledTimes(1);
    finish(); await Promise.resolve();
    gate.request();
    vi.advanceTimersByTime(14_999);
    gate.request();
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    gate.request();
    expect(refresh).toHaveBeenCalledTimes(2);
    gate.request(true);
    expect(refresh).toHaveBeenCalledTimes(3);
    gate.cancel();
    gate.request(true);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('queues one immediate mutation while a refresh is in flight', async () => {
    let finish!: () => void;
    const refresh = vi.fn<() => void | Promise<void>>().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const gate = createRefreshGate(refresh);
    gate.request(); gate.request(true); gate.request(true);
    finish(); await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe('useListRefresh', () => {
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it('ignores navigation/focus bursts and refreshes after a long absence', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    renderHook(() => useListRefresh(true, refresh, 'store-1'));
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); window.dispatchEvent(new Event('focus')); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(LIST_REFRESH_INTERVAL_MS); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(refresh).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => { vi.advanceTimersByTime(31_000); document.dispatchEvent(new Event('visibilitychange')); });
    expect(refresh).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not refetch while disabled', () => {
    const refresh = vi.fn();
    renderHook(() => useListRefresh(false, refresh, 'store-1'));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('syncs another subscriber through BroadcastChannel and ignores a different store', async () => {
    const refresh = vi.fn();
    const other = vi.fn();
    renderHook(() => useListRefresh(true, refresh, 'store-1'));
    renderHook(() => useListRefresh(true, other, 'store-2'));
    const heard = new Promise<string>((resolve) => {
      const stop = subscribeListSync((message) => { stop(); resolve(message.storeId); });
    });
    publishListMutation('store-1');
    await expect(heard).resolves.toBe('store-1');
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(other).not.toHaveBeenCalled();
  });

  it('falls back to a storage event when BroadcastChannel is missing', () => {
    const original = globalThis.BroadcastChannel;
    vi.stubGlobal('BroadcastChannel', undefined);
    try {
      const refresh = vi.fn();
      renderHook(() => useListRefresh(true, refresh, 'store-1'));
      publishListMutation('store-1');
      const raw = localStorage.getItem(LIST_SYNC_STORAGE_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).storeId).toBe('store-1');
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: LIST_SYNC_STORAGE_KEY, newValue: raw }));
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal('BroadcastChannel', original);
    }
  });
});

describe('publishListMutation channel', () => {
  it('uses the shared channel name', () => {
    expect(LIST_SYNC_CHANNEL).toBe('imanager-lists');
  });
});
