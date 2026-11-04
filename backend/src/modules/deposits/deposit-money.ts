import { Decimal } from '@prisma/client/runtime/library';
import { DomainError } from '../../lib/domain-error.js';

/** Immutable receipt snapshot shared by client receipts and deposits collected in a sale. */
export function depositMoney(input: { amount: number; currency: string; exchangeRate: number }) {
  if (input.currency !== 'ARS' && input.currency !== 'USD') throw new DomainError('Moneda inválida');
  if (!Number.isFinite(input.amount) || !Number.isFinite(input.exchangeRate)) throw new DomainError('Monto y cotización inválidos');
  const amount = new Decimal(input.amount).toDecimalPlaces(2);
  const exchangeRate = new Decimal(input.exchangeRate).toDecimalPlaces(2);
  if (!amount.gt(0) || !exchangeRate.gt(0)) throw new DomainError('Monto y cotización deben ser mayores a cero');
  const usdAmount = input.currency === 'USD' ? amount : amount.div(exchangeRate).toDecimalPlaces(2);
  if (!usdAmount.gt(0)) throw new DomainError('El equivalente USD debe ser mayor a cero');
  return { amount, exchangeRate, usdAmount };
}

export function balanceAfterDeposit(deposit: Parameters<typeof depositValue>[0], currency: string, rate: number, remaining: Decimal | number) {
  const applied = depositValue(deposit, currency, rate);
  if (!applied.gt(0) || applied.gt(remaining)) throw new DomainError('La seña debe ser mayor a cero y no superar el saldo a cobrar');
  return new Decimal(remaining).sub(applied).toDecimalPlaces(2);
}

export function depositValue(deposit: { amount: Decimal | number; currency: string; usdAmount: Decimal | number }, currency: string, rate?: number | null) {
  if (currency !== 'ARS' && currency !== 'USD') throw new DomainError('Moneda inválida');
  if (deposit.currency === currency) return new Decimal(deposit.amount).toDecimalPlaces(2);
  if (currency === 'USD') return new Decimal(deposit.usdAmount).toDecimalPlaces(2);
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new DomainError('Indicá una cotización válida para aplicar la seña en ARS');
  return new Decimal(deposit.usdAmount).mul(rate).toDecimalPlaces(2);
}
