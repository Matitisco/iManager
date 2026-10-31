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
    expect(result.current.listsSettled).toBe(false);
    expect(result.current.sales.map((item) => item.clientName)).toEqual(['Venta guardada']);

    await act(async () => { resolveSales([sale('fresh', 'Venta nueva')]); });
    await waitFor(() => expect(result.current.sales.map((item) => item.clientName)).toEqual(['Venta nueva']));
    expect(result.current.listsSettled).toBe(true);
    expect(result.current.listsLoadFailed).toBe(false);
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

  it('espera la revalidación inicial sin descartar la caché ante una consulta fallida', async () => {
    seed('store-1', 'Cache');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveTrades!: (rows: []) => void;
    vi.mocked(fetchBackendTradeIns).mockReturnValue(new Promise(resolve => { resolveTrades = resolve; }));
    vi.mocked(fetchBackendInventory).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
    expect(result.current.listsLoaded).toBe(true);
    expect(result.current.listsSettled).toBe(false);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(result.current.listsSettled).toBe(false);
    await act(async () => resolveTrades([]));
    await waitFor(() => expect(result.current.listsSettled).toBe(true));
    expect(result.current.listsLoadFailed).toBe(false);
    error.mockRestore();
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

it('keeps equal rows, loading flags and references through refetch and same-uid confirmation', async () => {
  vi.mocked(fetchBackendSales).mockImplementation(async () => [sale('a', 'Ana')]);
  const snapshots: { loaded: boolean; notificationsLoading: boolean }[] = [];
  const { result, rerender } = renderHook(({ identity }) => {
    const records = useStoreRecords({ user: identity, appSession: session, backendStatus: 'ready' });
    snapshots.push({ loaded: records.listsLoaded, notificationsLoading: records.notificationsLoading });
    return records;
  }, { initialProps: { identity: user } });
  await waitFor(() => expect(result.current.listsSettled && result.current.notificationsLoaded).toBe(true));
  const before = result.current;
  const calls = vi.mocked(fetchBackendSales).mock.calls.length;
  snapshots.length = 0;
  rerender({ identity: { ...user } });
  expect(fetchBackendSales).toHaveBeenCalledTimes(calls);
  await act(() => result.current.refreshLists());
  for (const key of ['inventory', 'sales', 'clients', 'tradeIns', 'repairOrders', 'operationNotifications', 'operationDrafts', 'clientCategories'] as const) {
    expect(result.current[key]).toBe(before[key]);
  }
  expect(snapshots.every(row => row.loaded && !row.notificationsLoading)).toBe(true);
});

it('waits for the resolved store before starting the initial lists', async () => {
  const { result, rerender } = renderHook(({ ready }) => useStoreRecords({ user, appSession: ready ? session : null, backendStatus: ready ? 'ready' : 'checking' }), { initialProps: { ready: false } });
  expect(fetchBackendInventory).not.toHaveBeenCalled();
  rerender({ ready: true });
  await waitFor(() => expect(result.current.listsSettled).toBe(true));
  expect(fetchBackendInventory).toHaveBeenCalledTimes(1);
});

it('retains loaded lists and repair/notification data when background reads fail', async () => {
  const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(fetchBackendSales).mockResolvedValue([sale('a', 'Ana')]);
  const { result } = renderHook(() => useStoreRecords({ user, appSession: session, backendStatus: 'ready' }));
  await waitFor(() => expect(result.current.listsSettled && result.current.notificationsLoaded).toBe(true));
  const before = result.current;
  for (const fetcher of [fetchBackendInventory, fetchBackendSales, fetchBackendClients, fetchBackendTradeIns, fetchBackendRepairs, fetchNotifications]) {
    vi.mocked(fetcher).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  }
  await act(() => result.current.refreshLists());
  expect(result.current.sales).toBe(before.sales);
  expect(result.current.repairOrders).toBe(before.repairOrders);
  expect(result.current.operationNotifications).toBe(before.operationNotifications);
  expect(result.current.listsLoadFailed).toBe(false);
  expect(result.current.listsLoaded).toBe(true);
  expect(result.current.notificationsLoading).toBe(false);
  expect(result.current.notificationsError).toBeNull();
  expect(result.current.repairOrdersError).toBeNull();
  warn.mockRestore();
});

describe('costos del inventario para empleados', () => {
  // TEMPORAL: los empleados ven finanzas, así que conservan el costo del equipo.
  it('un empleado conserva el costo de los equipos', async () => {
    const staff = { ...session, membership: { role: 'STAFF', isDefault: true } } as AppSession;
    vi.mocked(fetchBackendInventory).mockResolvedValue([{ id: 'item-1', model: 'iPhone 14', cost: 500, currency: 'USD' }] as never);
    const { result } = renderHook(() => useStoreRecords({ user, appSession: staff, backendStatus: 'ready' }));
    await waitFor(() => expect(result.current.inventory.map((item) => item.cost)).toEqual([500]));
  });
});
