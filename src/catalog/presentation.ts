import type { CatalogItem } from '../types/public-catalog';
export function catalogBatteryMinimum(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d/.test(normalized)) return null;
  const values = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!values.length) return null;
  const minimum = Math.min(...values);
  return minimum > 0 && minimum <= 1 && !normalized.includes('%') ? minimum * 100 : minimum;
}
export function catalogBatteryLabel(value: string) {
  const minimum = catalogBatteryMinimum(value);
  if (minimum == null) return 'Sin dato';
  return value.includes('-') ? `${value.replace(/%/g, '')}%` : `${minimum}%`;
}
export function catalogPrice(item: CatalogItem) {
  if (item.price == null) return 'Consultá';
  return `${item.currency === 'USD' ? 'US$' : '$'} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(item.price)}`;
}
export function catalogCondition(item: CatalogItem) {
  if (item.condition === 'NUEVO') return 'Nuevo';
  if (item.condition === 'USADO') return `Usado ${item.grade}`.trim();
  return item.condition || '—';
}
export function whatsappLink(phone: string | null, message: string) {
  const raw = phone?.trim() ?? '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const international = raw.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!international || digits.startsWith('54')) {
    if (digits.startsWith('54')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.startsWith('9') && digits.length >= 11) digits = digits.slice(1);
    digits = digits.replace(/^(11|2\d{2}|3\d{2,3})15(\d{6,8})$/, '$1$2');
    if (/^15(11|2\d{2}|3\d{2,3})\d{6,8}$/.test(digits)) digits = digits.slice(2);
    if (digits.length === 10) digits = `549${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
export interface CatalogFilters { query: string; model: string; capacity: string; condition: string; battery: string; min: string; max: string }
export const EMPTY_FILTERS: CatalogFilters = { query: '', model: '', capacity: '', condition: '', battery: '', min: '', max: '' };
export function filterCatalog(items: CatalogItem[], filters: CatalogFilters, showPrice: boolean) {
  return items.filter(item => {
    if (!`${item.model} ${item.color}`.toLocaleLowerCase('es').includes(filters.query.toLocaleLowerCase('es'))) return false;
    if (filters.model && item.model !== filters.model) return false;
    if (filters.capacity && item.capacity !== filters.capacity) return false;
    if (filters.condition && catalogCondition(item) !== filters.condition) return false;
    if (filters.battery && (catalogBatteryMinimum(item.batteryHealth) ?? -1) < Number(filters.battery)) return false;
    if (showPrice && filters.min && (item.price ?? 0) < Number(filters.min)) return false;
    if (showPrice && filters.max && (item.price ?? 0) > Number(filters.max)) return false;
    return true;
  });
}
