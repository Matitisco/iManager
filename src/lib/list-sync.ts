import { useEffect, useRef } from 'react';

export const LIST_SYNC_CHANNEL = 'imanager-lists';
export const LIST_SYNC_STORAGE_KEY = 'imanager-lists-sync';
export const LIST_REFRESH_INTERVAL_MS = 15000;

export type ListSyncMessage = { storeId: string; at: number };

function parseMessage(raw: string): ListSyncMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ListSyncMessage>;
    if (!parsed || typeof parsed.storeId !== 'string' || typeof parsed.at !== 'number') return null;
    return { storeId: parsed.storeId, at: parsed.at };
  } catch {
    return null;
  }
}

export function publishListMutation(storeId: string) {
  const message: ListSyncMessage = { storeId, at: Date.now() };
  try {
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel(LIST_SYNC_CHANNEL);
      channel.postMessage(message);
      channel.close();
      return;
    }
  } catch {
    // Private mode or an unsupported channel falls through to storage.
  }
  try {
    localStorage.setItem(LIST_SYNC_STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Quota or disabled storage: the open tab already applied the change.
  }
}

export function subscribeListSync(onMessage: (message: ListSyncMessage) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LIST_SYNC_STORAGE_KEY || !event.newValue) return;
    const message = parseMessage(event.newValue);
    if (message) onMessage(message);
  };
  try {
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel(LIST_SYNC_CHANNEL);
      channel.onmessage = (event: MessageEvent<ListSyncMessage>) => {
        if (event.data?.storeId) onMessage(event.data);
      };
      return () => channel.close();
    }
  } catch {
    // Use the storage event below.
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function createRefreshGate(refresh: () => void | Promise<void>, minIntervalMs = LIST_REFRESH_INTERVAL_MS, initiallyFresh = false) {
  let lastFinished = initiallyFresh ? Date.now() : Number.NEGATIVE_INFINITY;
  let running = false;
  let queued = false;
  let cancelled = false;
  const run = () => {
    running = true;
    const finish = () => {
      running = false;
      lastFinished = Date.now();
      if (queued && !cancelled) { queued = false; run(); }
    };
    try {
      const result = refresh();
      if (result) void Promise.resolve(result).then(finish, finish);
      else finish();
    } catch { finish(); }
  };
  return {
    request(immediate = false) {
      if (cancelled) return;
      if (running) { if (immediate) queued = true; return; }
      if (immediate || Date.now() - lastFinished >= minIntervalMs) run();
    },
    cancel() { cancelled = true; queued = false; },
  };
}

export function useListRefresh(enabled: boolean, refresh: () => void | Promise<void>, storeId: string | null) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    // Initial loads already revalidate this scope. Navigation/focus must not start a second batch.
    const gate = createRefreshGate(() => refreshRef.current(), LIST_REFRESH_INTERVAL_MS, true);
    const onFocus = () => gate.request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') gate.request();
    };
    const unsubscribe = subscribeListSync((message) => {
      if (storeId && message.storeId !== storeId) return;
      gate.request(true);
    });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hashchange', onFocus);
    return () => {
      gate.cancel();
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hashchange', onFocus);
    };
  }, [enabled, storeId]);
}
