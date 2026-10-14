import type { ClientDeposit } from '../types';
export function depositAmount(deposit: Pick<ClientDeposit, 'currency' | 'amount' | 'usdAmount'>, currency: string, rate: number | null) {
  if (deposit.currency === currency) return deposit.amount;
  if (currency === 'USD') return deposit.usdAmount;
  return rate && rate > 0 ? Math.round(deposit.usdAmount * rate * 100) / 100 : null;
}
export const depositStatus = { ACTIVE: 'Activa', CREDIT: 'Saldo a favor', APPLIED: 'Aplicada', REFUNDED: 'Devuelta' };
export const depositAvailable = (row: ClientDeposit) => row.status === 'ACTIVE' || row.status === 'CREDIT';
