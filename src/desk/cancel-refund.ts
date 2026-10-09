function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Cash to give back when cancelling: cobrado = monto − deuda.
 * Mirrors backend/src/lib/cancel-refund.ts.
 */
export function cancellationRefund(status: string, cash: number, pendingBalance: number): number {
  const monto = Math.max(0, roundMoney(cash));
  const deuda = status === 'PENDIENTE' ? Math.min(monto, Math.max(0, roundMoney(pendingBalance))) : 0;
  return Math.max(0, roundMoney(monto - deuda));
}
