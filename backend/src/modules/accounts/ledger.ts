export const FREQUENCIES = ["SEMANAL", "QUINCENAL", "MENSUAL"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type ExcessMode = "OMIT" | "CREDIT" | "CHANGE";
export type Tone = "verde" | "amarillo" | "rojo";
export type InstallmentState = "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA";

export function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromCents(value: number): number {
  return value / 100;
}

/** Yellow runs from day 7 through day 30. */
export function balanceTone(days: number): Tone {
  if (!Number.isFinite(days) || days < 7) return "verde";
  if (days <= 30) return "amarillo";
  return "rojo";
}

export function ymdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function calendarDays(olderYmd: string, newerYmd: string): number {
  const older = Date.parse(`${olderYmd}T00:00:00Z`);
  const newer = Date.parse(`${newerYmd}T00:00:00Z`);
  if (!Number.isFinite(older) || !Number.isFinite(newer)) return 0;
  return Math.max(0, Math.round((newer - older) / 86_400_000));
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonthsYmd(ymd: string, months: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  cursor.setUTCDate(Math.min(day, last));
  return cursor.toISOString().slice(0, 10);
}

export function dueDateYmd(first: string, frequency: Frequency, index: number): string {
  if (frequency === "SEMANAL") return addDaysYmd(first, index * 7);
  if (frequency === "QUINCENAL") return addDaysYmd(first, index * 14);
  return addMonthsYmd(first, index);
}

export type InstallmentSlice = { sequence: number; dueDate: string; amount: number; paidAmount: number };

export function splitInstallments(input: {
  financed: number;
  count: number;
  surcharge: number;
  firstDue: string;
  frequency: Frequency;
  collectFirst: boolean;
}): InstallmentSlice[] {
  if (!Number.isInteger(input.count) || input.count < 2 || input.count > 36) {
    throw new Error("La cantidad de cuotas tiene que estar entre 2 y 36");
  }
  if (!(input.financed > 0)) throw new Error("No queda saldo para financiar");
  if (input.surcharge < 0) throw new Error("El recargo no puede ser negativo");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstDue)) throw new Error("Indicá el primer vencimiento");
  const total = cents(input.financed) + cents(input.surcharge);
  const base = Math.floor(total / input.count);
  const remainder = total - base * input.count;
  return Array.from({ length: input.count }, (_, index) => {
    const amount = fromCents(base + (index === input.count - 1 ? remainder : 0));
    return {
      sequence: index + 1,
      dueDate: dueDateYmd(input.firstDue, input.frequency, index),
      amount,
      paidAmount: input.collectFirst && index === 0 ? amount : 0,
    };
  });
}

export function installmentStatus(row: InstallmentSlice, today: string): InstallmentState {
  const remaining = cents(row.amount) - cents(row.paidAmount);
  if (remaining <= 0) return "PAGADA";
  if (row.dueDate < today) return "VENCIDA";
  if (cents(row.paidAmount) > 0) return "PARCIAL";
  return "PENDIENTE";
}

/** Show a general payment on the oldest unpaid installments without turning it into a cash collection. */
export function applyCoverage(rows: InstallmentSlice[], coverage: number): InstallmentSlice[] {
  if (!(coverage > 0) || rows.length === 0) return rows;
  const allocated = allocatePayment(rows, coverage);
  const bySequence = new Map(allocated.rows.map((row) => [row.sequence, row]));
  return rows.map((row) => bySequence.get(row.sequence) ?? row);
}

export function allocatePayment(rows: InstallmentSlice[], payment: number): { rows: InstallmentSlice[]; applied: number } {
  let left = Math.max(0, cents(payment));
  const next = rows.map((row) => ({ ...row })).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence);
  for (const row of next) {
    if (left <= 0) break;
    const remaining = cents(row.amount) - cents(row.paidAmount);
    if (remaining <= 0) continue;
    const take = Math.min(left, remaining);
    row.paidAmount = fromCents(cents(row.paidAmount) + take);
    left -= take;
  }
  return { rows: next, applied: fromCents(cents(payment) - left) };
}

export function convertTender(amount: number, tenderCurrency: string, saleCurrency: string, rate: number | null): number {
  if (!(amount > 0)) throw new Error("El pago tiene que ser mayor a cero");
  if (tenderCurrency === saleCurrency) return fromCents(cents(amount));
  if (rate == null || !(rate > 0)) throw new Error("Revisá la cotización antes de confirmar");
  if (saleCurrency === "ARS" && tenderCurrency === "USD") return fromCents(cents(amount * rate));
  if (saleCurrency === "USD" && tenderCurrency === "ARS") return fromCents(Math.round((amount / rate) * 100));
  throw new Error("La moneda del pago tiene que ser ARS o USD");
}

export function settleTenders(due: number, amountsInSaleCurrency: number[], excess: ExcessMode) {
  const dueCents = Math.max(0, cents(due));
  const amounts = amountsInSaleCurrency.map((amount) => cents(amount));
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  if (sum <= dueCents) {
    return { recorded: amounts.map(fromCents), shortfall: fromCents(dueCents - sum), credit: 0, change: 0 };
  }
  const extra = sum - dueCents;
  if (excess === "CREDIT") return { recorded: amounts.map(fromCents), shortfall: 0, credit: fromCents(extra), change: 0 };
  if (excess === "CHANGE") return { recorded: amounts.map(fromCents), shortfall: 0, credit: 0, change: fromCents(extra) };
  let over = extra;
  const kept = amounts.slice();
  for (let index = kept.length - 1; index >= 0 && over > 0; index -= 1) {
    const cut = Math.min(kept[index]!, over);
    kept[index] = kept[index]! - cut;
    over -= cut;
  }
  return { recorded: kept.map(fromCents), shortfall: 0, credit: 0, change: 0 };
}

export function priceRiseDebt(input: {
  priorAmount: number;
  nextAmount: number;
  priorDue: number;
  nextDue: number;
  priorStatus: string;
  hasClient: boolean;
}): { extra: number; reopen: boolean; error?: string } {
  const rose = cents(input.nextAmount) > cents(input.priorAmount);
  const dueRise = cents(input.nextDue) - cents(input.priorDue);
  if (!rose || dueRise <= 0 || input.priorStatus !== "COMPLETADA") return { extra: 0, reopen: false };
  if (!input.hasClient) return { extra: 0, reopen: false, error: "Para dejar la diferencia como deuda, la venta necesita un cliente" };
  return { extra: fromCents(dueRise), reopen: true };
}

export function monthDayWithin(birthdayYmd: string, todayYmd: string, leadDays: number): boolean {
  const parts = birthdayYmd.split("-");
  if (parts.length < 3) return false;
  const [, month, day] = parts;
  const lead = Math.max(0, leadDays);
  for (let offset = 0; offset <= lead; offset += 1) {
    const [, cursorMonth, cursorDay] = addDaysYmd(todayYmd, offset).split("-");
    if (cursorMonth === month && cursorDay === day) return true;
  }
  return false;
}

export function unpaidInstallments(rows: InstallmentSlice[]): number {
  return fromCents(rows.reduce((total, row) => total + Math.max(0, cents(row.amount) - cents(row.paidAmount)), 0));
}
