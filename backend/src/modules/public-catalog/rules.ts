import { Prisma } from '@prisma/client';

// OWN stores only exceptions: inventory added later is visible automatically.
export function itemVisibleInCatalog(mode: string, globalVisible: boolean, hidden: boolean): boolean {
  return mode === 'OWN' ? !hidden : globalVisible;
}

export function batteryMinimum(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d/.test(normalized)) return null;
  const values = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!values.length) return null;
  const minimum = Math.min(...values);
  return minimum > 0 && minimum <= 1 && !normalized.includes('%') ? minimum * 100 : minimum;
}
export function ruleReason(item: { status: string; quantity: number; batteryHealth: string; archivedAt?: Date | null; needsCompletion?: boolean }, config: { hideWithoutStock: boolean; hideReserved: boolean; minBattery: number | null }): string | null {
  if (item.archivedAt || item.needsCompletion) return 'No disponible';
  if (config.hideWithoutStock && (item.quantity <= 0 || ['VENDIDO', 'SIN_STOCK'].includes(item.status))) return 'Regla: sin stock';
  if (config.hideReserved && item.status === 'RESERVADO') return 'Regla: reservado';
  const battery = batteryMinimum(item.batteryHealth);
  if (config.minBattery != null && (battery == null || battery < config.minBattery)) return `Regla: batería < ${config.minBattery} %`;
  return null;
}
export function countAvailable(items: { status: string; cantidad?: number }[]) {
  return items.filter(item => !item.status || item.status === 'DISPONIBLE').reduce((sum, item) => sum + (item.cantidad ?? 1), 0);
}
// Decimal arithmetic through adjustment and conversion; round only the final amount.
export function calculateCatalogPrice(input: {
  mode: string; percent: Prisma.Decimal.Value;
  list: Prisma.Decimal.Value | null; cost?: Prisma.Decimal.Value | null;
  currency: string; manual?: { price: Prisma.Decimal.Value; currency: string } | null;
  target?: string; rate?: Prisma.Decimal.Value;
}): { price: number | null; currency: string } {
  const manual = input.mode === 'MANUAL' ? input.manual : null;
  const source = manual?.currency ?? input.currency;
  const currency = !input.target || input.target === 'ORIGINAL' ? source : input.target;
  const base = manual ? manual.price : input.mode === 'COST_PERCENT' ? input.cost : input.list;
  if (base == null) return { price: null, currency };
  let amount = new Prisma.Decimal(base);
  if (input.mode !== 'MANUAL') amount = amount.mul(new Prisma.Decimal(1).add(new Prisma.Decimal(input.percent).div(100)));
  if (source !== currency) amount = currency === 'USD' ? amount.div(input.rate ?? 1) : amount.mul(input.rate ?? 1);
  return { price: amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(), currency };
}
export function convertCatalogPrice(price: number, from: string, to: string, rate: number): number {
  return calculateCatalogPrice({ mode: 'LIST_PERCENT', percent: 0, list: price, currency: from, target: to, rate }).price!;
}
