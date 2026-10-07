import type { Product } from '../types';
import { extractMinBattery } from '../utils/inventory';
import { conditionLabel, parseMoney } from './format';

export type InventoryColumnFilters = {
  equipo: string;
  conditions: string[];
  battery: '' | '90' | '80' | '70';
  priceMin: string;
  priceMax: string;
};

export const EMPTY_COLUMN_FILTERS: InventoryColumnFilters = {
  equipo: '',
  conditions: [],
  battery: '',
  priceMin: '',
  priceMax: '',
};

export function columnFilterKey(filters: InventoryColumnFilters) {
  return [
    filters.equipo.trim().toLowerCase(),
    [...filters.conditions].sort().join('|'),
    filters.battery,
    filters.priceMin.trim(),
    filters.priceMax.trim(),
  ].join('~');
}

export function columnFilterActive(filters: InventoryColumnFilters, column: keyof InventoryColumnFilters) {
  if (column === 'equipo') return filters.equipo.trim() !== '';
  if (column === 'conditions') return filters.conditions.length > 0;
  if (column === 'battery') return filters.battery !== '';
  return filters.priceMin.trim() !== '' || filters.priceMax.trim() !== '';
}

export function matchesInventoryColumns(item: Product, filters: InventoryColumnFilters) {
  const equipo = filters.equipo.trim().toLowerCase();
  if (equipo) {
    const haystack = `${item.model} ${item.capacity} ${item.color}`.toLowerCase();
    if (!haystack.includes(equipo)) return false;
  }
  if (filters.conditions.length > 0 && !filters.conditions.includes(conditionLabel(item.condition, item.grade))) return false;
  if (filters.battery) {
    if (!item.batteryHealth?.trim()) return false;
    if (extractMinBattery(item.batteryHealth) < Number(filters.battery)) return false;
  }
  if (filters.priceMin.trim() && item.price < parseMoney(filters.priceMin)) return false;
  if (filters.priceMax.trim() && item.price > parseMoney(filters.priceMax)) return false;
  return true;
}
