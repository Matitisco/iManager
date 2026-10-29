import { historicalSaleRates } from './sale-import-quotes.js';
import { formatArDate, parseArDate } from '../../lib/ar-date.js';
import { currentBlueRate } from '../../lib/blue-rate.js';
import { addSaleReview, type SaleReviewRow } from './sale-import-row.js';
import { parseMoney } from './sheet-plan.js';

export async function priceSaleReviewRows(rows: SaleReviewRow[], freezeReviewedRate = false): Promise<void> {
  if (freezeReviewedRate) for (const row of rows) {
    if (!row._exchangeRate && Number(row.exchangeRate) > 0 && Number.isFinite(Number(row.exchangeRate))) {
      row._exchangeRate = row.exchangeRate; row._rateSource = 'provided'; row._rateDate = row.date;
    }
  }
  const ars = rows.filter(row => row.currency === 'ARS');
  if (!ars.length) return;
  const needsHistory = ars.some(row => !freezeReviewedRate || !Number.isFinite(Number(row._exchangeRate)) || Number(row._exchangeRate) <= 0);
  const rates = needsHistory ? await historicalSaleRates() : new Map<string, number>();
  let todayRate: Promise<number> | undefined;
  for (const row of ars) {
    const date = parseArDate(row.date);
    const key = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
    const reviewed = freezeReviewedRate && Number(row._exchangeRate) > 0 && Number.isFinite(Number(row._exchangeRate));
    const historic = rates.get(key);
    const rate = reviewed ? Number(row._exchangeRate) : historic ?? await (todayRate ??= currentBlueRate());
    const fallback = reviewed ? row._rateSource === 'today' : historic === undefined;
    row._exchangeRate = String(rate);
    row._rateSource = reviewed ? row._rateSource || 'provided' : fallback ? 'today' : 'historical';
    row._rateDate = reviewed ? row._rateDate : fallback ? formatArDate(new Date()) : row.date;
    const amount = row._possibleTotal === 'true' || row._unpriced === 'true' ? 0 : parseMoney(row.amount || '') ?? 0;
    row._amountUsd = (Math.round(amount / rate * 100) / 100).toFixed(2);
    if (fallback) addSaleReview(row, `Sin cotización histórica para ${row.date || 'la fecha faltante'}: se usa la de hoy (${row._rateDate}), ARS ${rate} por USD`);
  }
}
