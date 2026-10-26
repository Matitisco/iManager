import type { Client } from '../types';
import type { MoneyApi } from './exchange';
import type { StoredAmount } from './money';
import { formatClientSpending, importedClientSpending } from './client-spending';
import './client-spending.css';

export function ClientSpending({ client, parts, money, compact = false }: {
  client?: Client; parts: StoredAmount[]; money: MoneyApi; compact?: boolean;
}) {
  const history = importedClientSpending(client);
  const current = formatClientSpending(parts, money);
  if (compact) return <span className="cl-spending"><b>{current}</b>{history.length ? <span className="cl-spending-history"><small>Histórico importado</small><b>{formatClientSpending(history, money)}</b></span> : null}</span>;
  return <>
    <div className="dstat"><div className="eb">Total iManager</div><div className="big">{current}</div></div>
    {history.length ? <div className="dstat"><div className="eb">Histórico importado</div><div className="big">{formatClientSpending(history, money)}</div></div> : null}
  </>;
}
