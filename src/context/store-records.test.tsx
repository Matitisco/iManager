import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionCaches, readBootSession, readStoreLists, writeBootSession, writeStoreLists } from '../lib/boot-cache';
import type { AppSession } from '../types/app-session';
import type { Sale } from '../types';
import { fetchBackendClients, fetchClientCategoriesApi } from '../services/clients-api';
import { fetchBackendInventory } from '../services/inventory-api';
import { fetchNotifications } from '../services/operations-api';
import { fetchBackendRepairs } from '../services/repairs-api';
import { fetchBackendSales } from '../services/sales-api';
import { fetchBackendTradeIns } from '../services/trade-ins-api';
import { useStoreRecords } from './store-records';

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
