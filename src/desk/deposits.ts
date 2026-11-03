import type { ClientDeposit } from '../types';
import { projectAmount, type MoneyCurrency } from './money';

export function initialDepositPreview(amount: number, currency: MoneyCurrency, saleCurrency: MoneyCurrency, rate: number | null, remaining: number) {
  if (!(amount > 0)) return { error: 'La seña debe ser mayor a cero', balance: null };
  if (!rate || !Number.isFinite(rate) || rate <= 0) return { error: 'Revisá la cotización antes de registrar la seña', balance: null };
  const usdAmount = projectAmount(amount, currency, 'USD', rate, 2).value;
  if (!(usdAmount > 0)) return { error: 'El equivalente USD debe ser mayor a cero', balance: null };
  const applied = depositAmount({ amount, currency, usdAmount }, saleCurrency, rate)!;
  const balance = projectAmount(remaining - applied, saleCurrency, saleCurrency, rate, 2).value;
  return balance < 0 ? { error: 'La seña no puede superar el saldo a cobrar', balance: null } : { error: null, balance };
}
export function depositAmount(deposit: Pick<ClientDeposit, 'currency' | 'amount' | 'usdAmount'>, currency: string, rate: number | null) {
  if (deposit.currency === currency) return deposit.amount;
  if (currency === 'USD') return deposit.usdAmount;
  return rate && rate > 0 ? Math.round(deposit.usdAmount * rate * 100) / 100 : null;
}
export const depositStatus = { ACTIVE: 'Activa', CREDIT: 'Saldo a favor', APPLIED: 'Aplicada', REFUNDED: 'Devuelta', REVERSED: 'Revertida' };
export const depositAvailable = (row: ClientDeposit) => row.status === 'ACTIVE' || row.status === 'CREDIT';
