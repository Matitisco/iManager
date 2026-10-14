import type { OperationProductOption, Product } from '../types';
import { equipmentTitle } from './format';

export const EQUIPMENT_SUGGESTION_LIMIT = 6;
export const MISSING_OUTGOING_PRICE = 'Completá el precio de salida para calcular la diferencia';
export const NEGATIVE_TRADE_DIFFERENCE = 'El precio de salida no puede ser menor que el valor tomado';

/**
 * Sale price minus the trade-in value.
 * A missing price or a price below the trade-in must not surface a negative amount:
 * callers show the warning and leave the difference empty.
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
  if (difference < 0) return { difference: null, warning: NEGATIVE_TRADE_DIFFERENCE };
  return { difference, warning: null };
}

export function reservedForOtherClient<T extends Product | OperationProductOption>(items: T[], query: string, clientId: string): T | null {
  const reserved = items.filter((item) => item.reservedDepositId && item.reservedClientId !== clientId);
  return equipmentSuggestions(reserved, query, 1)[0] ?? null;
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
