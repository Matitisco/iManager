export const MANUAL_QUOTE_ORDER_ERROR = 'La compra no puede ser mayor que la venta';

export function manualQuoteOrderError(buy: number, sell: number): string | null {
  if (buy > 0 && sell > 0 && buy > sell) return MANUAL_QUOTE_ORDER_ERROR;
  return null;
}
