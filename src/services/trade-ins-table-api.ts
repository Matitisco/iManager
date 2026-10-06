import type { TableFilterParams, TablePageParams } from '../components/table-engine';
import type { Client, TradeIn } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { fetchBackendTradeIns } from './trade-ins-api';

let cache: { uid: string; data: TradeIn[] } | null = null;
let cacheVersion = 0;

async function getAllTradeIns(user: AuthUserLike): Promise<TradeIn[]> {
  if (cache?.uid === user.uid) {
    return cache.data;
  }

  const version = cacheVersion;
  const data = await fetchBackendTradeIns(user);
  if (version !== cacheVersion) {
    if (cache?.uid === user.uid) return cache.data;
    return getAllTradeIns(user);
  }
  cache = { uid: user.uid, data };
  return data;
}

export function invalidateTradeInsCache() {
  cache = null;
  cacheVersion += 1;
}

export function clearTradeInCategoryInCache(categoryId: string) {
  if (cache) {
    cache.data = cache.data.map((tradeIn) => (
      tradeIn.categoryId === categoryId ? { ...tradeIn, categoryId: null } : tradeIn
    ));
  }
  cacheVersion += 1;
}

function applyFiltersAndSort(
  tradeIns: TradeIn[],
  params: Omit<TablePageParams, 'skip' | 'take'>,
  clients?: Client[],
): TradeIn[] {
  let result = [...tradeIns];

  const search = params.search?.trim().toLowerCase();
  if (search) {
    result = result.filter((tradeIn) => {
      const client = clients?.find((entry) => entry.id === tradeIn.clientId);

      return [
        tradeIn.id,
        tradeIn.date,
        tradeIn.deviceReceived,
        tradeIn.deviceReceivedImei,
        tradeIn.deviceGiven,
        tradeIn.status,
        tradeIn.batteryHealth,
        tradeIn.grade,
        client?.name,
        client?.dni,
      ].some((value) => String(value ?? '').toLowerCase().includes(search));
    });
  }

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
  user: AuthUserLike,
  params: TablePageParams,
  clients?: Client[],
): Promise<{ items: TradeIn[]; total: number }> {
  const all = await getAllTradeIns(user);
  const filtered = applyFiltersAndSort(all, params, clients);

  return {
    items: filtered.slice(params.skip, params.skip + params.take),
    total: filtered.length,
  };
}

export function updateTradeInCategoryInCache(ids: string[], categoryId: string | null) {
  if (cache) {
    cache.data = cache.data.map(t => ids.includes(t.id) ? { ...t, categoryId } : t);
  }
  cacheVersion += 1;
}

export async function fetchTradeInFilteredIds(
  user: AuthUserLike,
  params: TableFilterParams,
  clients?: Client[],
): Promise<string[]> {
  const all = await getAllTradeIns(user);
  return applyFiltersAndSort(all, {
    ...params,
    sortKey: undefined,
    sortDir: undefined,
  }, clients).map((tradeIn) => tradeIn.id);
}
