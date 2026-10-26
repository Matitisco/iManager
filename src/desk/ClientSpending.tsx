import { Info } from 'lucide-react';
import type { Client } from '../types';
import type { MoneyApi } from './exchange';
import type { StoredAmount } from './money';
import { combinedClientSpending, formatClientSpending, importedClientSpending } from './client-spending';
import './client-spending.css';

export function ClientSpending({ client, parts, money, compact = false }: {
  client?: Client; parts: StoredAmount[]; money: MoneyApi; compact?: boolean;
}) {
  const history = importedClientSpending(client);
  const combined = combinedClientSpending(parts, client);
  const total = formatClientSpending(combined, money);
  const currentLabel = formatClientSpending(parts, money, combined.length > 1);
  const historyLabel = formatClientSpending(history, money, combined.length > 1);
  const breakdown = `iManager: ${currentLabel} · Histórico importado: ${historyLabel}`;
  if (compact) return <span className="cl-spending" title={history.length ? breakdown : undefined}><b>{total}{history.length ? <span className="cl-spending-info" aria-label={breakdown}><Info size={13} aria-hidden="true" /></span> : null}</b></span>;
  return <div className="dstat cl-spending-total"><div className="eb">Total comprado</div><div className="big">{total}</div>{history.length ? <details className="cl-spending-breakdown"><summary>Desglose del total</summary><dl><div><dt>iManager</dt><dd>{currentLabel}</dd></div><div><dt>Histórico importado</dt><dd>{historyLabel}</dd></div></dl></details> : null}</div>;
}
