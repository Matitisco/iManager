/**
 * Clients Table API
 * Wraps clients-api.ts to provide a TableEngine-compatible fetchPage interface.
 * Client-side pagination + filtering + sorting (same pattern as sales-table-api).
 */

import type { User } from 'firebase/auth';
import type { Client } from '../types';
import type { TablePageParams } from '../components/table-engine';
import {
  fetchBackendClients,
  updateBackendClient,
  deleteBackendClient,
} from './clients-api';

let _cache: { uid: string; data: Client[] } | null = null;

async function getAllClients(user: User): Promise<Client[]> {
  if (_cache?.uid === user.uid) return _cache.data;
  const data = await fetchBackendClients(user);
  _cache = { uid: user.uid, data };
  return data;
}

export function invalidateClientsCache() {
  _cache = null;
}

function hasActivity(c: Client) {
  return c.totalSpent > 0 || c.lastPurchaseDate !== 'N/A';
}

function applyFiltersAndSort(
  clients: Client[],
  params: Omit<TablePageParams, 'skip' | 'take'>
): Client[] {
  let result = [...clients];

  const { filters = {} } = params;
  if (filters.status === 'active') result = result.filter(hasActivity);
  if (filters.status === 'inactive') result = result.filter(c => !hasActivity(c));
  if (filters.balance === 'debt') result = result.filter(c => c.pendingBalance > 0);
  if (filters.balance === 'no_debt') result = result.filter(c => c.pendingBalance === 0);

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
    result.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}

export async function fetchClientsPage(
  user: User,
  params: TablePageParams
): Promise<{ items: Client[]; total: number }> {
  const all = await getAllClients(user);
  const filtered = applyFiltersAndSort(all, params);
  const items = filtered.slice(params.skip, params.skip + params.take);
  return { items, total: filtered.length };
}

export async function updateClientViaApi(user: User, client: Client): Promise<void> {
  await updateBackendClient(user, client);
  if (_cache?.uid === user.uid) {
    _cache.data = _cache.data.map(c => (c.id === client.id ? client : c));
  }
}

export async function deleteClientViaApi(user: User, id: string): Promise<void> {
  await deleteBackendClient(user, id);
  if (_cache?.uid === user.uid) {
    _cache.data = _cache.data.filter(c => c.id !== id);
  }
}
