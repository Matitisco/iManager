/**
 * Sales Table API
 * Wraps the existing sales-api.ts to provide a TableEngine-compatible
 * fetchPage interface (client-side pagination + filtering + sorting).
 *
 * Why client-side? The backend /api/sales returns all sales without
 * pagination support. We keep ALL data in memory and paginate locally.
 * When backend adds pagination, replace the fetch here only.
 */

import type { Sale } from '../types';
import type { TablePageParams } from '../components/table-engine';
import type { Client, Product } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import {
  fetchBackendSales,
  updateBackendSale,
  deleteBackendSale,
} from './sales-api';

// Cache to avoid refetching all sales on every page scroll.
// cacheVersion discards a list response that was already in flight when a
// delete or category change happened, so the deleted row cannot come back.
let _cache: { uid: string; data: Sale[] } | null = null;
let cacheVersion = 0;

async function getAllSales(user: AuthUserLike): Promise<Sale[]> {
  if (_cache?.uid === user.uid) return _cache.data;
  const version = cacheVersion;
  const data = await fetchBackendSales(user);
  if (version !== cacheVersion) {
    if (_cache?.uid === user.uid) return _cache.data;
    return getAllSales(user);
  }
  _cache = { uid: user.uid, data };
  return data;
}

/** Call this after create/update/delete to bust the cache */
export function invalidateSalesCache() {
  _cache = null;
  cacheVersion += 1;
}

export function clearCategoryInCache(categoryId: string) {
  if (_cache) {
    _cache.data = _cache.data.map((sale) => (
      sale.categoryId === categoryId ? { ...sale, categoryId: null } : sale
    ));
  }
  cacheVersion += 1;
}

function applyFiltersAndSort(
  sales: Sale[],
  params: Omit<TablePageParams, 'skip' | 'take'>,
  lookups?: {
    clients?: Client[];
    inventory?: Product[];
  },
): Sale[] {
  let result = [...sales];

  const search = params.search?.trim().toLowerCase();
  if (search) {
    result = result.filter((sale) => {
      const client = lookups?.clients?.find((entry) => entry.id === sale.clientId);
      const product = lookups?.inventory?.find((entry) => entry.id === sale.productId);

      return [
        sale.saleNumber != null ? String(sale.saleNumber) : '',
        sale.id,
        sale.date,
        sale.paymentMethod,
        sale.status,
        client?.name,
        client?.dni,
        product?.model,
        product?.imei,
        sale.deviceLabel,
      ].some((value) => String(value ?? '').toLowerCase().includes(search));
    });
  }

  // Filters
  if (params.categoryId !== undefined && params.categoryId !== null) {
    result = result.filter(s => s.categoryId === params.categoryId);
  }
  const { filters = {} } = params;
  if (filters.paymentMethod) result = result.filter(s => s.paymentMethod === filters.paymentMethod);
  if (filters.status) result = result.filter(s => s.status === filters.status);

  // Sort
  if (params.sortKey) {
    const dir = params.sortDir === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const av = (a as any)[params.sortKey!];
      const bv = (b as any)[params.sortKey!];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  } else {
    // Default: newest first (by date string, then id)
    result.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  return result;
}

export async function fetchSalesPage(
  user: AuthUserLike,
  params: TablePageParams,
  lookups?: {
    clients?: Client[];
    inventory?: Product[];
  },
): Promise<{ items: Sale[]; total: number }> {
  const all = await getAllSales(user);
  const filtered = applyFiltersAndSort(all, params, lookups);
  const items = filtered.slice(params.skip, params.skip + params.take);
  return { items, total: filtered.length };
}

export async function updateSaleViaApi(user: AuthUserLike, sale: Sale): Promise<void> {
  await updateBackendSale(user, sale);
  if (_cache) {
    _cache.data = _cache.data.map(s => (s.id === sale.id ? sale : s));
  }
  cacheVersion += 1;
}

export async function deleteSaleViaApi(user: AuthUserLike, saleId: string): Promise<void> {
  await deleteBackendSale(user, saleId);
  if (_cache) {
    _cache.data = _cache.data.filter(s => s.id !== saleId);
  }
  cacheVersion += 1;
}

export function updateCategoryInCache(ids: string[], categoryId: string | null) {
  if (_cache) {
    _cache.data = _cache.data.map(s => ids.includes(s.id) ? { ...s, categoryId } : s);
  }
  cacheVersion += 1;
}
