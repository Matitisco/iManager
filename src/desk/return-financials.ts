import type { ReturnCaseView } from '../services/returns-api';

export { compensatedReturns, saleRevenueEntries as billingEntries } from './sale-returns';

export function compensationDate(row: ReturnCaseView) {
  return (row.compensatedOn ?? row.resolvedOn)!;
}
