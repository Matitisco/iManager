import { createHash } from 'node:crypto';
import { formatArDate, parseArDate } from '../../lib/ar-date.js';
import { normalizeCurrencyToken, normalizeImei, normalizeImportedDni, normalizeImportedPhone, normalizePayment, normalizeTradeIn } from './normalize-import.js';
import { parseMoney } from './sheet-plan.js';

export const SALE_TOTAL_REVIEW = 'Parece una fila de total: se conserva sin importe imputado';
export type SaleReviewRow = Record<string, string>;

export function saleReviewMessages(row: SaleReviewRow): string[] {
  return [...new Set((row._review || '').split('\n').filter(Boolean))];
}

export function addSaleReview(row: SaleReviewRow, message: string): void {
  row._review = [...new Set([...saleReviewMessages(row), message])].join('\n');
}

/** Canonical identity stays independent of quotes, stock, and review annotations. */
export function saleImportFingerprint(row: SaleReviewRow): string {
  return createHash('sha256').update(JSON.stringify([
    row.date || '', (row.clientName || '').toLowerCase(), normalizeImportedDni(row.clientDni), normalizeImportedPhone(row.clientPhone),
    (row.device || '').toLowerCase(), normalizeImei(row.productImei), parseMoney(row.amount || ''),
    normalizeCurrencyToken(row.currency), normalizePayment(row.paymentMethod), normalizeTradeIn(row.tradeIn),
    (row.seller || '').toLowerCase(), row.status === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA', row.sellerMemberId || null,
  ])).digest('hex');
}

/** One input row always produces one review row; incompatible values survive in notes. */
export function prepareSaleReviewRows(input: SaleReviewRow[], currency: 'ARS' | 'USD'): SaleReviewRow[] {
  const seen = new Map<string, number>();
  const imeis = new Set<string>();
  const rows = input.map(original => {
    const row = { ...original };
    const notes = [row.notes || ''];
    const preserve = (field: string) => { if (original[field]?.trim()) { const note = `${field} (origen): ${original[field]}`; if (!notes.join('\n').includes(note)) notes.push(note); } };
    row.clientName = (row.clientName || '').trim().replace(/\s+/g, ' ');
    row.device = (row.device || '').trim().replace(/\s+/g, ' ');
    let date = row.date || '';
    if (/^\d{5}(?:\.\d+)?$/.test(date) && Number(date) >= 20000 && Number(date) <= 80000) {
      date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(date)) * 86400000).toISOString().slice(0, 10);
    }
    const parsed = parseArDate(date);
    row.date = parsed ? formatArDate(parsed) : date;
    if (!parsed) { addSaleReview(row, 'Fecha faltante o inválida: se conserva para revisar'); preserve('date'); }
    const payment = normalizePayment(row.paymentMethod);
    if (payment === 'POR REVISAR') { addSaleReview(row, 'Medio de pago por revisar'); if (original.paymentMethod !== 'POR REVISAR') preserve('paymentMethod'); }
    row.paymentMethod = payment;
    const imei = normalizeImei(row.productImei);
    if (row.productImei && !imei) { addSaleReview(row, 'IMEI inválido: se importa sin vincular stock'); preserve('productImei'); }
    const rowCurrency = normalizeCurrencyToken(row.currency);
    if (!rowCurrency && row.currency) { addSaleReview(row, 'Moneda no reconocida: se usa la moneda de la tienda'); preserve('currency'); }
    row.currency = rowCurrency || currency;
    if (parseMoney(row.amount || '') == null || (parseMoney(row.amount || '') ?? 0) <= 0) {
      addSaleReview(row, 'Importe faltante o inválido: se conserva sin importe imputado'); preserve('amount');
      row._unpriced = 'true';
    }
    if (!row.clientName && !row.device && !imei) addSaleReview(row, 'Falta cliente o equipo');
    if (row._possibleTotal === 'true' || (!imei && [row.clientName, row.device].some(value => /^(total|subtotal|suma)(?:\s|:|$)/i.test(value || '')))) {
      row._possibleTotal = 'true'; addSaleReview(row, SALE_TOTAL_REVIEW); preserve('amount');
    }
    if (row.status && !['COMPLETADA', 'PENDIENTE'].includes(row.status.toUpperCase())) {
      addSaleReview(row, 'Estado no reconocido: se conserva en notas'); preserve('status');
    }
    for (const field of ['clientName', 'device', 'seller']) if ((row[field] || '').length > 120) {
      addSaleReview(row, `${field}: texto largo conservado completo en notas`); preserve(field);
      row[field] = row[field].slice(0, 120);
    }
    row.status = row.status?.toUpperCase() === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA';
    if (row._unassigned) addSaleReview(row, 'Columnas sin asignar conservadas en notas');
    const fingerprint = saleImportFingerprint(row);
    const occurrence = (seen.get(fingerprint) || 0) + 1;
    seen.set(fingerprint, occurrence);
    row._baseFingerprint = fingerprint;
    row._importFingerprint = occurrence === 1 ? fingerprint : createHash('sha256').update(`${fingerprint}:${occurrence}`).digest('hex');
    if (imei && imeis.has(imei)) addSaleReview(row, 'IMEI repetido en el archivo: se importa sin volver a descontar stock');
    if (imei) imeis.add(imei);
    row.notes = [...new Set(notes.filter(Boolean))].join('\n');
    return row;
  });
  for (const row of rows) if ((seen.get(row._baseFingerprint) || 0) > 1) addSaleReview(row, 'Posible venta duplicada en el archivo');
  return rows;
}
