import { DomainError } from "./domain-error.js";

export const MANUAL_QUOTE_ORDER_ERROR = "La compra no puede ser mayor que la venta";

export function assertManualQuoteOrder(buy: number | null, sell: number | null) {
  if (buy != null && sell != null && buy > sell) {
    throw new DomainError(MANUAL_QUOTE_ORDER_ERROR, 400);
  }
}
