import type { Sale } from '../types';
import type { ReturnCaseView } from '../services/returns-api';
import { isVoidRow } from './format';
import { inReportPeriod } from './report-period';

export function compensatedReturns(rows: readonly ReturnCaseView[], start?: Date, end?: Date) {
  return rows.filter(row => !isVoidRow(row)
    && (row.resolution === 'CAMBIO' || row.resolution === 'REINTEGRO')
    && (row.settlement === 'REINTEGRO' || row.settlement === 'NOTA_CREDITO')
    && Boolean(row.compensatedOn ?? row.resolvedOn)
    && (!start || !end || inReportPeriod(row.compensatedOn ?? row.resolvedOn ?? undefined, start, end)));
}

/** Financial entries for charts; originals remain intact in the sales table. */
export function saleRevenueEntries(sales: readonly Sale[], returns: readonly ReturnCaseView[]): Sale[] {
  return [...sales.filter(sale => !isVoidRow(sale)), ...compensatedReturns(returns).map(row => {
    const source = sales.find(sale => sale.id === row.saleId);
    return {
      ...source, id: `return-${row.id}`, clientId: row.clientId ?? source?.clientId ?? '', productId: row.inventoryItemId ?? source?.productId ?? '',
      date: row.compensatedOn ?? row.resolvedOn!, amount: -row.moneyAmount,
      amountCurrency: row.moneyCurrency, cantidad: 0, paymentMethod: source?.paymentMethod ?? '',
      status: 'COMPLETADA', deviceLabel: source?.deviceLabel ?? row.deviceLabel,
    };
  })];
}
