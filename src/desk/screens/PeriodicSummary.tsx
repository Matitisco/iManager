import { ReplayValue } from '../replay-privacy';
import { toUserMessage, isNetworkErrorMessage } from '../../lib/user-message';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchPeriodicSummary, type PeriodicSummary as Summary, type SummarySale, type SummaryReturn, type SummaryStock } from '../../services/periodic-summary-api';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { ListSkeleton } from '../list-skeleton';
import { usePhoneLayout } from '../section-notices';
import { DeskSelect } from '../select';
import { ScreenTitle, Sheet, useDesk } from '../ui';
import './periodic-summary.css';
import { ReportMailSettings } from './ReportMailSettings';

export const summaryDate = (day: string) => day.split('-').reverse().join('/');
type Breakdown = 'sales' | 'returns' | 'stock';
const titles: Record<Breakdown, string> = { sales: 'Ventas', returns: 'Devoluciones y RMA', stock: 'Diferencias de stock' };

function SaleRow({ item }: { item: SummarySale }) {
  const money = useMoney();
  return <li className={`phone-row periodic-row${item.voided ? ' periodic-void is-void' : ''}`}>
    <div className="periodic-copy"><b>{item.title}</b><small>{summaryDate(item.day)}<ReplayValue>{!item.voided && item.detail ? ` · ${item.detail}` : ''}</ReplayValue></small></div>
    <div className="periodic-end"><b data-ph-mask className="periodic-value">{item.voided ? <s>{money.show(item.amount, item.currency)}</s> : money.show(item.amount, item.currency)}</b>{item.voided ? <span className="spill periodic-danger">Anulado</span> : null}</div>
  </li>;
}
function ReturnRow({ item }: { item: SummaryReturn }) {
  const money = useMoney();
  return <li className="phone-row periodic-row">
    <div className="periodic-copy"><b>{item.title}</b><small>{summaryDate(item.day)}<ReplayValue>{item.detail ? ` · ${item.detail}` : ''}</ReplayValue></small></div>
    <div className="periodic-end">{item.amount !== 0 ? <b data-ph-mask className="periodic-value">{money.show(item.amount, item.currency)}</b> : <span className={`spill ${item.pending ? 'lime' : 'mid'}`}>{item.pending ? 'En curso' : 'Resuelto'}</span>}</div>
  </li>;
}
function StockRow({ item, full = false }: { item: SummaryStock; full?: boolean }) {
  return <li className="phone-row periodic-row">
    <div className="periodic-copy"><b>{item.title}</b><small>IMEI <ReplayValue>{item.imei}</ReplayValue>{full ? ` · ${summaryDate(item.day)}` : ''}</small></div>
    <div className="periodic-end"><span className={`spill ${item.status === 'Falta' ? 'periodic-danger' : 'mid'}`}>{item.status}</span></div>
  </li>;
}

export function PeriodicSummary({ navigation }: { navigation: ReactNode }) {
  const { user, appSession, backendStatus, sessionConfirmed } = useAppContext();
  const { back } = useDesk();
  const phone = usePhoneLayout();
  const money = useMoney();
  const hashParams = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const [selection, setSelection] = useState(() => hashParams().get('period') || 'latest-half');
  const [mailTab, setMailTab] = useState(() => hashParams().get('view') === 'mail');
  const owner = appSession?.membership?.role === 'OWNER';
  useEffect(() => {
    const sync = () => { setMailTab(hashParams().get('view') === 'mail'); setSelection(hashParams().get('period') || 'latest-half'); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const selectTab = (mail: boolean) => { setMailTab(mail); const params = hashParams(); if (mail) params.set('view', 'mail'); else params.delete('view'); window.location.hash = `#/analisis/resumen-periodico${params.size ? `?${params}` : ''}`; };
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [result, setResult] = useState<{ key: string; data?: Summary; unavailable?: boolean; networkFailure?: boolean }>({ key: '' });
  const ready = !!user && backendStatus === 'ready' && sessionConfirmed !== false && !!appSession?.store && !appSession.onboardingRequired;
  const key = JSON.stringify([appSession?.store?.id, appSession?.user?.id, user?.uid, appSession?.membership, ready, selection]);
  const current = result.key === key ? result : undefined;
  const data = current?.data;
  const unavailable = current?.unavailable;
  useEffect(() => {
    if (!ready || !user || (mailTab && owner)) return;
    let active = true;
    const controller = new AbortController();
    setResult({ key });
    void fetchPeriodicSummary(user, selection, controller.signal).then(data => {
      if (active) setResult({ key, data });
    }).catch((cause: unknown) => {
      if (!active) return;
      console.warn('No se pudo cargar el resumen periódico.', cause);
      setResult({ key, unavailable: true, networkFailure: isNetworkErrorMessage(toUserMessage(cause)) });
    });
    return () => { active = false; controller.abort(); };
  }, [key, ready, user, selection, mailTab, owner]);
  useEffect(() => { setBreakdown(null); }, [key]);

  const salesTotal = data?.sales ? money.sum(data.sales.total) : null;
  const returnsTotal = data?.returns ? money.sum(data.returns.total) : null;
  const blocked = (data?.sales && salesTotal == null) || (data?.returns && returnsTotal == null);
  const total = (value: number | null) => value == null ? '—' : money.showActive(value);
  const selectPeriod = (value: string) => { setBreakdown(null); setSelection(value); const params = hashParams(); params.set('period', value); window.location.hash = `#/analisis/resumen-periodico?${params}`; };
  const periodLabel = data ? `${data.period.from.slice(8)} al ${summaryDate(data.period.to)}` : '';
  const card = (kind: Breakdown, value: ReactNode, items: ReactNode[], note?: string) => <section className="dcard periodic-card" aria-label={titles[kind]}>
    <div className="dch"><h3>{titles[kind]}</h3>{items.length ? <button type="button" className="wlink periodic-more" aria-haspopup="dialog" aria-label={`Ver todas las ${kind === 'stock' ? 'diferencias de stock' : titles[kind].toLowerCase()} (${items.length})`} onClick={() => setBreakdown(kind)}>Ver todas ({items.length})</button> : null}</div><div data-ph-mask={kind !== 'stock' || undefined} className="periodic-total">{value}</div>
    {items.length > 0 && note ? <p className="periodic-note">{note}</p> : null}
    {items.length ? <ul className="phone-rows periodic-list">{items.slice(0, 3)}</ul> : null}
  </section>;
  const salesRows = data?.sales?.items.map(item => <SaleRow key={item.id} item={item} />) ?? [];
  const returnRows = data?.returns?.items.map(item => <ReturnRow key={item.id} item={item} />) ?? [];
  const stockRows = data?.stock?.items.map(item => <StockRow key={item.id} item={item} />) ?? [];
  const fullRows = breakdown === 'sales' ? salesRows : breakdown === 'returns' ? returnRows : data?.stock?.items.map(item => <StockRow key={item.id} item={item} full />) ?? [];
  return <div className="dscreen reports-screen periodic-summary">
    <ScreenTitle title="Resumen periódico" back={back} desktop={null} navigation={navigation} />
    {owner ? <div className="wchips nav-tabs report-mail-tabs" role="tablist" aria-label="Resumen y envío">
      <button type="button" className={`sg${!mailTab ? ' on' : ''}`} role="tab" aria-selected={!mailTab} onClick={() => selectTab(false)}>Resumen</button>
      <button type="button" className={`sg${mailTab ? ' on' : ''}`} role="tab" aria-selected={mailTab} onClick={() => selectTab(true)}>Envío por mail</button>
    </div> : null}
    {mailTab && owner ? <ReportMailSettings key={appSession?.store?.id} /> : <>
    <div className="periodic-period-bar"><div className="periodic-picker" role="group" aria-label="Período del resumen">
      <button type="button" className={`sg${selection === 'latest-week' ? ' on' : ''}`} aria-pressed={selection === 'latest-week'} onClick={() => selectPeriod('latest-week')}>Última semana</button>
      <button type="button" className={`sg${selection === 'latest-half' ? ' on' : ''}`} aria-pressed={selection === 'latest-half'} onClick={() => selectPeriod('latest-half')}>Última quincena</button>
      <button type="button" className={`sg${selection === 'latest-month' ? ' on' : ''}`} aria-pressed={selection === 'latest-month'} onClick={() => selectPeriod('latest-month')}>Último mes</button>
      <div className={`periodic-previous${!selection.startsWith('latest-') ? ' selected' : ''}`}>
        <DeskSelect label="Períodos anteriores" value={selection.startsWith('latest-') ? '' : selection} placeholder={phone ? 'Anteriores' : 'Períodos anteriores'} disabled={!data} options={data ? [
          { value: 'weeks-heading', label: 'SEMANALES', disabled: true },
          ...(data.periods.weeks ?? []).map(period => ({ value: period.id, label: period.label })),
          { value: 'months-heading', label: 'MENSUALES', disabled: true },
          ...data.periods.months.map(period => ({ value: period.id, label: period.label })),
          { value: 'halves-heading', label: 'QUINCENALES', disabled: true },
          ...data.periods.halves.map(period => ({ value: period.id, label: period.label })),
        ] : []} onChange={selectPeriod} />
      </div>
    </div>{data ? <span className="periodic-period-date">{periodLabel}</span> : null}</div>
    {!current?.networkFailure && backendStatus !== 'offline' && (unavailable || (!ready && backendStatus !== 'checking')) ? <p className="periodic-note">Sin resumen para mostrar.</p> : null}
    {!data && !unavailable && (ready || backendStatus === 'checking') ? <ListSkeleton variant="cards" rows={3} testId="periodic-summary-loading" /> : null}
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
    {data && breakdown ? <Sheet className="periodic-breakdown hist-screen" mobileBack title={titles[breakdown]} onClose={() => setBreakdown(null)}><ul className="phone-rows periodic-list">{fullRows}</ul></Sheet> : null}
    </>}
  </div>;
}
