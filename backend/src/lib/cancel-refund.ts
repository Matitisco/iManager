import { Decimal } from "@prisma/client/runtime/library";

const ZERO = new Decimal(0);

function money(value: number): Decimal {
  return new Decimal(Number.isFinite(value) ? value : 0).toDecimalPlaces(2);
}

export type RefundMovement = {
  saleId?: string | null;
  repairOrderId?: string | null;
  kind?: string | null;
  amount: number;
};

export type RefundTarget = {
  id: string;
  cash: number;
  status: string;
  openBalance?: number | null;
  soldAt?: string | null;
};

/**
 * Cash still owed on the sale books.
 * A null open balance means a pending sale owes its whole cash and a completed sale owes nothing.
 */
export function bookOpen(target: Pick<RefundTarget, "cash" | "status" | "openBalance">): Decimal {
  const cash = Decimal.max(money(target.cash), ZERO);
  if (target.openBalance != null) return Decimal.min(cash, Decimal.max(money(target.openBalance), ZERO));
  return target.status === "PENDIENTE" ? cash : ZERO;
}

function netCollected(rows: RefundMovement[]): Decimal {
  return rows.reduce((total, row) => {
    const amount = Decimal.max(money(row.amount), ZERO);
    if (row.kind === "PAGO") return total.plus(amount);
    if (row.kind === "VUELTO") return total.minus(amount);
    return total;
  }, ZERO);
}

function linkedNet(saleId: string, movements: RefundMovement[]): Decimal {
  return Decimal.max(netCollected(movements.filter((row) => row.saleId === saleId)), ZERO);
}

function unpaidRoom(sale: RefundTarget, movements: RefundMovement[]): Decimal {
  const open = bookOpen(sale);
  if (sale.openBalance != null) return open;
  return Decimal.max(open.minus(linkedNet(sale.id, movements)), ZERO);
}

/**
 * Refund is the cash collected for this sale only: linked payments, an unlinked
 * payment applied to this sale's open balance (oldest sale first), and, for a
 * completed sale with no payment row, the cash that was not left open.
 * A price increase and any other debt stay out of the refund.
 * The balance to remove is only this sale's remaining debt.
 */
export function cancellationSettlement(
  target: RefundTarget,
  openSales: RefundTarget[],
  movements: RefundMovement[],
): { refund: Decimal; debtToRemove: Decimal } {
  const cash = Decimal.max(money(target.cash), ZERO);
  const linked = linkedNet(target.id, movements);
  let pool = Decimal.max(netCollected(movements.filter((row) => !row.saleId && !row.repairOrderId)), ZERO);
  const ordered = [...openSales].sort((left, right) => (left.soldAt ?? "").localeCompare(right.soldAt ?? "") || left.id.localeCompare(right.id));
  if (!ordered.some((sale) => sale.id === target.id)) ordered.push(target);
  let applied = ZERO;
  for (const sale of ordered) {
    if (pool.lessThanOrEqualTo(ZERO)) break;
    const take = Decimal.min(pool, unpaidRoom(sale, movements));
    if (sale.id === target.id) applied = take;
    pool = pool.minus(take);
  }
  const open = bookOpen(target);
  const legacy = linked.eq(ZERO) && target.status === "COMPLETADA" ? Decimal.max(cash.minus(open), ZERO) : ZERO;
  const refund = Decimal.min(cash, Decimal.max(legacy.plus(linked).plus(applied), ZERO));
  const alreadyInBooks = target.openBalance != null ? ZERO : linked;
  const debtToRemove = Decimal.max(open.minus(applied).minus(alreadyInBooks), ZERO);
  return { refund, debtToRemove };
}
