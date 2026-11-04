import { calendarDay } from '../periodic-reports/schedule.js';
import type { NetProfitFigures } from '../reports/net-profit.js';

export function monthPeriods(count: number, zone: string, now = new Date()) {
  const today = calendarDay(now, zone);
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    const key = date.toISOString().slice(0, 7);
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);
    return { month: key, from: `${key}-01`, to: end < today ? end : today };
  });
}
export const zeroFigures = (): NetProfitFigures => ({
  revenue: 0,
  cost: 0,
  grossProfit: 0,
  expenses: 0,
  netProfit: 0,
});
export function sumFigures(rows: NetProfitFigures[]) {
  return rows.reduce((sum, row) => {
    for (const key of Object.keys(sum) as (keyof NetProfitFigures)[])
      sum[key] += row[key];
    return sum;
  }, zeroFigures());
}

/** Common chart labels, with the closing day evaluated in each store's zone. */
export function monthRange(month: string, zone: string, now: Date) {
  const [year, number] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  const today = calendarDay(now, zone);
  return { from: `${month}-01`, to: end < today ? end : today };
}
