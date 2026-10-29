import { prisma } from '../../plugins/prisma.js';
import { normalizeImei } from './normalize-import.js';
import { decideInventoryLink } from './link-imported-sale.js';
import { addSaleReview, prepareSaleReviewRows, type SaleReviewRow } from './sale-import-row.js';
import { priceSaleReviewRows } from './sale-import-rate.js';
import type { AnalysisResult } from './analyze-import.service.js';

/** Business warnings belong to the preview, scoped to the active store. */
export async function reviewSaleImport(storeId: string, analysis: AnalysisResult): Promise<AnalysisResult> {
  const rows = prepareSaleReviewRows(analysis.rows, analysis.currency);
  const imeis = [...new Set(rows.map(row => normalizeImei(row.productImei)).filter(Boolean))];
  const keys = [...new Set(rows.map(row => row._importFingerprint))];
  const [stock, existing] = await Promise.all([
    imeis.length ? prisma.inventoryItem.findMany({
      where: { storeId, imei: { in: imeis } },
      select: { id: true, imei: true, status: true, archivedAt: true, reservedDepositId: true, sales: { where: { status: { not: 'CANCELADA' } }, select: { id: true }, take: 1 } },
    }) : [],
    keys.length ? prisma.sale.findMany({
      where: { storeId, OR: keys.map(key => ({ customFields: { path: ['importFingerprint'], equals: key } })) },
      select: { customFields: true },
    }) : [],
  ]);
  const imported = new Set(existing.map(sale => (sale.customFields as Record<string, unknown> | null)?.importFingerprint));
  const stockByImei = new Map(stock.map(item => [item.imei, item]));
  for (const row of rows) {
    if (imported.has(row._importFingerprint)) {
      row._alreadyImported = 'true';
      addSaleReview(row, 'Venta ya importada: se conserva la existente, sin duplicarla');
    }
    const imei = normalizeImei(row.productImei);
    if (!imei) continue;
    const item = stockByImei.get(imei);
    if (!item) addSaleReview(row, 'IMEI no encontrado en stock: la venta se importa igual, sin vincular equipo');
    else if (item.reservedDepositId || decideInventoryLink(item, item.sales.length > 0).action !== 'link') {
      addSaleReview(row, 'IMEI no disponible en stock: la venta se importa igual, sin modificar el equipo');
    }
  }
  await priceSaleReviewRows(rows);
  return { ...analysis, rows, diagnostics: { ...analysis.diagnostics!, warnings: rows.flatMap(row => row._review ? [{ row: Number(row._sourceRow), message: row._review }] : []) } };
}

export function saleImportNotes(row: SaleReviewRow): string {
  return [...new Set([row.notes, row._review, row.currency === 'ARS'
    ? `Importe original: ARS ${row.amount || 'sin importe'}. Cotización ${row._rateSource === 'provided' ? 'indicada' : row._rateSource === 'historical' ? 'histórica' : 'de hoy'} (${row._rateDate}): ${row._exchangeRate} ARS/USD. Importe guardado: USD ${row._amountUsd}.`
    : ''].filter(Boolean))].join('\n');
}
