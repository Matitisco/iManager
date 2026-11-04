import type { Sale } from '../types';
import { isVoidRow } from './format';
import { Pill } from './ui';

export function SaleStatusPill({ sale }: { sale: Sale }) {
  const status = isVoidRow(sale) ? 'ANULADA' : sale.status;
  return <Pill status={status} kind="SALE_STATUS" label={status === 'PENDIENTE' && sale.hasInitialDeposit ? 'Seña' : undefined} />;
}
