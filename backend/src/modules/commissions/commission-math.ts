import { Decimal } from "@prisma/client/runtime/library";

export const COMMISSION_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const COMMISSION_BASES = ["PROFIT_PERCENT", "SALE_PERCENT", "FIXED_PER_UNIT"] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];
export type Currency = "ARS" | "USD";
export type CurrencyTotals = Record<Currency, number>;
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function timeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    hour,
    Number(bag.minute),
    Number(bag.second),
  );
  return asUtc - date.getTime();
}

export function zonedDayStart(year: number, month: number, day: number, timeZone = COMMISSION_TIME_ZONE) {
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = timeZoneOffsetMs(timeZone, noon);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offset);
}

function zonedParts(date: Date, timeZone = COMMISSION_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: bag.year ?? "", month: bag.month ?? "", day: bag.day ?? "" };
}

export function currentPeriodKey(now = new Date(), timeZone = COMMISSION_TIME_ZONE) {
  const parts = zonedParts(now, timeZone);
  return `${parts.year}-${parts.month}`;
}

export function monthBounds(key: string, now = new Date(), timeZone = COMMISSION_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const start = zonedDayStart(year, month, 1, timeZone);
  const end = month === 12 ? zonedDayStart(year + 1, 1, 1, timeZone) : zonedDayStart(year, month + 1, 1, timeZone);
  const closes = zonedParts(new Date(end.getTime() - 1), timeZone);
  const today = zonedParts(now, timeZone);
  return {
    key,
    start,
    end,
    label: `${MONTHS[month - 1]} ${year}`,
    closesLabel: `${closes.day}/${closes.month}`,
    current: today.year === String(year) && today.month === match[2],
  };
}

export function startOfZonedDay(date = new Date(), timeZone = COMMISSION_TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  return zonedDayStart(Number(parts.year), Number(parts.month), Number(parts.day), timeZone);
}


export const roundMoney = (amount: number) => new Decimal(amount).toDecimalPlaces(2).toNumber();
export const emptyTotals = (): CurrencyTotals => ({ ARS: 0, USD: 0 });
export function convert(amount: number, from: Currency, to: Currency, exchangeRate: number) {
  if (from === to) return roundMoney(amount);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error("Cotización inválida");
  const value = new Decimal(amount);
  return (from === "USD" ? value.mul(exchangeRate) : value.div(exchangeRate)).toDecimalPlaces(2).toNumber();
}
export function nextPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}`;
}
export interface RuleSnapshot {
  id: string;
  memberId: string | null;
  basis: CommissionBasis;
  rate: number;
  currency: Currency | null;
  effectiveFrom: Date;
  createdAt: Date;
}
function latest(rules: RuleSnapshot[]) {
  return [...rules].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
    || b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))[0] ?? null;
}
export function ruleForSale(rules: RuleSnapshot[], memberId: string, soldAt: Date) {
  const applicable = rules.filter(rule => rule.effectiveFrom <= soldAt);
  return latest(applicable.filter(rule => rule.memberId === memberId))
    ?? latest(applicable.filter(rule => rule.memberId === null));
}
export function commissionForSale(sale: {
  sellerMemberId: string | null;
  status: string;
  amount: number;
  cost: number;
  takeValue: number;
  currency: Currency;
  exchangeRate: number;
}, rule: RuleSnapshot | null) {
  if (!sale.sellerMemberId || !rule || ["CANCELADA", "CANCELLED"].includes(sale.status)) return 0;
  if (rule.basis === "FIXED_PER_UNIT") return convert(rule.rate, rule.currency ?? sale.currency, sale.currency, sale.exchangeRate);
  const base = rule.basis === "SALE_PERCENT" ? new Decimal(sale.amount)
    : new Decimal(sale.amount).minus(sale.cost).minus(sale.takeValue);
  return Decimal.max(0, base.mul(rule.rate).div(100)).toDecimalPlaces(2).toNumber();
}

/** Offset settlements against oldest debt in its chosen currency. This keeps a
 * fully settled balance at zero in every projection despite changing quotes. */
export function projectBalance(events: { period: string; at: number; currency: Currency; amount: number; exchangeRate: number }[]): CurrencyTotals {
  const buckets: Record<Currency, { amount: number; rate: number }[]> = { ARS: [], USD: [] };
  for (const event of [...events].sort((a, b) => a.period.localeCompare(b.period) || a.at - b.at)) {
    let remaining = event.amount;
    const entries = buckets[event.currency];
    for (const entry of entries) {
      if (!remaining || Math.sign(entry.amount) === Math.sign(remaining) || !entry.amount) continue;
      const offset = Math.min(Math.abs(entry.amount), Math.abs(remaining));
      entry.amount = roundMoney(entry.amount + Math.sign(remaining) * offset);
      remaining = roundMoney(remaining - Math.sign(remaining) * offset);
    }
    if (remaining) entries.push({ amount: remaining, rate: event.exchangeRate });
  }
  const projected = emptyTotals();
  for (const source of ["ARS", "USD"] as const) {
    for (const entry of buckets[source]) {
      for (const target of ["ARS", "USD"] as const) projected[target] = roundMoney(projected[target] + convert(entry.amount, source, target, entry.rate));
    }
  }
  return projected;
}
