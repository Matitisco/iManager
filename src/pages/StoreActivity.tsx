import { toUserMessage, isNetworkErrorMessage } from '../lib/user-message';
import { ListSkeleton } from '../desk/list-skeleton';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePhoneLayout } from '../lib/phone-layout';
import { formatArDateTime } from '../lib/ar-date';
import { ApiError } from '../services/api-client';
import { fetchStoreActivity, fetchAdminAccess, fetchFunnel, fetchStoreTimeline } from '../services/admin-activity-api';
import { isTestStore, sortStoreActivity, stageLabel, type ActivitySort, type StoreActivityRange, type StoreActivityResponse, type StoreActivityRow } from '../lib/store-activity';
import { PANEL_STEPS, METHOD_LABELS, stuckLabel, percent, medianDuration, groupTimeline, timelineMilestones, type EventIcon, type FunnelResponse, type TimelineResponse } from '../lib/admin-panel';
import '../desk/desk.css';
import './store-activity.css';

type Load = { status: 'loading' | 'ready' | 'missing' } | { status: 'error'; message: string };
const BASE = '/admin/actividad';
const countLabel = (count: number) => count.toLocaleString('es-AR');
const when = (value: string | null) => value ? formatArDateTime(value) : '—';

// The approved panel uses the same compact outline icons as the existing desk UI.
function activeDaysLabel(days: number) {
  return days === 1 ? '1 día activo' : `${days.toLocaleString('es-AR')} días activos`;
}

function PanelIcon({ name }: { name: EventIcon }) {
  const paths: Record<EventIcon, ReactNode> = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    store: <path d="M4 10h16l-1-5H5zM5 10v10h14V10" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
    box: <><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7" /></>,
    cart: <><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9.5" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
    send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    flag: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
    skip: <path d="M5 5l10 7-10 7zM19 5v14" />,
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function StuckChip({ step, prefix = false }: { step: string | null | undefined; prefix?: boolean }) {
  return <span className={`chip${step == null ? ' ok' : ''}`}>{prefix && step != null ? 'Se frenó en ' : ''}{stuckLabel(step)}</span>;
}
function ActivityCard({ store, open }: { store: StoreActivityRow; open: () => void }) {
  return <article className="ticket activity-card" data-testid={`activity-card-${store.id}`} role="link" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open(); }} aria-label={`Ver recorrido de ${store.name}`}>
    <div className="store">{store.name}</div><div className="who">{store.ownerEmail ?? 'Sin correo de dueño'}</div>
    <div className="activity-meta"><span>Etapa {stageLabel(store.onboardingStage)}</span><StuckChip step={store.stuckAt} /><span>{activeDaysLabel(store.activeDays30 ?? 0)}</span></div>
    <dl className="activity-stats">{([['Miembros', store.counts.storeMembers], ['Equipos', store.counts.inventoryItems], ['Ventas', store.counts.sales]] as const).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{countLabel(count)}</dd></div>)}</dl>
    <div className="activity-meta"><span>Alta {when(store.createdAt)}</span></div>
  </article>;
}
function ActivityTable({ stores, open }: { stores: StoreActivityRow[]; open: (id: string) => void }) {
  return <div className="dcard flush"><div className="dtable-scroll"><table className="dtable compact" data-testid="activity-table">
    <thead><tr>{['Tienda', 'Dueño', 'Alta', 'Etapa', 'Se frenó en', 'Días activos', 'Miembros', 'Equipos', 'Ventas', 'Clientes', 'Reparaciones', 'Última actividad'].map((label, i) => <th key={label} className={i >= 5 && i <= 10 ? 'r' : undefined}>{label}</th>)}</tr></thead>
    <tbody>{stores.map(store => <tr key={store.id} data-testid={`activity-row-${store.id}`} tabIndex={0} onClick={() => open(store.id)} onKeyDown={e => { if (e.key === 'Enter') open(store.id); }} aria-label={`Ver recorrido de ${store.name}`}>
      <td><b>{store.name}</b></td><td>{store.ownerEmail ?? '—'}</td><td>{when(store.createdAt)}</td><td>{stageLabel(store.onboardingStage)}</td><td><StuckChip step={store.stuckAt} /></td>
      {[store.activeDays30 ?? 0, store.counts.storeMembers, store.counts.inventoryItems, store.counts.sales, store.counts.clients, store.counts.repairOrders].map((n, i) => <td key={i} className="r">{countLabel(n)}</td>)}
      <td>{store.lastActivityAt ? when(store.lastActivityAt) : 'Sin actividad'}</td>
    </tr>)}</tbody>
  </table></div></div>;
}
function Funnel({ data, hidden }: { data: FunnelResponse; hidden: number }) {
  const rows = PANEL_STEPS.map(([id, label]) => ({ id, label, count: data.steps.find(s => s.id === id)?.count ?? 0 }));
  const start = rows[0].count;
  const drops = rows.map((row, i) => i ? Math.max(0, rows[i - 1].count - row.count) : 0);
  const largest = Math.max(...drops);
  const maxIndex = largest > 0 ? drops.indexOf(largest) : -1;
  const kpis: [EventIcon, string, number][] = [['user', 'Registros', start], ['box', 'Cargaron stock real', rows[4].count], ['cart', 'Hicieron su primera venta', rows[6].count], ['flag', 'Volvieron otro día', rows[11].count]];
  if (!rows.some(row => row.count)) return <div className="wempty">Todavía no hay datos de este período</div>;
  return <>
    <div className="fk">{kpis.map(([icon, label, count], i) => <div className="mini" key={label} data-testid={`funnel-kpi-${i}`}><div className="ico"><PanelIcon name={icon} /></div><div className="eyebrow">{label}</div><div className="val">{countLabel(count)}</div><div className="pct">{i === 0 ? `${countLabel(hidden)} ocultas de prueba` : `${percent(count, start)} % de los registros`}</div></div>)}</div>
    <div className="fgrid"><div className="dcard fn"><h3>Embudo</h3>{rows.map((row, i) => <Fragment key={row.id}>
      {i > 0 && <div className={`drop${i === maxIndex ? ' max' : ''}`}>{i === maxIndex ? <b>−{drops[i]} se frenaron acá · el mayor abandono</b> : drops[i] ? `−${drops[i]} se frenaron acá` : 'sin abandono'}</div>}
      <div className={`fs${i === maxIndex ? ' max' : ''}`} data-testid={`funnel-step-${row.id}`}><span className="l">{row.label}</span><span className="bar"><i style={{ width: `${Math.min(100, start ? row.count / start * 100 : 0)}%` }} /></span><span className="n">{countLabel(row.count)}<small>{percent(row.count, start)} %</small></span></div>
    </Fragment>)}</div>
    <div className="dcard"><h3>¿Cómo cargan el stock?</h3><table className="mt"><thead><tr><th>Método</th><th>Eligieron</th><th>Terminaron</th><th>Abandonaron</th></tr></thead><tbody>{data.stockMethods.filter(m => m.method !== 'go_inventory' || m.chosen > 0).map(m => <tr key={m.method}><td>{METHOD_LABELS[m.method]}</td><td>{countLabel(m.chosen)}</td><td>{m.method === 'skip' || m.method === 'go_inventory' ? '—' : countLabel(m.finishedOk)}</td><td className={m.abandoned > 0 && m.abandoned === Math.max(...data.stockMethods.map(s => s.abandoned)) ? 'method-abandoned' : undefined}>{m.method === 'skip' || m.method === 'go_inventory' ? '—' : countLabel(m.abandoned)}</td></tr>)}</tbody></table>
    <div className="med"><div>Del registro al nombre<b>{medianDuration(data.medianHours.signupToStore)}</b></div><div>Del nombre al stock real<b>{medianDuration(data.medianHours.storeToRealStock)}</b></div><div>A la primera venta<b>{medianDuration(data.medianHours.storeToFirstSale)}</b></div></div></div></div>
  </>;
}
function Timeline({ data, back }: { data: TimelineResponse; back: () => void }) {
  const { store, events } = data;
  const done = timelineMilestones(events);
  const next = PANEL_STEPS.find(([id]) => !done.has(id))?.[0];
  return <>
    <div className="tl-h"><a className="back" href={BASE} onClick={e => { e.preventDefault(); back(); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Actividad</a>
    <div className="whead timeline-head"><div><h1>{store.name}</h1><div className="tl-meta"><span>{store.ownerEmail ?? 'Sin correo de dueño'}</span><span>· Alta {when(store.createdAt)}</span><span className="tl-badges"><StuckChip step={store.stuckAt} prefix /><span className="chip">{activeDaysLabel(store.activeDays30 ?? 0)}</span></span></div></div></div></div>
    <div className="dcard timeline-journey"><h3>Recorrido</h3><div className="mf" aria-label="Hitos de la tienda">{PANEL_STEPS.map(([id, , label]) => <div key={id} className={done.has(id) ? 'on' : id === next ? 'stuck' : ''} aria-label={`${label}: ${done.has(id) ? 'completado' : id === next ? 'siguiente' : 'pendiente'}`}><span className="d">{done.has(id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}</span>{label}</div>)}</div></div>
    {!events.length && <div className="wempty">Esta tienda todavía no tiene eventos registrados. Los hitos de antes de hoy salen de sus datos.</div>}
    {groupTimeline(events).map(day => <section key={day.key} aria-label={day.label}><h3 className="day">{day.label}</h3><div className="dcard timeline-day">{day.entries.map(({ event, text, icon, negative, compact }, i) => <div key={`${event.at}-${i}`} className={`ev${negative ? ' neg' : ''}${compact ? ' compact' : ''}`}><span className="t">{formatArDateTime(event.at).slice(11)}</span><span className={`i${compact ? ' empty-icon' : ''}`}>{!compact && <PanelIcon name={icon} />}</span><span>{text}</span></div>)}</div></section>)}
  </>;
}

export function StoreActivityPage() {
  const { user } = useAppContext();
  const phone = usePhoneLayout();
  const [path, setPath] = useState(window.location.pathname);
  const [range, setRange] = useState<StoreActivityRange>('30d');
  const [sort, setSort] = useState<ActivitySort>('createdAt');
  const [hideTests, setHideTests] = useState(true);
  const [data, setData] = useState<StoreActivityResponse | null>(null);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [requestId, setRequestId] = useState(0);
  const timelineId = path.match(/\/tienda\/([^/]+)\/?$/)?.[1];
  const isFunnel = /\/embudo\/?$/.test(path);
  const navigate = (next: string) => { if (next !== path) { window.history.pushState(null, '', next); setPath(next); window.scrollTo?.(0, 0); } };
  useEffect(() => { const pop = () => setPath(window.location.pathname); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoad({ status: 'loading' });
    (async () => {
      const access = await fetchAdminAccess(user);
      if (!active) return;
      if (!access.isAdmin) { setData(null); setFunnel(null); setTimeline(null); setLoad({ status: 'missing' }); return; }
      if (timelineId) {
        const next = await fetchStoreTimeline(user, decodeURIComponent(timelineId));
        if (active) setTimeline(next);
      } else {
        const [stores, stats] = await Promise.all([fetchStoreActivity(user, range), isFunnel ? fetchFunnel(user, range, hideTests) : Promise.resolve(null)]);
        if (active) { setData(stores); setFunnel(stats); }
      }
      if (active) setLoad({ status: 'ready' });
    })().catch((error: unknown) => {
      if (!active) return;
      setData(null); setFunnel(null); setTimeline(null);
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) setLoad({ status: 'missing' });
      else setLoad({ status: 'error', message: toUserMessage(error, 'No pudimos cargar la actividad.') });
    });
    return () => { active = false; };
  }, [user, range, requestId, isFunnel, timelineId, hideTests]);

  let content: ReactNode;
  const missing = !user || load.status === 'missing';
  if (missing) content = <div className="activity-missing"><h1>No encontramos esta página</h1><p>El enlace no existe o ya no está disponible.</p><a className="dbtn p activity-home" href="/">Volver al inicio</a></div>;
  else if (load.status === 'error') content = isNetworkErrorMessage(load.message) ? null : <div className="activity-status" role="alert"><h1>No pudimos cargar esta página</h1><p>{load.message}</p><button type="button" className="dbtn p" onClick={() => setRequestId(n => n + 1)}>Reintentar</button></div>;
  else if (load.status !== 'ready') content = <ListSkeleton variant={phone ? "cards" : "rows"} rows={6} testId="activity-loading" />;
  else if (timelineId && timeline) content = <Timeline data={timeline} back={() => navigate(BASE)} />;
  else if (data) {
    const hidden = hideTests ? data.stores.filter(isTestStore).length : 0;
    const visible = sortStoreActivity(hideTests ? data.stores.filter(s => !isTestStore(s)) : data.stores, sort);
    content = <>
      <div className="whead"><div><h1>Actividad de tiendas</h1><div className="wsub">{range === 'all' ? 'Todas las tiendas' : `Creadas en los últimos ${range === '7d' ? 7 : 30} días`}{` · actualizado ${formatArDateTime(isFunnel && funnel ? funnel.generatedAt : data.generatedAt)}`}</div></div><a className="dbtn s activity-home" href="/">Ir a la tienda</a></div>
      <div className="tabs" aria-label="Vistas de actividad">{[false, true].map(f => <button type="button" key={String(f)} className={`wchip${isFunnel === f ? ' on' : ''}`} aria-pressed={isFunnel === f} onClick={() => navigate(f ? `${BASE}/embudo` : BASE)}>{f ? 'Embudo' : 'Tiendas'}</button>)}</div>
      <div className="activity-toolbar" role="toolbar" aria-label="Filtros de actividad">{(['7d', '30d', 'all'] as const).map(r => <button type="button" key={r} className={`wchip${range === r ? ' on' : ''}`} aria-pressed={range === r} onClick={() => setRange(r)}>{r === 'all' ? 'Todas' : r === '7d' ? '7 días' : '30 días'}</button>)}
      {!isFunnel && ([['createdAt', 'Por alta'], ['lastActivityAt', 'Por actividad']] as const).map(([id, label]) => <button key={id} type="button" className={`wchip${sort === id ? ' on' : ''}`} aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>)}
      <button type="button" className={`wchip${hideTests ? ' on' : ''}`} aria-pressed={hideTests} onClick={() => setHideTests(v => !v)}>Ocultar tiendas de prueba</button></div>
      {isFunnel && funnel ? <Funnel data={funnel} hidden={hidden} /> : <><p className="activity-note">{visible.length === 1 ? '1 tienda' : `${countLabel(visible.length)} tiendas`}{hidden ? ` · ocultamos ${hidden === 1 ? '1 tienda de prueba' : `${countLabel(hidden)} tiendas de prueba`}` : ''}</p>{!visible.length ? <div className="wempty">No hay tiendas para mostrar.</div> : phone ? <div className="activity-cards">{visible.map(store => <ActivityCard key={store.id} store={store} open={() => navigate(`${BASE}/tienda/${encodeURIComponent(store.id)}`)} />)}</div> : <ActivityTable stores={visible} open={id => navigate(`${BASE}/tienda/${encodeURIComponent(id)}`)} />}</>}
    </>;
  }
  return <div className="desk-app store-activity" data-testid={missing ? 'activity-not-found' : load.status === 'ready' ? 'activity-screen' : undefined}><main className="stage"><div className="dscreen">{content}</div></main></div>;
}
