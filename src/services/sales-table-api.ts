/**
 * Sales Table API
 * Wraps the existing sales-api.ts to provide a TableEngine-compatible
 * fetchPage interface (client-side pagination + filtering + sorting).
 *
 * Why client-side? The backend /api/sales returns all sales without
 * pagination support. We keep ALL data in memory and paginate locally.
 * When backend adds pagination, replace the fetch here only.
 */

import type { User } from 'firebase/auth';
import type { Sale } from '../types';
import type { TablePageParams } from '../components/table-engine';
import type { Client, Product } from '../types';
import {
  fetchBackendSales,
  updateBackendSale,
  deleteBackendSale,
} from './sales-api';

// Cache to avoid refetching all sales on every page scroll
let _cache: { uid: string; data: Sale[] } | null = null;

async function getAllSales(user: User): Promise<Sale[]> {
  if (_cache?.uid === user.uid) return _cache.data;
  const data = await fetchBackendSales(user);
  _cache = { uid: user.uid, data };
  return data;
}

/** Call this after create/update/delete to bust the cache */
export function invalidateSalesCache() {
  _cache = null;
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
  user: User,
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

export async function updateSaleViaApi(user: User, sale: Sale): Promise<void> {
  await updateBackendSale(user, sale);
  // Update cache in place
  if (_cache) {
    _cache.data = _cache.data.map(s => (s.id === sale.id ? sale : s));
  }
}

export async function deleteSaleViaApi(user: User, saleId: string): Promise<void> {
  await deleteBackendSale(user, saleId);
  if (_cache) {
    _cache.data = _cache.data.filter(s => s.id !== saleId);
  }
}

export function updateCategoryInCache(ids: string[], categoryId: string | null) {
  if (_cache) {
    _cache.data = _cache.data.map(s => ids.includes(s.id) ? { ...s, categoryId } : s);
  }
}
