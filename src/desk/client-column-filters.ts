import type { Client } from '../types';
import { includesText, matchesDateRange, matchesMoney } from './column-filters';

export type ClientColumnFilters = {
  name: string;
  tags: string[];
  dni: string;
  phone: string;
  dateFrom: string;
  dateTo: string;
  spentMin: string;
  spentMax: string;
  balanceMin: string;
  balanceMax: string;
};

export const EMPTY_CLIENT_FILTERS: ClientColumnFilters = {
  name: '',
  tags: [],
  dni: '',
  phone: '',
  dateFrom: '',
  dateTo: '',
  spentMin: '',
  spentMax: '',
  balanceMin: '',
  balanceMax: '',
};

export function clientFilterKey(filters: ClientColumnFilters) {
  return [
    filters.name.trim().toLowerCase(),
    [...filters.tags].sort().join('|'),
    filters.dni.trim().toLowerCase(),
    filters.phone.trim().toLowerCase(),
    filters.dateFrom.trim(),
    filters.dateTo.trim(),
    filters.spentMin.trim(),
    filters.spentMax.trim(),
    filters.balanceMin.trim(),
    filters.balanceMax.trim(),
  ].join('~');
}

export function clientFiltersActive(filters: ClientColumnFilters) {
  return clientFilterKey(filters) !== clientFilterKey(EMPTY_CLIENT_FILTERS);
}

export function clientColumnActive(filters: ClientColumnFilters, column: 'name' | 'dni' | 'phone' | 'date' | 'spent' | 'balance') {
  if (column === 'name') return filters.name.trim() !== '' || filters.tags.length > 0;
  if (column === 'dni') return filters.dni.trim() !== '';
  if (column === 'phone') return filters.phone.trim() !== '';
  if (column === 'date') return filters.dateFrom.trim() !== '' || filters.dateTo.trim() !== '';
  if (column === 'spent') return filters.spentMin.trim() !== '' || filters.spentMax.trim() !== '';
  return filters.balanceMin.trim() !== '' || filters.balanceMax.trim() !== '';
}

export function matchesClientColumns(client: Client, filters: ClientColumnFilters) {
  if (!includesText(client.name, filters.name)) return false;
  if (filters.tags.length > 0 && !filters.tags.includes(client.tag?.trim() || '')) return false;
  if (!includesText(client.dni, filters.dni)) return false;
  if (!includesText(client.phone, filters.phone)) return false;
  if (!matchesDateRange(client.lastPurchaseDate === 'N/A' ? '' : client.lastPurchaseDate, filters.dateFrom, filters.dateTo)) return false;
  if (!matchesMoney(client.totalSpent, filters.spentMin, filters.spentMax)) return false;
  if (!matchesMoney(client.pendingBalance, filters.balanceMin, filters.balanceMax)) return false;
  return true;
}
