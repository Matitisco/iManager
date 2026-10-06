import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { fetchBackendSales } from './sales-api';
import {
  clearCategoryInCache,
  fetchSalesPage,
  invalidateSalesCache,
} from './sales-table-api';

vi.mock('./sales-api', () => ({
  fetchBackendSales: vi.fn(),
  updateBackendSale: vi.fn(),
  deleteBackendSale: vi.fn(),
}));

const sales: Sale[] = [
  {
    id: 'sale-1',
    date: '2026-04-20',
    clientId: 'client-1',
    productId: 'product-1',
    amount: 1000,
    paymentMethod: 'EFECTIVO',
    status: 'COMPLETADA',
    categoryId: 'cat-a',
  },
  {
    id: 'sale-2',
    date: '2026-04-19',
    clientId: 'client-2',
    productId: 'product-2',
    amount: 500,
    paymentMethod: 'TARJETA',
    status: 'PENDIENTE',
    categoryId: null,
  },
];

const user: AuthUserLike = {
  uid: 'user-a',
  email: 'user-a@imanager.test',
  displayName: 'User A',
  getIdToken: vi.fn().mockResolvedValue('token'),
};

describe('sales-table-api', () => {
  beforeEach(() => {
    invalidateSalesCache();
    vi.mocked(fetchBackendSales).mockReset();
    vi.mocked(fetchBackendSales).mockResolvedValue(sales);
  });

  it('drops a deleted category from the cached list without another request', async () => {
    await fetchSalesPage(user, { skip: 0, take: 10, filters: {} });
    clearCategoryInCache('cat-a');

    const stillInCategory = await fetchSalesPage(user, {
      skip: 0,
      take: 10,
      categoryId: 'cat-a',
      filters: {},
    });
    const all = await fetchSalesPage(user, { skip: 0, take: 10, filters: {} });

    expect(fetchBackendSales).toHaveBeenCalledTimes(1);
    expect(stillInCategory.items).toEqual([]);
    expect(all.items.find((sale) => sale.id === 'sale-1')?.categoryId).toBeNull();
  });

  it('ignores a stale list that arrives after the cache was invalidated', async () => {
    const kept = sales.filter((sale) => sale.id !== 'sale-1');
    let resolveStale: (rows: Sale[]) => void = () => {};
    vi.mocked(fetchBackendSales).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveStale = resolve;
      }),
    );

    const pending = fetchSalesPage(user, { skip: 0, take: 10, filters: {} });
    invalidateSalesCache();
    vi.mocked(fetchBackendSales).mockResolvedValue(kept);
    resolveStale(sales);

    const page = await pending;
    expect(page.items.map((sale) => sale.id)).toEqual(['sale-2']);
    expect(fetchBackendSales).toHaveBeenCalledTimes(2);
  });
});
