import type { Product } from '../types';
import { extractMinBattery } from '../utils/inventory';
import { conditionLabel, isInStock, parseMoney } from './format';
import { displayQuality } from './quality';

/** Catalog fallback. These stay available even when the stock is empty. */
export const CONDITION_FILTERS = [
  { id: 'NUEVO', label: 'Nuevo' },
  { id: 'USADO', label: 'Usado' },
];

const CONDITION_ALIASES: Record<string, string> = {
  nuevo: 'NUEVO',
  new: 'NUEVO',
  usado: 'USADO',
  used: 'USADO',
  'pre-owned': 'PRE-OWNED',
  preowned: 'PRE-OWNED',
  'pre owned': 'PRE-OWNED',
};

export type ConditionFilterOption = { id: string; label: string };

function foldCondition(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Enum id when the value is a known condition, otherwise the trimmed text. */
function canonicalCondition(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  const folded = foldCondition(trimmed);
  if (!folded || folded === '—') return '';
  return CONDITION_ALIASES[folded] ?? trimmed;
}

function conditionKey(value: string): string {
  const canonical = canonicalCondition(value);
  if (!canonical) return '';
  return CONDITION_ALIASES[foldCondition(canonical)] ?? foldCondition(canonical);
}

/**
 * Nuevo and Usado always come from the catalog.
 * Store catalog entries rename or extend that list, and stock values missing
 * from the catalog are appended so a custom condition can still be filtered.
 */
export function inventoryConditionOptions(
  catalog: ConditionFilterOption[],
  present: Iterable<string>,
): ConditionFilterOption[] {
  const byKey = new Map<string, ConditionFilterOption>();
  const order: string[] = [];

  const add = (id: string, label: string, rename: boolean) => {
    const canonical = canonicalCondition(id) || canonicalCondition(label);
    const key = conditionKey(canonical);
    if (!key) return;
    const current = byKey.get(key);
    const nextLabel = label.trim() && label.trim() !== '—' ? label.trim() : conditionLabel(canonical);
    if (!current) {
      order.push(key);
      byKey.set(key, { id: canonical, label: nextLabel });
      return;
    }
    if (rename && label.trim() && label.trim() !== '—') {
      byKey.set(key, { id: current.id, label: label.trim() });
    }
  };

  for (const option of CONDITION_FILTERS) add(option.id, option.label, false);
  for (const option of catalog) add(option.id, option.label, true);
  for (const raw of present) {
    const canonical = canonicalCondition(raw);
    if (!canonical) continue;
    add(canonical, conditionLabel(canonical), false);
  }
  return order.map((key) => byKey.get(key)!);
}

/** Empty selection matches every condition. Ids and visible labels compare as the same value. */
export function matchesInventoryCondition(condition: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const item = conditionKey(condition);
  if (!item) return false;
  return selected.some((value) => conditionKey(value) === item);
}

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
  if (!matchesInventoryCondition(item.condition, filters.conditions)) return false;
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
