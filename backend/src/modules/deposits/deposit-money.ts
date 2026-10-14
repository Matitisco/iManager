import { Decimal } from '@prisma/client/runtime/library';
import { DomainError } from '../../lib/domain-error.js';

export function depositValue(deposit: { amount: Decimal | number; currency: string; usdAmount: Decimal | number }, currency: string, rate?: number | null) {
  if (currency !== 'ARS' && currency !== 'USD') throw new DomainError('Moneda inválida');
  if (deposit.currency === currency) return new Decimal(deposit.amount).toDecimalPlaces(2);
  if (currency === 'USD') return new Decimal(deposit.usdAmount).toDecimalPlaces(2);
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new DomainError('Indicá una cotización válida para aplicar la seña en ARS');
  return new Decimal(deposit.usdAmount).mul(rate).toDecimalPlaces(2);
}
