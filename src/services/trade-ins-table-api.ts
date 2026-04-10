import type { User } from 'firebase/auth';
import type { TableFilterParams, TablePageParams } from '../components/table-engine';
import type { TradeIn } from '../types';
import { fetchBackendTradeIns } from './trade-ins-api';

let cache: { uid: string; data: TradeIn[] } | null = null;

async function getAllTradeIns(user: User): Promise<TradeIn[]> {
  if (cache?.uid === user.uid) {
    return cache.data;
  }

  const data = await fetchBackendTradeIns(user);
  cache = { uid: user.uid, data };
  return data;
}

export function invalidateTradeInsCache() {
  cache = null;
}

function applyFiltersAndSort(
  tradeIns: TradeIn[],
  params: Omit<TablePageParams, 'skip' | 'take'>,
): TradeIn[] {
  let result = [...tradeIns];

  if (params.categoryId !== undefined && params.categoryId !== null) {
    result = result.filter(t => t.categoryId === params.categoryId);
  }

  const { filters = {} } = params;

  if (filters.date) {
    result = result.filter((tradeIn) => tradeIn.date === filters.date);
  }

  if (filters.clientId) {
    result = result.filter((tradeIn) => tradeIn.clientId === filters.clientId);
  }

  if (filters.deviceReceived) {
    result = result.filter((tradeIn) => tradeIn.deviceReceived === filters.deviceReceived);
  }

  if (filters.status) {
    result = result.filter((tradeIn) => tradeIn.status === filters.status);
  }

  if (params.sortKey) {
    const direction = params.sortDir === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const sortKey = params.sortKey as keyof TradeIn;
      const left = a[sortKey];
      const right = b[sortKey];

      if (left == null && right == null) return 0;
      if (left == null) return -1 * direction;
      if (right == null) return 1 * direction;

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }

      return String(left).localeCompare(String(right)) * direction;
    });
  } else {
    result.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  return result;
}

export async function fetchTradeInsPage(
  user: User,
  params: TablePageParams,
): Promise<{ items: TradeIn[]; total: number }> {
  const all = await getAllTradeIns(user);
  const filtered = applyFiltersAndSort(all, params);

  return {
    items: filtered.slice(params.skip, params.skip + params.take),
    total: filtered.length,
  };
}

export function updateTradeInCategoryInCache(ids: string[], categoryId: string | null) {
  if (cache) {
    cache.data = cache.data.map(t => ids.includes(t.id) ? { ...t, categoryId } : t);
  }
}

export async function fetchTradeInFilteredIds(
  user: User,
  params: TableFilterParams,
): Promise<string[]> {
  const all = await getAllTradeIns(user);
  return applyFiltersAndSort(all, {
    ...params,
    sortKey: undefined,
    sortDir: undefined,
  }).map((tradeIn) => tradeIn.id);
}
