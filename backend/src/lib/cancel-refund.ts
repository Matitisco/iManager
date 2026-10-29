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

export type CancellationPlan = {
  refund: Decimal;
  debtToRemove: Decimal;
  credit: Decimal;
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

function unlinked(movements: RefundMovement[]): RefundMovement[] {
  return movements.filter((row) => !row.saleId && !row.repairOrderId);
}

/** General payments still free to cover an open sale. A credit already issued for one cancelled sale is spent. */
function generalPool(movements: RefundMovement[]): Decimal {
  const loose = Decimal.max(netCollected(unlinked(movements)), ZERO);
  const credited = movements.reduce((total, row) => {
    if (row.kind !== "CREDITO" || !row.saleId) return total;
    // Reverting a cancellation compensates its credit with a signed ledger row.
    return total.plus(money(row.amount));
  }, ZERO);
  return Decimal.max(loose.minus(credited), ZERO);
}

function orderedSales(target: RefundTarget, openSales: RefundTarget[]): RefundTarget[] {
  const ordered = [...openSales].sort((left, right) => (left.soldAt ?? "").localeCompare(right.soldAt ?? "") || left.id.localeCompare(right.id));
  if (!ordered.some((sale) => sale.id === target.id)) ordered.push(target);
  return ordered;
}

/**
 * How much of each open line is still inside the client's pending balance.
 * A general payment covers the oldest open sale first. That hole is credit,
 * not cash. Any pending left above those lines is the manual balance, even
 * when it was typed on the client and has no charge row.
 */
export function balanceStillOwed(openSales: RefundTarget[], movements: RefundMovement[], pendingBalance: number): Map<string, Decimal> {
  const pending = Decimal.max(money(pendingBalance), ZERO);
  const ordered = [...openSales].sort((left, right) => (left.soldAt ?? "").localeCompare(right.soldAt ?? "") || left.id.localeCompare(right.id));
  const lineSum = ordered.reduce((total, sale) => total.plus(bookOpen(sale)), ZERO);
  const paid = generalPool(movements);
  let coverage = Decimal.min(paid, lineSum);
  const still = new Map<string, Decimal>();
  for (const sale of ordered) {
    const open = bookOpen(sale);
    const hole = Decimal.min(open, coverage);
    still.set(sale.id, open.minus(hole));
    coverage = coverage.minus(hole);
  }
  let extra = Decimal.max(lineSum.minus(paid).minus(pending), ZERO);
  if (extra.greaterThan(ZERO)) {
    for (const sale of ordered) {
      if (extra.lessThanOrEqualTo(ZERO)) break;
      const current = still.get(sale.id) ?? ZERO;
      const cut = Decimal.min(current, extra);
      still.set(sale.id, current.minus(cut));
      extra = extra.minus(cut);
    }
  }
  return still;
}

/**
 * Cash to return is only what this sale collected: payments tied to it, minus
 * change, and the cash of a completed sale that never got a payment row.
 * A general client payment is not cash of this sale. When that payment is what
 * left the sale's debt out of the pending balance, it becomes credit instead.
 * The debt removed is only the part of this sale that is still in the balance,
 * so a manual balance stays where it was.
 */
export function cancellationSettlement(
  target: RefundTarget,
  openSales: RefundTarget[],
  movements: RefundMovement[],
  pendingBalance = 0,
): CancellationPlan {
  const cash = Decimal.max(money(target.cash), ZERO);
  const linked = linkedNet(target.id, movements);
  const open = bookOpen(target);
  const legacy = linked.eq(ZERO) && target.status === "COMPLETADA" ? Decimal.max(cash.minus(open), ZERO) : ZERO;
  const refund = Decimal.min(cash, Decimal.max(legacy.plus(linked), ZERO));
  const sales = orderedSales(target, openSales);
  const still = balanceStillOwed(sales, movements, pendingBalance);
  const saleStill = still.get(target.id) ?? ZERO;
  let pool = generalPool(movements);
  let credit = ZERO;
  for (const sale of sales) {
    if (pool.lessThanOrEqualTo(ZERO)) break;
    const hole = Decimal.max(bookOpen(sale).minus(still.get(sale.id) ?? ZERO), ZERO);
    const take = Decimal.min(pool, hole);
    if (sale.id === target.id) credit = take;
    pool = pool.minus(take);
  }
  const alreadyInBooks = target.openBalance != null ? ZERO : linked;
  const debtToRemove = Decimal.max(saleStill.minus(alreadyInBooks), ZERO);
  return { refund, debtToRemove, credit };
}
