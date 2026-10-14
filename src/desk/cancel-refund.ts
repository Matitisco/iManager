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
  refund: number;
  credit: number;
};

function cents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

function bookOpenCents(target: Pick<RefundTarget, 'cash' | 'status' | 'openBalance'>): number {
  const cash = Math.max(0, cents(target.cash));
  if (target.openBalance != null) return Math.min(cash, Math.max(0, cents(target.openBalance)));
  return target.status === 'PENDIENTE' ? cash : 0;
}

function netCents(rows: RefundMovement[]): number {
  return rows.reduce((total, row) => {
    const amount = Math.max(0, cents(row.amount));
    if (row.kind === 'PAGO') return total + amount;
    if (row.kind === 'VUELTO') return total - amount;
    return total;
  }, 0);
}

function linkedCents(saleId: string, movements: RefundMovement[]): number {
  return Math.max(0, netCents(movements.filter((row) => row.saleId === saleId)));
}

function unlinked(movements: RefundMovement[]): RefundMovement[] {
  return movements.filter((row) => !row.saleId && !row.repairOrderId);
}

function manualCents(movements: RefundMovement[]): number {
  return unlinked(movements).reduce((total, row) => {
    const amount = Math.max(0, cents(row.amount));
    if (row.kind === 'CARGO') return total + amount;
    if (row.kind === 'DESCUENTO' || row.kind === 'NOTA_CREDITO') return total - amount;
    return total;
  }, 0);
}

function ordered(target: RefundTarget, openSales: RefundTarget[]): RefundTarget[] {
  const rows = [...openSales].sort((left, right) => (left.soldAt ?? '').localeCompare(right.soldAt ?? '') || left.id.localeCompare(right.id));
  if (!rows.some((sale) => sale.id === target.id)) rows.push(target);
  return rows;
}

function stillOwed(openSales: RefundTarget[], movements: RefundMovement[], pendingBalance: number): Map<string, number> {
  const pending = Math.max(0, cents(pendingBalance));
  const rows = [...openSales].sort((left, right) => (left.soldAt ?? '').localeCompare(right.soldAt ?? '') || left.id.localeCompare(right.id));
  const lineSum = rows.reduce((total, sale) => total + bookOpenCents(sale), 0);
  const surplus = Math.max(0, pending - lineSum);
  const reserved = surplus > 0 ? surplus : Math.max(0, manualCents(movements));
  const forSales = Math.max(0, pending - reserved);
  let coverage = Math.max(0, lineSum - forSales);
  const still = new Map<string, number>();
  for (const sale of rows) {
    const open = bookOpenCents(sale);
    const hole = Math.min(open, coverage);
    still.set(sale.id, open - hole);
    coverage -= hole;
  }
  return still;
}

/**
 * Cash to give back when cancelling, and the general payment that stays as
 * credit. Mirrors backend/src/lib/cancel-refund.ts.
 */
export function cancellationPlan(target: RefundTarget, openSales: RefundTarget[], movements: RefundMovement[] = [], pendingBalance = 0): CancellationPlan {
  const cash = Math.max(0, cents(target.cash));
  const linked = linkedCents(target.id, movements);
  const open = bookOpenCents(target);
  const legacy = linked === 0 && target.status === 'COMPLETADA' ? Math.max(0, cash - open) : 0;
  const refund = Math.min(cash, Math.max(0, legacy + linked));
  const sales = ordered(target, openSales);
  const still = stillOwed(sales, movements, pendingBalance);
  let pool = Math.max(0, netCents(unlinked(movements)));
  let credit = 0;
  for (const sale of sales) {
    if (pool <= 0) break;
    const hole = Math.max(0, bookOpenCents(sale) - (still.get(sale.id) ?? 0));
    const take = Math.min(pool, hole);
    if (sale.id === target.id) credit = take;
    pool -= take;
  }
  return { refund: fromCents(refund), credit: fromCents(credit) };
}

export function cancellationRefund(target: RefundTarget, openSales: RefundTarget[], movements: RefundMovement[] = [], pendingBalance = 0): number {
  return cancellationPlan(target, openSales, movements, pendingBalance).refund;
}
