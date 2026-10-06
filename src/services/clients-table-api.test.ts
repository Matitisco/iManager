import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { fetchBackendClients } from './clients-api';
import {
  clearClientCategoryInCache,
  fetchClientsPage,
  invalidateClientsCache,
} from './clients-table-api';

vi.mock('./clients-api', () => ({
  fetchBackendClients: vi.fn(),
  updateBackendClient: vi.fn(),
  deleteBackendClient: vi.fn(),
}));

const clients: Client[] = [
  {
    id: 'client-1',
    dni: '11222333',
    name: 'Ana Torres',
    email: 'ana@imanager.test',
    phone: '2614000001',
    lastPurchaseDate: '2026-04-20',
    totalSpent: 1500,
    pendingBalance: 0,
    categoryId: 'cat-a',
  },
  {
    id: 'client-2',
    dni: '22333444',
    name: 'Sofia Gomez',
    email: 'sofia@imanager.test',
    phone: '2614000002',
    lastPurchaseDate: 'N/A',
    totalSpent: 0,
    pendingBalance: 0,
    categoryId: null,
  },
];

const user: AuthUserLike = {
  uid: 'user-a',
  email: 'user-a@imanager.test',
  displayName: 'User A',
  getIdToken: vi.fn().mockResolvedValue('token'),
};

describe('clients-table-api', () => {
  beforeEach(() => {
    invalidateClientsCache();
    vi.mocked(fetchBackendClients).mockReset();
    vi.mocked(fetchBackendClients).mockResolvedValue(clients);
  });

  it('drops a deleted category from the cached list without another request', async () => {
    await fetchClientsPage(user, { skip: 0, take: 10, filters: {} });
    clearClientCategoryInCache('cat-a');

    const stillInCategory = await fetchClientsPage(user, {
      skip: 0,
      take: 10,
      categoryId: 'cat-a',
      filters: {},
    });
    const all = await fetchClientsPage(user, { skip: 0, take: 10, filters: {} });

    expect(fetchBackendClients).toHaveBeenCalledTimes(1);
    expect(stillInCategory.items).toEqual([]);
    expect(all.items.find((client) => client.id === 'client-1')?.categoryId).toBeNull();
  });

  it('ignores a stale list that arrives after the cache was invalidated', async () => {
    const kept = clients.filter((client) => client.id !== 'client-1');
    let resolveStale: (rows: Client[]) => void = () => {};
    vi.mocked(fetchBackendClients).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveStale = resolve;
      }),
    );

    const pending = fetchClientsPage(user, { skip: 0, take: 10, filters: {} });
    invalidateClientsCache();
    vi.mocked(fetchBackendClients).mockResolvedValue(kept);
    resolveStale(clients);

    const page = await pending;
    expect(page.items.map((client) => client.id)).toEqual(['client-2']);
    expect(fetchBackendClients).toHaveBeenCalledTimes(2);
  });
});
