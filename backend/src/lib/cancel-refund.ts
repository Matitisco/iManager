import { Decimal } from "@prisma/client/runtime/library";

const ZERO = new Decimal(0);

function money(value: number): Decimal {
  return new Decimal(value).toDecimalPlaces(2);
}

/**
 * Cash already collected for an operation: `cobrado = monto − deuda`.
 * A pending operation's debt is whatever is still open on the client, capped by the cash of this operation.
 * A collected operation has no remaining debt, so the whole cash amount is due back.
 */
export function cancellationRefund(status: string, cash: number, pendingBalance: number): Decimal {
  const monto = Decimal.max(money(cash), ZERO);
  const deuda = status === "PENDIENTE"
    ? Decimal.min(monto, Decimal.max(money(pendingBalance), ZERO))
    : ZERO;
  const refund = monto.minus(deuda);
  return refund.greaterThan(ZERO) ? refund : ZERO;
}
