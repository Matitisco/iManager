import { useEffect, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchPeriodicSummary, type PeriodicSummary as Summary, type SummarySale, type SummaryReturn, type SummaryStock } from '../../services/periodic-summary-api';
import { toUserMessage } from '../../lib/user-message';
import { useOfflineRecovery } from '../../lib/offline-recovery';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { ListSkeleton } from '../list-skeleton';
import { usePhoneLayout } from '../section-notices';
import { DeskSelect } from '../select';
import { ScreenTitle, Sheet, useDesk } from '../ui';
import './periodic-summary.css';

export const summaryDate = (day: string) => day.split('-').reverse().join('/');
type Breakdown = 'sales' | 'returns' | 'stock';
const titles: Record<Breakdown, string> = { sales: 'Ventas', returns: 'Devoluciones y RMA', stock: 'Diferencias de stock' };

function SaleRow({ item }: { item: SummarySale }) {
  const money = useMoney();
  return <li className={`periodic-row${item.voided ? ' periodic-void' : ''}`}>
    <div className="periodic-line"><b>{item.title}</b><span className="periodic-value">{item.voided ? <s>{money.show(item.amount, item.currency)}</s> : money.show(item.amount, item.currency)}</span></div>
    <small>{summaryDate(item.day)}{!item.voided && item.detail ? ` · ${item.detail}` : ''}</small>
  </li>;
}
function ReturnRow({ item }: { item: SummaryReturn }) {
  const money = useMoney();
  return <li className="periodic-row">
    <div className="periodic-line"><b>{item.title}</b>{item.amount !== 0 ? <span className="periodic-value">{money.show(item.amount, item.currency)}</span> : <span className={`periodic-badge${item.pending ? ' pending' : ''}`}>{item.pending ? 'En curso' : 'Resuelto'}</span>}</div>
    <small>{summaryDate(item.day)}{item.detail ? ` · ${item.detail}` : ''}</small>
  </li>;
}
function StockRow({ item, full = false }: { item: SummaryStock; full?: boolean }) {
  return <li className="periodic-row">
    <div className="periodic-line"><b>{item.title}</b><span className={`periodic-badge${item.status === 'Falta' ? ' missing' : ''}`}>{item.status}</span></div>
    <small>IMEI {item.imei}{full ? ` · ${summaryDate(item.day)}` : ''}</small>
  </li>;
}

export function PeriodicSummary({ navigation }: { navigation: ReactNode }) {
  const { user, appSession, backendStatus, sessionConfirmed } = useAppContext();
  const { back } = useDesk();
  const phone = usePhoneLayout();
  const money = useMoney();
  const [selection, setSelection] = useState('latest-half');
  const [retry, setRetry] = useState(0);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [result, setResult] = useState<{ key: string; data?: Summary; error?: string }>({ key: '' });
  const ready = !!user && backendStatus === 'ready' && sessionConfirmed !== false && !!appSession?.store && !appSession.onboardingRequired;
  const key = JSON.stringify([appSession?.store?.id, appSession?.user?.id, user?.uid, appSession?.membership, ready, selection, retry]);
  const current = result.key === key ? result : undefined;
  const data = current?.data;
  const error = current?.error;
  useOfflineRecovery(error, () => setRetry(value => value + 1));
  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    const controller = new AbortController();
    setResult({ key });
    void fetchPeriodicSummary(user, selection, controller.signal).then(data => {
      if (active) setResult({ key, data });
    }).catch((cause: unknown) => {
      if (active) setResult({ key, error: toUserMessage(cause, 'No se pudo cargar el resumen periódico') });
    });
    return () => { active = false; controller.abort(); };
  }, [key, ready, user, selection]);
  useEffect(() => { setBreakdown(null); }, [key]);

  const salesTotal = data?.sales ? money.sum(data.sales.total) : null;
  const returnsTotal = data?.returns ? money.sum(data.returns.total) : null;
  const blocked = (data?.sales && salesTotal == null) || (data?.returns && returnsTotal == null);
  const total = (value: number | null) => value == null ? '—' : money.showActive(value);
  const selectPeriod = (value: string) => { setBreakdown(null); setSelection(value); };
  const card = (kind: Breakdown, value: ReactNode, items: ReactNode[], note?: string) => <section className="periodic-card" aria-label={titles[kind]}>
    <h2>{titles[kind]}</h2><div className="periodic-total">{value}</div>
    {items.length > 0 && note ? <p className="periodic-note">{note}</p> : null}
    {items.length ? <><ul className="periodic-list">{items.slice(0, 3)}</ul><button type="button" className="periodic-more" aria-haspopup="dialog" aria-label={`Ver todas las ${kind === 'stock' ? 'diferencias de stock' : titles[kind].toLowerCase()} (${items.length})`} onClick={() => setBreakdown(kind)}>Ver todas ({items.length})</button></> : null}
  </section>;
  const salesRows = data?.sales?.items.map(item => <SaleRow key={item.id} item={item} />) ?? [];
  const returnRows = data?.returns?.items.map(item => <ReturnRow key={item.id} item={item} />) ?? [];
  const stockRows = data?.stock?.items.map(item => <StockRow key={item.id} item={item} />) ?? [];
  const fullRows = breakdown === 'sales' ? salesRows : breakdown === 'returns' ? returnRows : data?.stock?.items.map(item => <StockRow key={item.id} item={item} full />) ?? [];
  return <div className="dscreen reports-screen periodic-summary">
    <ScreenTitle title="Reportes" back={back} desktop={null} navigation={navigation} />
    <div className="periodic-picker" role="group" aria-label="Período del resumen">
      <button type="button" className={`gchip sm${selection === 'latest-half' ? ' on' : ''}`} aria-pressed={selection === 'latest-half'} onClick={() => selectPeriod('latest-half')}>Última quincena</button>
      <button type="button" className={`gchip sm${selection === 'latest-month' ? ' on' : ''}`} aria-pressed={selection === 'latest-month'} onClick={() => selectPeriod('latest-month')}>Último mes</button>
      <div className={`periodic-previous${!selection.startsWith('latest-') ? ' selected' : ''}`}>
        <DeskSelect label="Períodos anteriores" value={selection.startsWith('latest-') ? '' : selection} placeholder={phone ? 'Anteriores' : 'Períodos anteriores'} disabled={!data} options={data ? [
          { value: 'months-heading', label: 'MENSUALES', disabled: true },
          ...data.periods.months.map(period => ({ value: period.id, label: period.label })),
          { value: 'halves-heading', label: 'QUINCENALES', disabled: true },
          ...data.periods.halves.map(period => ({ value: period.id, label: period.label })),
        ] : []} onChange={selectPeriod} />
      </div>
    </div>
    {error ? <div className="ferr" role="alert">{error}<button type="button" className="dbtn s" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : null}
    {!ready && backendStatus !== 'checking' ? <p className="ferr" role="alert">No se pudo cargar el resumen periódico. Revisá la conexión de la tienda.</p> : null}
    {!data && !error && (ready || backendStatus === 'checking') ? <ListSkeleton variant="cards" rows={3} testId="periodic-summary-loading" /> : null}
    {data ? <>
      {blocked ? <p className="ferr" role="status">{money.warning ?? FX_WARNING}</p> : null}
      <div className="periodic-grid">
        {data.sales ? card('sales', total(salesTotal), salesRows) : null}
        {data.returns ? card('returns', total(returnsTotal), returnRows) : null}
        {data.stock ? card('stock', `${data.stock.count} ${data.stock.count === 1 ? 'equipo' : 'equipos'}`, stockRows,
          data.stock.latestDay ? data.stock.counts === 1 ? `Conteo físico del ${summaryDate(data.stock.latestDay)}` : `${data.stock.counts} conteos físicos · último ${summaryDate(data.stock.latestDay)}` : undefined) : null}
      </div>
      {!data.sales && !data.returns && !data.stock ? <p className="periodic-note">No hay secciones habilitadas para este resumen.</p> : null}
    </> : null}
    {data && breakdown ? <Sheet className="periodic-breakdown" title={titles[breakdown]} onClose={() => setBreakdown(null)}><ul className="periodic-list">{fullRows}</ul></Sheet> : null}
  </div>;
}
