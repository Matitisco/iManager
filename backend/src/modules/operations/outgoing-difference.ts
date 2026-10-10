export const MISSING_OUTGOING_PRICE = "Completá el precio de salida para calcular la diferencia";
export const NEGATIVE_TRADE_DIFFERENCE = "La diferencia no puede ser negativa";

/**
 * Sale price minus trade-in value.
 * An unregistered device with no sale price must not surface a negative gap:
 * the price is missing, so the caller validates and warns instead.
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
