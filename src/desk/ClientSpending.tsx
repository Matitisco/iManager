import type { Client } from '../types';
import type { MoneyApi } from './exchange';
import type { StoredAmount } from './money';
import { combinedClientSpending, formatClientSpending, importedClientSpending } from './client-spending';
import './client-spending.css';

export function ClientSpending({ client, parts, money, compact = false }: {
  client?: Client; parts: StoredAmount[]; money: MoneyApi; compact?: boolean;
}) {
  const history = importedClientSpending(client);
  const total = formatClientSpending(combinedClientSpending(parts, client), money);
  if (compact) return <span className="cl-spending"><b>{total}</b>{history.length ? <small>Incluye histórico</small> : null}</span>;
  return <div className="dstat cl-spending-total"><div className="eb">Total comprado</div><div className="big">{total}</div>{history.length ? <small className="cl-spending-note">Incluye histórico importado</small> : null}</div>;
}
