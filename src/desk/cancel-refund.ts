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

function roomCents(sale: RefundTarget, movements: RefundMovement[]): number {
  const open = bookOpenCents(sale);
  if (sale.openBalance != null) return open;
  return Math.max(0, open - linkedCents(sale.id, movements));
}

/**
 * Cash to give back when cancelling. Mirrors backend/src/lib/cancel-refund.ts:
 * only what this sale collected, and the debt removed is only this sale's remainder.
 */
export function cancellationRefund(target: RefundTarget, openSales: RefundTarget[], movements: RefundMovement[] = []): number {
  const cash = Math.max(0, cents(target.cash));
  const linked = linkedCents(target.id, movements);
  let pool = Math.max(0, netCents(movements.filter((row) => !row.saleId && !row.repairOrderId)));
  const ordered = [...openSales].sort((left, right) => (left.soldAt ?? '').localeCompare(right.soldAt ?? '') || left.id.localeCompare(right.id));
  if (!ordered.some((sale) => sale.id === target.id)) ordered.push(target);
  let applied = 0;
  for (const sale of ordered) {
    if (pool <= 0) break;
    const take = Math.min(pool, roomCents(sale, movements));
    if (sale.id === target.id) applied = take;
    pool -= take;
  }
  const open = bookOpenCents(target);
  const legacy = linked === 0 && target.status === 'COMPLETADA' ? Math.max(0, cash - open) : 0;
  const refund = Math.min(cash, Math.max(0, legacy + linked + applied));
  return fromCents(refund);
}
