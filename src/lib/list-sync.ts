import { useEffect, useRef } from 'react';

export const LIST_SYNC_CHANNEL = 'imanager-lists';
export const LIST_SYNC_STORAGE_KEY = 'imanager-lists-sync';
export const LIST_REFRESH_INTERVAL_MS = 2000;

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

export function createRefreshGate(refresh: () => void, minIntervalMs = LIST_REFRESH_INTERVAL_MS) {
  let lastStarted = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    timer = undefined;
    lastStarted = Date.now();
    refresh();
  };
  return {
    request() {
      const wait = minIntervalMs - (Date.now() - lastStarted);
      if (wait <= 0) {
        if (timer !== undefined) clearTimeout(timer);
        run();
        return;
      }
      if (timer !== undefined) return;
      timer = setTimeout(run, wait);
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

export function useListRefresh(enabled: boolean, refresh: () => void, storeId: string | null) {
  const refreshRef = useRef(refresh);
  const storeRef = useRef(storeId);
  refreshRef.current = refresh;
  storeRef.current = storeId;

  useEffect(() => {
    if (!enabled) return;
    const gate = createRefreshGate(() => refreshRef.current());
    const onFocus = () => gate.request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') gate.request();
    };
    const onSection = () => gate.request();
    const unsubscribe = subscribeListSync((message) => {
      if (storeRef.current && message.storeId !== storeRef.current) return;
      gate.request();
    });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hashchange', onSection);
    return () => {
      gate.cancel();
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hashchange', onSection);
    };
  }, [enabled]);
}
