import type { ReturnCaseView } from '../services/returns-api';
import { isVoidRow } from './format';
import type { Sale } from '../types';

/** A supplier RMA can issue its compensation before the case is closed. */
export function compensatedReturns(rows: readonly ReturnCaseView[]) {
  return rows.filter(row => !isVoidRow(row)
    && (row.resolution === 'CAMBIO' || row.resolution === 'REINTEGRO')
    && (row.settlement === 'REINTEGRO' || row.settlement === 'NOTA_CREDITO')
    && Boolean(row.compensatedOn ?? row.resolvedOn));
}

export function compensationDate(row: ReturnCaseView) {
  return (row.compensatedOn ?? row.resolvedOn)!;
}

/** Reporting entries keep the refund on its issue date, even for older sales. */
export function billingEntries(sales: readonly Sale[], returns: readonly ReturnCaseView[]): Sale[] {
  const byId = new Map(sales.map(sale => [sale.id, sale]));
  return [...sales.filter(sale => !isVoidRow(sale)), ...compensatedReturns(returns).map(row => ({
    ...byId.get(row.saleId ?? ''),
    id: `return-${row.id}`,
    clientId: row.clientId ?? '',
    clientName: row.clientName,
    productId: row.inventoryItemId ?? '',
    deviceLabel: row.deviceLabel,
    date: compensationDate(row),
    amount: -row.moneyAmount,
    amountCurrency: row.moneyCurrency,
    status: 'COMPLETADA',
    paymentMethod: 'DEVOLUCION',
  }))];
}
