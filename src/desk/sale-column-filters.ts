import type { Sale } from '../types';
import { includesText, matchesDateRange, matchesMoney } from './column-filters';
import { paymentLabel, saleCode } from './format';

export type SaleColumnFilters = {
  code: string;
  dateFrom: string;
  dateTo: string;
  client: string;
  equipment: string;
  payments: string[];
  amountMin: string;
  amountMax: string;
  statuses: string[];
  sellers: string[];
};

/** Ventas sin vendedor asignado. */
export const UNASSIGNED_SELLER = 'none';

export function saleSellerKey(sale: Pick<Sale, 'sellerMemberId'>) {
  return sale.sellerMemberId || UNASSIGNED_SELLER;
}

export const EMPTY_SALE_FILTERS: SaleColumnFilters = {
  code: '',
  dateFrom: '',
  dateTo: '',
  client: '',
  equipment: '',
  payments: [],
  amountMin: '',
  amountMax: '',
  statuses: [],
  sellers: [],
};

export function saleFilterKey(filters: SaleColumnFilters) {
  return [
    filters.code.trim().toLowerCase(),
    filters.dateFrom.trim(),
    filters.dateTo.trim(),
    filters.client.trim().toLowerCase(),
    filters.equipment.trim().toLowerCase(),
    [...filters.payments].sort().join('|'),
    filters.amountMin.trim(),
    filters.amountMax.trim(),
    [...filters.statuses].sort().join('|'),
    [...filters.sellers].sort().join('|'),
  ].join('~');
}

export function saleFiltersActive(filters: SaleColumnFilters) {
  return saleFilterKey(filters) !== saleFilterKey(EMPTY_SALE_FILTERS);
}

export function saleColumnActive(filters: SaleColumnFilters, column: 'code' | 'date' | 'client' | 'equipment' | 'payments' | 'amount' | 'statuses' | 'sellers') {
  if (column === 'code') return filters.code.trim() !== '';
  if (column === 'date') return filters.dateFrom.trim() !== '' || filters.dateTo.trim() !== '';
  if (column === 'client') return filters.client.trim() !== '';
  if (column === 'equipment') return filters.equipment.trim() !== '';
  if (column === 'payments') return filters.payments.length > 0;
  if (column === 'amount') return filters.amountMin.trim() !== '' || filters.amountMax.trim() !== '';
  if (column === 'sellers') return filters.sellers.length > 0;
  return filters.statuses.length > 0;
}

export function matchesSaleColumns(
  sale: Sale,
  filters: SaleColumnFilters,
  labels: { client: string; equipment: string },
) {
  if (!includesText(saleCode(sale), filters.code)) return false;
  if (!matchesDateRange(sale.date, filters.dateFrom, filters.dateTo)) return false;
  if (!includesText(labels.client, filters.client)) return false;
  if (!includesText(labels.equipment, filters.equipment)) return false;
  if (filters.payments.length > 0 && !filters.payments.includes(paymentLabel(sale.paymentMethod))) return false;
  if (!matchesMoney(sale.amount, filters.amountMin, filters.amountMax)) return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(sale.status)) return false;
  if (filters.sellers.length > 0 && !filters.sellers.includes(saleSellerKey(sale))) return false;
  return true;
}
