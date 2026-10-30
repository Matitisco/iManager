import type { Product } from '../types';
import { extractMinBattery } from '../utils/inventory';
import { conditionLabel, isInStock, parseMoney } from './format';
import { displayQuality } from './quality';
import { parseReportDate } from './report-period';

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

/** Distinct non-empty colors already stored on equipment, in Spanish alphabetical order. */
export function inventoryColorOptions(present: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const raw of present) {
    const color = raw.trim();
    if (color) seen.add(color);
  }
  return [...seen].sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }));
}

/** Search only: return original color values so distinct historical filters stay distinct. */
export function searchInventoryColors(options: string[], query: string): string[] {
  const fold = (value: string) => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const needle = fold(query.trim());
  return options.filter((color) => fold(color).includes(needle));
}

/** Empty selection matches every color, including equipment saved without one. */
export function matchesInventoryColor(color: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(color.trim());
}

/** Blank colors stay at the end in both directions. */
export function compareInventoryColor(left: string, right: string, direction: 'asc' | 'desc' = 'asc'): number {
  const a = left.trim();
  const b = right.trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const order = a.localeCompare(b, 'es', { sensitivity: 'base' });
  return direction === 'asc' ? order : -order;
}

export type TextPresence = '' | 'filled' | 'empty';

export type InventoryColumnFilters = {
  equipo: string;
  equipoPresence: TextPresence;
  entryFrom: string;
  entryTo: string;
  imei: string;
  imeiPresence: TextPresence;
  quantityMin: string;
  quantityMax: string;
  costMin: string;
  costMax: string;
  batteryNote: string;
  batteryNotePresence: TextPresence;
  catalog: string[];
  conditions: string[];
  qualities: string[];
  statuses: string[];
  colors: string[];
  battery: '' | '90' | '80' | '70';
  batteryMin: string;
  batteryMax: string;
  priceMin: string;
  priceMax: string;
  needsCompletion: boolean;
  supplierId: string;
  priceToDefine?: boolean;
};

export const EMPTY_COLUMN_FILTERS: InventoryColumnFilters = {
  equipo: '',
  equipoPresence: '',
  entryFrom: '',
  entryTo: '',
  imei: '',
  imeiPresence: '',
  quantityMin: '',
  quantityMax: '',
  costMin: '',
  costMax: '',
  batteryNote: '',
  batteryNotePresence: '',
  catalog: [],
  conditions: [],
  qualities: [],
  statuses: [],
  colors: [],
  battery: '',
  batteryMin: '',
  batteryMax: '',
  priceMin: '',
  priceMax: '',
  needsCompletion: false,
  supplierId: '',
};

export function columnFilterKey(filters: InventoryColumnFilters) {
  return [
    filters.equipo.trim().toLowerCase(),
    filters.equipoPresence,
    filters.entryFrom.trim(), filters.entryTo.trim(),
    filters.imei.trim(), filters.imeiPresence,
    filters.quantityMin.trim(), filters.quantityMax.trim(),
    filters.costMin.trim(), filters.costMax.trim(),
    filters.batteryNote.trim().toLowerCase(), filters.batteryNotePresence,
    [...filters.catalog].sort().join('|'),
    filters.batteryMin.trim(), filters.batteryMax.trim(),
    [...filters.conditions].sort().join('|'),
    [...filters.qualities].sort().join('|'),
    [...filters.statuses].sort().join('|'),
    [...filters.colors].sort((left, right) => left.localeCompare(right, 'es')).join('|'),
    filters.supplierId || '',
    filters.battery,
    filters.priceMin.trim(),
    filters.priceMax.trim(),
    filters.needsCompletion ? '1' : '0',
    filters.priceToDefine ? '1' : '0',
  ].join('~');
}

export function columnFiltersActive(filters: InventoryColumnFilters) {
  return columnFilterKey(filters) !== columnFilterKey(EMPTY_COLUMN_FILTERS);
}

export function columnFilterActive(filters: InventoryColumnFilters, column: keyof InventoryColumnFilters) {
  if (column === 'supplierId') return Boolean(filters.supplierId);
  if (column === 'equipo' || column === 'equipoPresence') return filters.equipo.trim() !== '' || filters.equipoPresence !== '';
  if (column === 'entryFrom' || column === 'entryTo') return Boolean(filters.entryFrom.trim() || filters.entryTo.trim());
  if (column === 'imei' || column === 'imeiPresence') return Boolean(filters.imei.trim() || filters.imeiPresence);
  if (column === 'quantityMin' || column === 'quantityMax') return Boolean(filters.quantityMin.trim() || filters.quantityMax.trim());
  if (column === 'costMin' || column === 'costMax') return Boolean(filters.costMin.trim() || filters.costMax.trim());
  if (column === 'batteryNote' || column === 'batteryNotePresence') return Boolean(filters.batteryNote.trim() || filters.batteryNotePresence);
  if (column === 'catalog') return filters.catalog.length > 0;
  if (column === 'conditions') return filters.conditions.length > 0;
  if (column === 'qualities') return filters.qualities.length > 0;
  if (column === 'statuses') return filters.statuses.length > 0 || filters.needsCompletion;
  if (column === 'colors') return filters.colors.length > 0;
  if (column === 'battery' || column === 'batteryMin' || column === 'batteryMax') return Boolean(filters.battery || filters.batteryMin.trim() || filters.batteryMax.trim());
  return Boolean(filters.priceToDefine) || filters.priceMin.trim() !== '' || filters.priceMax.trim() !== '';
}

export function activeColumnCount(filters: InventoryColumnFilters) {
  const columns: (keyof InventoryColumnFilters)[] = ['entryFrom', 'equipo', 'imei', 'quantityMin', 'costMin', 'colors', 'conditions', 'qualities', 'battery', 'batteryNote', 'priceMin', 'statuses', 'catalog', 'supplierId'];
  return columns.filter(column => columnFilterActive(filters, column)).length;
}

function matchesText(value: string | null | undefined, query: string, presence: TextPresence) {
  const text = value?.trim() ?? '';
  if (presence === 'filled' && !text) return false;
  if (presence === 'empty' && text) return false;
  return text.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'));
}

function matchesRange(value: number | null | undefined, min: string, max: string) {
  if (!min.trim() && !max.trim()) return true;
  if (value == null || !Number.isFinite(value)) return false;
  return (!min.trim() || value >= parseMoney(min)) && (!max.trim() || value <= parseMoney(max));
}

/** Empty selection means every status. «Disponible» also includes stock with a blank status. */
export function matchesInventoryStatuses(status: string, selected: string[]) {
  if (selected.length === 0) return true;
  return selected.some((id) => (id === 'DISPONIBLE' ? isInStock(status) : status === id));
}

export function matchesInventoryColumns(item: Product, filters: InventoryColumnFilters) {
  if (filters.priceToDefine && item.price != null) return false;
  if (filters.supplierId && item.supplierId !== filters.supplierId) return false;
  if (!matchesText([item.model, item.capacity, item.color].filter(Boolean).join(' '), filters.equipo, filters.equipoPresence)) return false;
  if (!matchesText(item.imei, filters.imei, filters.imeiPresence)) return false;
  if (!matchesText(item.batteryNote, filters.batteryNote, filters.batteryNotePresence)) return false;
  if (!matchesRange(item.cantidad ?? 1, filters.quantityMin, filters.quantityMax)) return false;
  if (!matchesRange(item.cost, filters.costMin, filters.costMax)) return false;
  if (filters.catalog.length && !filters.catalog.includes(item.catalogIncluded ? 'included' : 'excluded')) return false;
  if (filters.entryFrom.trim() || filters.entryTo.trim()) {
    const date = parseReportDate(item.entryDate ?? undefined);
    const from = parseReportDate(filters.entryFrom);
    const to = parseReportDate(filters.entryTo);
    if (!date || (filters.entryFrom.trim() && !from) || (filters.entryTo.trim() && !to)) return false;
    const calendarDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    if ((from && calendarDay(date) < calendarDay(from)) || (to && calendarDay(date) > calendarDay(to))) return false;
  }
  if (!matchesInventoryCondition(item.condition, filters.conditions)) return false;
  if (!matchesInventoryColor(item.color, filters.colors)) return false;
  if (filters.qualities.length > 0 && !filters.qualities.includes(displayQuality(item.condition, item.grade))) return false;
  if (!matchesInventoryStatuses(item.status, filters.statuses)) return false;
  if (filters.needsCompletion && !item.needsCompletion) return false;
  if (filters.battery) {
    if (!item.batteryHealth?.trim()) return false;
    if (extractMinBattery(item.batteryHealth) < Number(filters.battery)) return false;
  }
  if (filters.batteryMin.trim() || filters.batteryMax.trim()) {
    const value = item.batteryHealth?.match(/\d+/) ? extractMinBattery(item.batteryHealth) : null;
    if (!matchesRange(value, filters.batteryMin, filters.batteryMax)) return false;
  }
  if (filters.priceMin.trim() && (item.price == null || item.price < parseMoney(filters.priceMin))) return false;
  if (filters.priceMax.trim() && (item.price == null || item.price > parseMoney(filters.priceMax))) return false;
  return true;
}
