import type { OperationProductOption, Product } from '../types';
import { equipmentTitle } from './format';

export const EQUIPMENT_SUGGESTION_LIMIT = 6;
export const MISSING_OUTGOING_PRICE = 'Completá el precio de salida para calcular la diferencia';
export const NEGATIVE_TRADE_DIFFERENCE = 'El precio de salida no puede ser menor que el valor tomado';

/**
 * Sale price minus the trade-in value.
 * An unregistered device without a sale price must not look like a negative gap.
 */
export function outgoingTradeDifference(input: {
  registered: boolean;
  priceProvided: boolean;
  saleAmount: number;
  takeValue: number;
}): { difference: number | null; warning: string | null } {
  if (!input.registered && !input.priceProvided) {
    return {
      difference: null,
      warning: input.takeValue > 0 ? MISSING_OUTGOING_PRICE : null,
    };
  }
  const difference = input.saleAmount - input.takeValue;
  if (difference < 0) return { difference, warning: NEGATIVE_TRADE_DIFFERENCE };
  return { difference, warning: null };
}

export function equipmentSuggestions<T extends Product | OperationProductOption>(items: T[], query: string, limit = EQUIPMENT_SUGGESTION_LIMIT): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle || limit <= 0) return [];
  const matches: T[] = [];
  for (const item of items) {
    const haystack = [equipmentTitle(item.model, item.capacity), item.color, item.imei].join(' ').toLowerCase();
    if (!haystack.includes(needle)) continue;
    matches.push(item);
    if (matches.length >= limit) break;
  }
  return matches;
}
