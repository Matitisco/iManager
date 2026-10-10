import type { Product } from '../types';
import { extractMinBattery } from '../utils/inventory';
import { conditionLabel, isInStock, parseMoney } from './format';
import { displayQuality } from './quality';

export type InventoryColumnFilters = {
  equipo: string;
  conditions: string[];
  qualities: string[];
  statuses: string[];
  battery: '' | '90' | '80' | '70';
  priceMin: string;
  priceMax: string;
};

export const EMPTY_COLUMN_FILTERS: InventoryColumnFilters = {
  equipo: '',
  conditions: [],
  qualities: [],
  statuses: [],
  battery: '',
  priceMin: '',
  priceMax: '',
};

export function columnFilterKey(filters: InventoryColumnFilters) {
  return [
    filters.equipo.trim().toLowerCase(),
    [...filters.conditions].sort().join('|'),
    [...filters.qualities].sort().join('|'),
    [...filters.statuses].sort().join('|'),
    filters.battery,
    filters.priceMin.trim(),
    filters.priceMax.trim(),
  ].join('~');
}

export function columnFiltersActive(filters: InventoryColumnFilters) {
  return columnFilterKey(filters) !== columnFilterKey(EMPTY_COLUMN_FILTERS);
}

export function columnFilterActive(filters: InventoryColumnFilters, column: keyof InventoryColumnFilters) {
  if (column === 'equipo') return filters.equipo.trim() !== '';
  if (column === 'conditions') return filters.conditions.length > 0;
  if (column === 'qualities') return filters.qualities.length > 0;
  if (column === 'statuses') return filters.statuses.length > 0;
  if (column === 'battery') return filters.battery !== '';
  return filters.priceMin.trim() !== '' || filters.priceMax.trim() !== '';
}

/** Empty selection means every status. «Disponible» also includes stock with a blank status. */
export function matchesInventoryStatuses(status: string, selected: string[]) {
  if (selected.length === 0) return true;
  return selected.some((id) => (id === 'DISPONIBLE' ? isInStock(status) : status === id));
}

export function matchesInventoryColumns(item: Product, filters: InventoryColumnFilters) {
  const equipo = filters.equipo.trim().toLowerCase();
  if (equipo) {
    const haystack = `${item.model} ${item.capacity} ${item.color}`.toLowerCase();
    if (!haystack.includes(equipo)) return false;
  }
  if (filters.conditions.length > 0 && !filters.conditions.includes(conditionLabel(item.condition))) return false;
  if (filters.qualities.length > 0 && !filters.qualities.includes(displayQuality(item.condition, item.grade))) return false;
  if (!matchesInventoryStatuses(item.status, filters.statuses)) return false;
  if (filters.battery) {
    if (!item.batteryHealth?.trim()) return false;
    if (extractMinBattery(item.batteryHealth) < Number(filters.battery)) return false;
  }
  if (filters.priceMin.trim() && item.price < parseMoney(filters.priceMin)) return false;
  if (filters.priceMax.trim() && item.price > parseMoney(filters.priceMax)) return false;
  return true;
}
