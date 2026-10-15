import { Decimal } from '@prisma/client/runtime/library';
import { DomainError } from '../../lib/domain-error.js';

export const DENOMINATIONS = {
  ARS: [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.25, 0.1, 0.05, 0.01],
} as const;
export const money = (n: number | Decimal) => new Decimal(n).toDecimalPlaces(2);
export function countedMoney(currency: string, denominations: Record<string, number>) {
  const allowed = DENOMINATIONS[currency as keyof typeof DENOMINATIONS];
  if (!allowed) throw new DomainError('Moneda inválida');
  let total = new Decimal(0);
  for (const [face, count] of Object.entries(denominations)) {
    if (!(allowed as readonly number[]).includes(Number(face)) || !Number.isSafeInteger(count) || count < 0 || count > 1_000_000) throw new DomainError('Revisá los valores y cantidades del conteo');
    total = total.add(new Decimal(face).mul(count));
  }
  if (total.gt(100_000_000)) throw new DomainError('El conteo supera el máximo permitido');
  return money(total);
}
export function convertedMoney(amount: number, from: string, to: string, rate?: number) {
  if (from === to) return money(amount);
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new DomainError('Revisá la cotización de la conversión');
  const result = from === 'USD' ? money(new Decimal(amount).mul(rate)) : money(new Decimal(amount).div(rate));
  if (result.lte(0) || result.gt(100_000_000)) throw new DomainError('El importe convertido está fuera del rango permitido');
  return result;
}
export function cashMethod(method: string) {
  const normalized = method.trim().toUpperCase();
  return normalized === 'EFECTIVO' ? 'EFECTIVO' : ['TRANSFERENCIA', 'TRANSFER', 'TRANSFERENCIA BANCARIA'].includes(normalized) ? 'TRANSFERENCIA' : null;
}
