import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionCaches, readBootSession, readStoreLists, writeBootSession, writeStoreLists } from '../lib/boot-cache';
import type { AppSession } from '../types/app-session';
import type { Sale } from '../types';
import { fetchBackendClients, fetchClientCategoriesApi } from '../services/clients-api';
import { fetchBackendInventory } from '../services/inventory-api';
import { fetchNotifications, fetchOperationDrafts } from '../services/operations-api';
import { fetchBackendRepairs } from '../services/repairs-api';
import { fetchBackendSales } from '../services/sales-api';
import { fetchBackendTradeIns } from '../services/trade-ins-api';
import { useStoreRecords } from './store-records';

vi.mock('../lib/list-sync', async importOriginal => ({ ...await importOriginal<typeof import('../lib/list-sync')>(), publishListMutation: vi.fn() }));
vi.mock('../services/inventory-api', () => ({ fetchBackendInventory: vi.fn() }));
vi.mock('../services/sales-api', () => ({ fetchBackendSales: vi.fn() }));
vi.mock('../services/clients-api', () => ({ fetchBackendClients: vi.fn(), fetchClientCategoriesApi: vi.fn() }));
vi.mock('../services/trade-ins-api', () => ({ fetchBackendTradeIns: vi.fn() }));
vi.mock('../services/repairs-api', () => ({ fetchBackendRepairs: vi.fn() }));
vi.mock('../services/operations-api', () => ({ fetchNotifications: vi.fn(), fetchOperationDrafts: vi.fn() }));

const session = {
  user: { id: 'app-user', firebaseUid: 'user-1', email: 'ana@test.com', displayName: 'Ana', avatarUrl: null },
  store: { id: 'store-1', name: 'Casa', currency: 'ARS' },
  membership: { role: 'OWNER', isDefault: true },
  onboardingRequired: false,
} as AppSession;

const user = { uid: 'user-1', email: 'ana@test.com', displayName: 'Ana', getIdToken: vi.fn(async () => 'token') };

function sale(id: string, clientName: string): Sale {
  return {
    id, saleNumber: 1, date: '2026-10-02', clientId: '', clientName, productId: '',
    deviceLabel: 'Pixel', amount: 1000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
  };
}

function seed(storeId: string, clientName: string) {
  writeStoreLists(storeId, {
    inventory: [],
    sales: [sale(`cached-${storeId}`, clientName)],
    tradeIns: [],
    clients: [],
    clientCategories: [],
    savedAt: 1,
  });
}

beforeEach(() => {
  vi.mocked(fetchOperationDrafts).mockResolvedValue({ tradeIns: [] });
  vi.mocked(fetchBackendInventory).mockResolvedValue([]);
  vi.mocked(fetchBackendClients).mockResolvedValue([]);
  vi.mocked(fetchClientCategoriesApi).mockResolvedValue([]);
  vi.mocked(fetchBackendTradeIns).mockResolvedValue([]);
  vi.mocked(fetchBackendRepairs).mockResolvedValue([]);
  vi.mocked(fetchNotifications).mockResolvedValue({ notifications: [] });
  vi.mocked(fetchBackendSales).mockResolvedValue([]);
});

describe('caché de listas por tienda', () => {
  it('muestra la caché al instante y después la revalida', async () => {
    seed('store-1', 'Venta guardada');
    let resolveSales: (rows: Sale[]) => void = () => undefined;
    vi.mocked(fetchBackendSales).mockReturnValue(new Promise((resolve) => { resolveSales = resolve; }));

    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));

    expect(result.current.listsLoaded).toBe(true);
    expect(result.current.sales.map((item) => item.clientName)).toEqual(['Venta guardada']);

    await act(async () => { resolveSales([sale('fresh', 'Venta nueva')]); });
    await waitFor(() => expect(result.current.sales.map((item) => item.clientName)).toEqual(['Venta nueva']));
    await waitFor(() => expect(readStoreLists('store-1')?.sales.map((item) => item.clientName)).toEqual(['Venta nueva']));
  });

  it('no da la lista por vacía hasta que la respuesta llega', async () => {
    let resolveSales: (rows: Sale[]) => void = () => undefined;
    vi.mocked(fetchBackendSales).mockReturnValue(new Promise((resolve) => { resolveSales = resolve; }));
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));

    expect(result.current.listsLoaded).toBe(false);
    expect(result.current.sales).toEqual([]);

    await act(async () => { resolveSales([]); });
    await waitFor(() => expect(result.current.listsLoaded).toBe(true));
    expect(result.current.sales).toEqual([]);
  });

  it('borra la caché de la tienda que se deja', async () => {
    seed('store-a', 'Tienda A');
    seed('store-b', 'Tienda B');
    const pending = new Promise(() => undefined);
    vi.mocked(fetchBackendInventory).mockReturnValue(pending as ReturnType<typeof fetchBackendInventory>);
    vi.mocked(fetchBackendSales).mockReturnValue(pending as ReturnType<typeof fetchBackendSales>);
    vi.mocked(fetchBackendClients).mockReturnValue(pending as ReturnType<typeof fetchBackendClients>);
    vi.mocked(fetchBackendTradeIns).mockReturnValue(pending as ReturnType<typeof fetchBackendTradeIns>);
    const { result, rerender } = renderHook(
      ({ storeId }: { storeId: string }) => useStoreRecords({
        user,
        appSession: { ...session, store: { ...session.store!, id: storeId } },
        backendStatus: 'ready',
      }),
      { initialProps: { storeId: 'store-a' } },
    );
    expect(result.current.sales[0]?.clientName).toBe('Tienda A');

    rerender({ storeId: 'store-b' });
    expect(result.current.sales[0]?.clientName).toBe('Tienda B');
    await waitFor(() => expect(readStoreLists('store-a')).toBeNull());
  });

  it('borra la sesión y las listas al cerrar sesión', () => {
    writeBootSession({
      uid: 'user-1',
      email: 'ana@test.com',
      displayName: 'Ana',
      photoURL: null,
      session,
    });
    seed('store-1', 'Venta guardada');
    clearSessionCaches();
    expect(readBootSession()).toBeNull();
    expect(readStoreLists('store-1')).toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('concurrent scoped list reads #461', () => {
  it('does not restore an initial list after a mutation', async () => {
    const pending = deferred<Sale[]>();
    vi.mocked(fetchBackendSales).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    await waitFor(() => expect(fetchBackendSales).toHaveBeenCalled());
    act(() => {
      result.current.noteLocalMutation();
      result.current.setSales([sale('new', 'Committed')]);
    });
    await act(async () => pending.resolve([sale('old', 'Stale')]));
    expect(result.current.sales.map(row => row.id)).toEqual(['new']);
    expect(result.current.listsLoaded).toBe(true);
  });
  it('keeps the newest refresh when responses arrive in reverse order', async () => {
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    await waitFor(() => expect(result.current.listsLoaded).toBe(true));
    const older = deferred<Sale[]>(), newer = deferred<Sale[]>();
    vi.mocked(fetchBackendSales).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    let a!: Promise<void>, b!: Promise<void>;
    act(() => { a = result.current.refreshLists(); b = result.current.refreshLists(); });
    await act(async () => { newer.resolve([sale('new', 'New')]); await b; });
    await act(async () => { older.resolve([sale('old', 'Old')]); await a; });
    expect(result.current.sales.map(row => row.id)).toEqual(['new']);
  });
  it.each(['store', 'logout'])('ignores refreshes and setters from a previous scope (%s)', async mode => {
    const { result, rerender } = renderHook(({ active }: { active: boolean }) => useStoreRecords({
      user: !active && mode === 'logout' ? null : user,
      appSession: !active && mode === 'logout' ? null : active ? session : { ...session, store: { ...session.store!, id: 'store-2' } },
      backendStatus: !active && mode === 'logout' ? 'checking' : 'ready',
    }), { initialProps: { active: true } });
    await waitFor(() => expect(result.current.listsLoaded).toBe(true));
    const pending = deferred<Sale[]>();
    vi.mocked(fetchBackendSales).mockReturnValueOnce(pending.promise);
    const staleSetter = result.current.setSales;
    let read!: Promise<void>;
    act(() => { read = result.current.refreshLists(); });
    rerender({ active: false });
    await act(async () => { pending.resolve([sale('old', 'Previous scope')]); await read; staleSetter([sale('stale-setter', 'Previous scope')]); });
    expect(result.current.sales).toEqual([]);
  });
  it('does not apply a list read started during a pending write', async () => {
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    await waitFor(() => expect(result.current.listsLoaded).toBe(true));
    act(() => { result.current.pendingWrites.current = 1; result.current.noteLocalMutation(); result.current.setSales([sale('local', 'Pending')]); });
    vi.mocked(fetchBackendSales).mockResolvedValue([sale('old', 'Old')]);
    await act(() => result.current.refreshLists());
    expect(result.current.sales.map(row => row.id)).toEqual(['local']);
  });
});

describe('report availability #451', () => {
  it('keeps verified data available during a focus refresh, but exposes failures and waits for a successful retry', async () => {
    vi.mocked(fetchBackendSales).mockResolvedValueOnce([sale('confirmed', 'Confirmed customer')]);
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    await waitFor(() => expect(result.current.recordsAvailability.sales.status).toBe('success'));
    let failRefresh!: (error: Error) => void;
    vi.mocked(fetchBackendSales).mockReturnValueOnce(new Promise((_resolve, reject) => { failRefresh = reject; }));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.recordsAvailability.sales.status).toBe('success');
    expect(result.current.sales.map(row => row.id)).toEqual(['confirmed']);
    await act(async () => { failRefresh(new Error('Refresh failed')); });
    await waitFor(() => expect(result.current.recordsAvailability.sales.status).toBe('error'));
    const pending = deferred<Sale[]>();
    vi.mocked(fetchBackendSales).mockReturnValueOnce(pending.promise);
    let retry!: Promise<void>;
    act(() => { retry = result.current.refreshLists(); });
    expect(result.current.recordsAvailability.sales.status).toBe('loading');
    await act(async () => { pending.resolve([]); await retry; });
    expect(result.current.recordsAvailability.sales.status).toBe('success');
    expect(result.current.sales).toEqual([]);
  });
  it('does not treat cached lists or settled failures as confirmed empty data and recovers on retry', async () => {
    seed('store-1', 'Cached history');
    const pending = deferred<Sale[]>();
    vi.mocked(fetchBackendSales).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    expect(result.current.listsLoaded).toBe(true);
    expect(result.current.recordsAvailability.sales.status).toBe('loading');
    await act(async () => pending.resolve([]));
    await waitFor(() => expect(result.current.recordsAvailability.sales.status).toBe('success'));
    vi.mocked(fetchBackendSales).mockRejectedValueOnce(new Error('Offline'));
    await act(async () => result.current.refreshLists());
    expect(result.current.recordsAvailability.sales.status).toBe('error');
    expect(result.current.recordsAvailability.sales.error).toBeTruthy();
    expect(result.current.recordsAvailability.inventory.status).toBe('success');
    await act(async () => result.current.refreshLists());
    expect(result.current.recordsAvailability.sales).toEqual({ status: 'success' });
  });
  it('scopes error and success metadata to the store and permission epoch', async () => {
    vi.mocked(fetchBackendSales).mockRejectedValueOnce(new Error('Store A unavailable'));
    const { result, rerender } = renderHook(({ appSession }) => useStoreRecords({ user, appSession, backendStatus: 'ready' }), { initialProps: { appSession: session } });
    await waitFor(() => expect(result.current.recordsAvailability.sales.status).toBe('error'));
    const pending = deferred<Sale[]>();
    vi.mocked(fetchBackendSales).mockReturnValueOnce(pending.promise);
    const other = { ...session, store: { ...session.store!, id: 'store-b' } };
    rerender({ appSession: other });
    expect(result.current.recordsAvailability.sales).toEqual({ status: 'loading' });
    rerender({ appSession: { ...other, membership: { ...other.membership!, role: 'STAFF', sections: ['reports', 'clients'] } } });
    expect(result.current.recordsAvailability.sales.status).toBe('denied');
    await act(async () => pending.resolve([sale('late', 'Wrong scope')]));
    expect(result.current.recordsAvailability.sales.status).toBe('denied');
    expect(result.current.sales).toEqual([]);
  });
  it('ignores an obsolete refresh failure after a newer successful read', async () => {
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    await waitFor(() => expect(result.current.recordsAvailability.sales.status).toBe('success'));
    let rejectOld!: (reason: Error) => void;
    vi.mocked(fetchBackendSales).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }));
    let old!: Promise<void>;
    act(() => { old = result.current.refreshLists(); });
    await act(async () => result.current.refreshLists());
    await act(async () => { rejectOld(new Error('Old failure')); await old; });
    expect(result.current.recordsAvailability.sales.status).toBe('success');
  });
});

it('waits for business context and never expands sales requests for reports-only client access', async () => {
  vi.mocked(fetchBackendSales).mockClear();
  const limited = { ...session, membership: { ...session.membership!, role: 'STAFF' as const, sections: ['reports', 'clients'] } };
  const { result, rerender } = renderHook(({ ready }) => useStoreRecords({ user, appSession: ready ? limited : null, backendStatus: ready ? 'ready' : 'checking' }), { initialProps: { ready: false } });
  await act(async () => {});
  expect(fetchBackendSales).not.toHaveBeenCalled();
  rerender({ ready: true });
  await waitFor(() => expect(result.current.recordsAvailability.clients.status).toBe('success'));
  expect(result.current.recordsAvailability.sales.status).toBe('denied');
  expect(fetchBackendSales).not.toHaveBeenCalled();
});

it('exposes category failures without discarding loaded client rows, and clears errors on retry', async () => {
  vi.mocked(fetchClientCategoriesApi).mockRejectedValueOnce(new Error('Category request failed'));
  const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
  await waitFor(() => expect(result.current.recordsAvailability.clients.status).toBe('error'));
  expect(result.current.clients).toEqual([]);
  await act(async () => result.current.refreshLists());
  expect(result.current.recordsAvailability.clients.status).toBe('success');
});
it('distinguishes unavailable backend from denied module permission', () => {
  const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'offline' }));
  expect(result.current.recordsAvailability.sales.status).toBe('error');
  expect(result.current.recordsAvailability.sales.error).toContain('conectar');
});
