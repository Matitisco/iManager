import type { Client, ClientCategory, Product, Sale, TradeIn } from '../types';
import type { AppSession } from '../types/app-session';

const SESSION_KEY = 'imanager.boot.session';
const LIST_INDEX_KEY = 'imanager.boot.list-ids';
const LIST_PREFIX = 'imanager.boot.lists.';
const DB_NAME = 'imanager-boot';
const DB_STORE = 'lists';

export type BootSession = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  session: AppSession;
};

export type StoreLists = {
  inventory: Product[];
  sales: Sale[];
  tradeIns: TradeIn[];
  clients: Client[];
  clientCategories: ClientCategory[];
  savedAt: number;
};

let epoch = 0;

export function cacheEpoch() {
  return epoch;
}

function bumpEpoch() {
  epoch += 1;
}

function listKey(storeId: string) {
  return `${LIST_PREFIX}${storeId}`;
}

function readIndex(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIST_INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(LIST_INDEX_KEY, JSON.stringify([...new Set(ids)]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function parseStoreLists(value: unknown): StoreLists | null {
  if (!isRecord(value)) return null;
  return {
    inventory: asArray<Product>(value.inventory),
    sales: asArray<Sale>(value.sales),
    tradeIns: asArray<TradeIn>(value.tradeIns),
    clients: asArray<Client>(value.clients),
    clientCategories: asArray<ClientCategory>(value.clientCategories),
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
  };
}

export function parseBootSession(value: unknown): BootSession | null {
  if (!isRecord(value) || typeof value.uid !== 'string' || !isRecord(value.session)) return null;
  return {
    uid: value.uid,
    email: typeof value.email === 'string' ? value.email : null,
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
    photoURL: typeof value.photoURL === 'string' ? value.photoURL : null,
    session: value.session as unknown as AppSession,
  };
}

export function readBootSession(): BootSession | null {
  try {
    return parseBootSession(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function writeBootSession(session: BootSession) {
  const ticket = epoch;
  try {
    if (ticket !== epoch) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A full disk still leaves the in-memory session usable for this visit.
  }
}

export function clearBootSession() {
  bumpEpoch();
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore private-mode storage failures.
  }
}

export function readStoreLists(storeId: string): StoreLists | null {
  try {
    return parseStoreLists(JSON.parse(localStorage.getItem(listKey(storeId)) || 'null'));
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeId: string, lists: StoreLists) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(lists, storeId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

async function idbGet(storeId: string): Promise<StoreLists | null> {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise<unknown>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).get(storeId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return parseStoreLists(value);
}

async function idbDelete(storeId?: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      if (storeId) tx.objectStore(DB_STORE).delete(storeId);
      else tx.objectStore(DB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export function writeStoreLists(storeId: string, lists: StoreLists) {
  if (!storeId) return;
  const ticket = epoch;
  try {
    localStorage.setItem(listKey(storeId), JSON.stringify(lists));
    writeIndex([...readIndex(), storeId]);
  } catch {
    try {
      localStorage.removeItem(listKey(storeId));
    } catch {
      // The IndexedDB copy is the fallback when localStorage is full.
    }
  }
  void idbPut(storeId, lists).then(() => {
    if (ticket !== epoch) void idbDelete(storeId);
  });
}

export function readStoreListsAsync(storeId: string): Promise<StoreLists | null> {
  const sync = readStoreLists(storeId);
  if (sync) return Promise.resolve(sync);
  return idbGet(storeId);
}

export function clearStoreLists(storeId: string) {
  if (!storeId) return;
  bumpEpoch();
  try {
    localStorage.removeItem(listKey(storeId));
    writeIndex(readIndex().filter((id) => id !== storeId));
  } catch {
    // Ignore private-mode storage failures.
  }
  void idbDelete(storeId);
}

export function clearAllStoreLists() {
  bumpEpoch();
  try {
    for (const id of readIndex()) localStorage.removeItem(listKey(id));
    localStorage.removeItem(LIST_INDEX_KEY);
  } catch {
    // Ignore private-mode storage failures.
  }
  void idbDelete();
}

export function clearSessionCaches() {
  clearBootSession();
  clearAllStoreLists();
}

export function isInvalidAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  return code.startsWith('auth/') && code !== 'auth/network-request-failed';
}
