import type { Product } from '../types';
import { equipmentTitle } from './format';

export const EQUIPMENT_SUGGESTION_LIMIT = 6;

export function equipmentSuggestions(items: Product[], query: string, limit = EQUIPMENT_SUGGESTION_LIMIT): Product[] {
  const needle = query.trim().toLowerCase();
  if (!needle || limit <= 0) return [];
  const matches: Product[] = [];
  for (const item of items) {
    const haystack = [equipmentTitle(item.model, item.capacity), item.color, item.imei].join(' ').toLowerCase();
    if (!haystack.includes(needle)) continue;
    matches.push(item);
    if (matches.length >= limit) break;
  }
  return matches;
}
