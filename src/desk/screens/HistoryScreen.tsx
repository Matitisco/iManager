import { maskReplayHistoryValue } from '../replay-privacy';
import { toUserMessage, isNetworkErrorMessage, toActionMessage } from '../../lib/user-message';
import { ListSkeleton } from '../list-skeleton';
import { DeskSelect } from '../select';
import { AuditDeviceIcon } from './audit-device-icon';
import './history.css';
import { isSectionHidden } from '../../config/hiddenSections';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ApiError } from '../../services/api-client';
import { fetchHistory, fetchHistoryActors, type HistoryActor, type HistoryEvent } from '../../services/history-api';
import { fetchArchivedClients } from '../../services/clients-api';
import { fetchArchivedInventory } from '../../services/inventory-api';
import { fetchArchivedRepairs } from '../../services/repairs-api';
import { fetchReturns } from '../../services/returns-api';
import { fetchStockCount, type ClosedStockCount, type StockCountLine } from '../../services/stock-counts-api';
import { rememberArchivedClients, rememberArchivedProducts, rememberArchivedRepairs, rememberArchivedReturns, rememberVoidedSales, rememberVoidedTrades } from '../archive-cache';
import { fetchVoidedSales } from '../../services/sales-api';
import { fetchVoidedTradeIns } from '../../services/trade-ins-api';
import { groupHistoryDays, historyDetailRows, historyRecord, historyRecordNote, historySentence } from '../history-copy';
import { formatArDateTime, formatArTime } from '../../lib/ar-date';
import { sectionAllowed } from '../nav';
import { initials } from '../format';
import { usePhoneLayout } from '../section-notices';
import { ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import { GroupTabs } from '../group-tabs';
import { NoSectionAccess } from './NoSectionAccess';

const PERIODS = [
  { id: '', label: 'Todo el historial' },
  { id: 'today', label: 'Hoy' },
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: 'month', label: 'Este mes' },
] as const;

const GROUPS = ['', 'Alta', 'Edición', 'Cambio de estado', 'Anulación/Archivo', 'Cobros', 'Equipo y permisos'];
const SECTIONS = [
  { id: '', label: 'Sección' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'sales', label: 'Ventas' },
  { id: 'clients', label: 'Clientes' },
  { id: 'tradeins', label: 'Canjes' },
  { id: 'service', label: 'Servicio' },
  { id: 'cash', label: 'Cajas' },
  { id: 'commissions', label: 'Comisiones' },
  { id: 'settings', label: 'Configuración' },
];

function FilterChip({ label, emptyLabel, value, onChange, options }: {
  label: string;
  emptyLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  const current = options.find((option) => option.id === value);
  return (
    <DeskSelect className="history-filter" triggerClassName={`history-chip${value ? ' filtered' : ''}`}
      label={label} value={value} onChange={onChange}
      displayValue={value && current ? current.label : <><span className="history-filter-desktop">{emptyLabel}</span><span className="history-filter-phone">{label}</span></>}
      options={[{ value: '', label: emptyLabel }, ...options.filter(option => option.id).map(option => ({ value: option.id, label: option.label }))]} />
  );
}

export function HistoryScreen() {
  const { user, appSession } = useAppContext();
  const desk = useDesk();
  const phone = usePhoneLayout();
  const [query, setQuery] = useState('');
  const [actorId, setActorId] = useState('');
  const [period, setPeriod] = useState('30');
  const [group, setGroup] = useState('');
  const [section, setSection] = useState('');
  const [actors, setActors] = useState<HistoryActor[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState('');
  const generation = useRef(0);
  const pagePending = useRef(false);
  const [forbidden, setForbidden] = useState(false);
  const [selected, setSelected] = useState<HistoryEvent | null>(null);

  const filters = useMemo(() => ({
    q: query.trim() || undefined,
    actorUserId: actorId || undefined,
    period: (period || undefined) as 'today' | '7' | '30' | 'month' | undefined,
    group: group || undefined,
    section: section || undefined,
  }), [query, actorId, period, group, section]);

  useEffect(() => {
    const request = ++generation.current;
    pagePending.current = false;
    setLoadingMore(false);
    setPageError('');
    setEvents([]);
    setCursor(null);
    setSelected(null);
    if (!user) return;
    let active = true;
    setLoading(true);
    setError('');
    setForbidden(false);
    fetchHistory(user, filters).then((page) => {
      if (!active) return;
      setEvents(page.events);
      setCursor(page.nextCursor);
    }).catch((err: unknown) => {
      if (!active) return;
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(toUserMessage(err, 'No se pudo cargar el historial'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (generation.current === request) generation.current++; };
  }, [user, appSession?.store?.id, filters, attempt]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setActors([]);
    fetchHistoryActors(user).then((body) => { if (active) setActors(body.actors); }).catch(() => { if (active) setActors([]); });
    return () => { active = false; };
  }, [user, appSession?.store?.id]);

  const groups = groupHistoryDays(events);
  const filtered = Boolean(query.trim() || actorId || period !== '30' || group || section);
  const loadMore = async () => {
    if (!user || !cursor || pagePending.current) return;
    const request = generation.current;
    pagePending.current = true;
    setLoadingMore(true);
    setPageError('');
    try {
      const page = await fetchHistory(user, { ...filters, cursor });
      if (generation.current !== request) return;
      setEvents(current => [...new Map([...current, ...page.events].map(event => [event.id, event])).values()]);
      setCursor(page.nextCursor);
    } catch (err) {
      if (generation.current === request) setPageError(toUserMessage(err, 'No se pudieron cargar más movimientos'));
    } finally {
      if (generation.current === request) { pagePending.current = false; setLoadingMore(false); }
    }
  };

  if (forbidden) {
    return <NoSectionAccess section="Historial" ownerName={appSession?.store?.ownerDisplayName || 'el propietario'} onDashboard={() => desk.go('dashboard')} />;
  }

  return <div className="dscreen history-screen" data-testid="history-screen">
    <ScreenTitle title="Historial" navigation={<GroupTabs showPending={false} />} desktop={<SearchBox value={query} onChange={setQuery} placeholder="Buscar equipo, cliente o IMEI" />} />
    <div className="dbar history-filters">
      {phone ? <SearchBox value={query} onChange={setQuery} placeholder="Buscar" /> : null}
      <FilterChip label="Persona" emptyLabel="Todas las personas" value={actorId} onChange={setActorId} options={actors.map((actor) => ({ id: actor.userId, label: `${actor.name}${actor.removed ? ' (salió)' : ''}` }))} />
      <FilterChip label="Período" emptyLabel="Todo el historial" value={period} onChange={setPeriod} options={PERIODS.filter((item) => item.id).map((item) => ({ id: item.id, label: item.label }))} />
      <FilterChip label="Acción" emptyLabel="Todas las acciones" value={group} onChange={setGroup} options={GROUPS.filter(Boolean).map((item) => ({ id: item, label: item }))} />
      <FilterChip label="Sección" emptyLabel="Todas las secciones" value={section} onChange={setSection} options={SECTIONS.filter((item) => item.id && !isSectionHidden(item.id)).map((item) => ({ id: item.id, label: item.label }))} />
    </div>
    {loading ? <ListSkeleton variant={phone ? "cards" : "rows"} testId="history-loading" /> : null}
    {error && !isNetworkErrorMessage(error) ? <div className="ferr" role="alert">{error}<button className="dbtn s" type="button" onClick={() => setAttempt(current => current + 1)}>Reintentar</button></div> : null}
    {!loading && !error && events.length === 0 ? <div className="inv-empty-box" data-testid="history-empty">
      <b>{filtered ? 'Nada con esos filtros' : 'Todavía no hay movimientos'}</b>
      <p>{filtered ? 'Probá con otra persona, período o sección.' : 'Cuando el equipo registre, edite o archive, va a aparecer acá.'}</p>
      {filtered ? <button className="dbtn s" type="button" onClick={() => { setQuery(''); setActorId(''); setPeriod('30'); setGroup(''); setSection(''); }}>Limpiar filtros</button> : null}
    </div> : null}
    {!loading && !error ? groups.map((day) => <section className="history-day" key={day.key} aria-label={day.label}>
      <div className="history-day-heading"><b>{day.label.replace(/ 20\d{2}$/, match => day.key.startsWith(String(new Date().getFullYear())) ? '' : match)}</b><span aria-label={`${day.rows.length} ${day.rows.length === 1 ? 'movimiento' : 'movimientos'}`}>{day.rows.length}</span></div>
      <div className="history-list">
        <div className="history-columns" aria-hidden="true"><span>Persona</span><span>Acción</span><span>Registro</span><span>Hora</span><span /></div>
        {day.rows.map((event) => {
          const record = historyRecord(event);
          return <button key={event.id} type="button" className="history-row" data-entity={event.entityType} aria-label={`${event.actorName || 'Alguien'} · ${event.title} · ${record.title} · ${formatArTime(event.createdAt)}`} title={historySentence(event)} onClick={() => setSelected(event)}>
            <span className="history-person"><HistoryAvatar name={event.actorName} /><b>{event.actorName || 'Alguien'}</b></span>
            <span data-ph-mask={event.entityType === 'client' || undefined} className="history-action">{event.title}</span>
            <span className="history-record"><b data-ph-mask={event.entityType === 'client' || undefined}>{phone ? `${record.title} · ${event.actorName?.trim().split(/\s+/)[0] || 'Alguien'}` : record.title}</b><span className="history-record-meta">{record.identifier || event.entitySubtitle ? <span data-ph-mask>{record.identifier || event.entitySubtitle}</span> : null}</span></span>
            <time className="history-time" dateTime={event.createdAt}>{formatArTime(event.createdAt)}</time>
            <svg className="history-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>;
        })}
      </div>
    </section>) : null}
    {pageError && !isNetworkErrorMessage(pageError) ? <div className="ferr" role="alert">{pageError}</div> : null}
    {loadingMore ? <ListSkeleton variant={phone ? 'cards' : 'rows'} rows={2} testId="history-more-loading" /> : null}
    {!loading && !error && cursor ? <button className="dbtn s history-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>Cargar más</button> : null}
    {selected ? <HistoryDetail key={selected.id} event={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function HistoryAvatar({ name }: { name: string }) {
  let hash = 0;
  for (const character of name || 'S') hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const tone = ['p', 'b', 'g'][hash % 3];
  return <span className={`av-c ${name === 'Sistema' ? 'k' : tone}`} aria-hidden="true">{initials(name || 'S')}</span>;
}

function HistoryStockDevices({ lines, label }: { lines: StockCountLine[]; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const measure = () => {
    const node = scrollRef.current;
    if (node) setMoreBelow(node.scrollHeight - node.clientHeight - node.scrollTop > 1);
  };
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.firstElementChild) observer?.observe(node.firstElementChild);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [lines]);

  return <div className={`history-stock-devices${moreBelow ? ' more-below' : ''}`}>
    <div className="history-stock-scroll" ref={scrollRef} onScroll={measure} role="region" aria-label={`Equipos: ${label}`} tabIndex={0}>
      <ul>{lines.map(line => <li key={line.key}>
        <span className="history-device-icon" aria-hidden="true"><AuditDeviceIcon /></span>
        <div><b>{[line.model, line.capacity].filter(Boolean).join(' · ') || 'Sin modelo'}</b><small data-ph-mask>{line.imei}</small></div>
      </li>)}</ul>
    </div>
  </div>;
}

function HistoryDetail({ event, onClose }: { event: HistoryEvent; onClose: () => void }) {
  const desk = useDesk();
  const { user, appSession } = useAppContext();
  const phone = usePhoneLayout();
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [closed, setClosed] = useState<ClosedStockCount | null>(null);
  const [bucket, setBucket] = useState<keyof ClosedStockCount['buckets']>('missing');
  const when = formatArDateTime(event.createdAt);
  const day = when.slice(0, 10);
  const relativeDay = day === formatArDateTime(new Date()).slice(0, 10) ? 'Hoy'
    : day === formatArDateTime(new Date(Date.now() - 86400000)).slice(0, 10) ? 'Ayer' : day;
  const stockCount = event.entityType === 'stockcount' && event.action === 'stockcount.closed';
  const countFields = [
    { field: 'matched', label: 'Coinciden' },
    { field: 'missing', label: 'Sin escanear' },
    { field: 'surplus', label: 'Sin cargar' },
    { field: 'sold', label: 'Figuran vendidos' },
  ] as const;
  const counts = stockCount ? countFields.flatMap(group => {
    const change = event.changes.find(change => change.field === group.field && change.after?.trim());
    return change ? [{ ...group, value: change.after }] : [];
  }) : [];
  const rows = historyDetailRows({ ...event, changes: event.changes.filter(change =>
    !counts.some(count => count.field === change.field)
    && !(counts.length && (change.field === 'counters' || change.field === 'when')),
  ) }).map(change => ({
    ...change,
    hasBefore: Boolean(change.before?.trim() && change.before.trim() !== '—'),
  }));
  const hasBefore = rows.some(change => change.hasBefore);
  const canReadControl = stockCount && !!user && !!event.entityId
    && sectionAllowed('stockCount', appSession?.membership?.sections, appSession?.membership?.role);
  useEffect(() => {
    let active = true;
    setClosed(null);
    setBucket('missing');
    if (canReadControl && user) {
      fetchStockCount(user, event.entityId).then(count => {
        if (active && count?.status === 'CLOSED' && count.buckets) setClosed(count);
      }).catch(() => {
        // Optional read-only detail: keep the event counters if unavailable.
      });
    }
    return () => { active = false; };
  }, [user, appSession?.store?.id, canReadControl, event.entityId]);
  const lines = closed?.buckets[bucket] ?? [];
  const groupLabel = countFields.find(group => group.field === bucket)?.label || 'Sin escanear';
  const canOpenControl = canReadControl && !event.legacy && event.recordState === 'active';
  const note = canOpenControl ? null : historyRecordNote(event);
  const record = historyRecord(event);
  const destinations = { inventory: 'inventory', sale: 'sales', trade: 'tradeins', client: 'clients', repair: 'service', supplier: 'suppliers', expense: 'expenses', return: 'returns' } as const;
  const tab = destinations[event.entityType as keyof typeof destinations];
  const canOpen = canOpenControl || (!note && !!user && !!event.entityId && !!tab && sectionAllowed(tab, appSession?.membership?.sections, appSession?.membership?.role));
  const openRecord = async () => {
    if (!canOpen || opening) return;
    if (canOpenControl) { onClose(); desk.go('stockCount'); return; }
    setOpening(true);
    setOpenError('');
    const open = () => {
      onClose();
      desk.openRecord(tab, event.entityId);
    };
    if (event.recordState !== 'archived' && event.recordState !== 'voided') {
      open();
      return;
    }
    const load = event.entityType === 'inventory' ? fetchArchivedInventory(user).then(rememberArchivedProducts)
      : event.entityType === 'client' ? fetchArchivedClients(user).then(rememberArchivedClients)
        : event.entityType === 'repair' ? fetchArchivedRepairs(user).then(rememberArchivedRepairs)
          : event.entityType === 'sale' ? fetchVoidedSales(user).then(rememberVoidedSales)
            : event.entityType === 'trade' ? fetchVoidedTradeIns(user).then(rememberVoidedTrades)
              : event.entityType === 'return' ? fetchReturns(user, true).then(rememberArchivedReturns)
              : Promise.resolve();
    try { await load; open(); }
    catch (err) { setOpenError(toActionMessage(err, 'No se pudo abrir el registro')); }
    finally { setOpening(false); }
  };
  return <Sheet variant="detail" className={`history-detail${lines.length ? ' history-detail-stock' : ''}`} title={event.title} maskTitle={event.entityType === 'client'} onClose={onClose} busy={opening} footer={phone && !canOpen ? null : <div className="sheet-detail-actions">
    {!phone ? <button className="btn2 s" type="button" disabled={opening} onClick={onClose}>Cerrar</button> : null}
    {canOpen ? <button className="btn2 p" type="button" disabled={opening} onClick={() => void openRecord()}>
      {canOpenControl ? 'Ver control' : event.recordState === 'archived' ? 'Ver en archivados' : event.entityType === 'inventory' ? 'Ver equipo' : 'Ver registro'}
    </button> : null}
  </div>}>
    <div className="history-detail-person"><HistoryAvatar name={event.actorName} /><b>{event.actorName || 'Alguien'}</b><time dateTime={event.createdAt}>{relativeDay} · {formatArTime(event.createdAt)}</time></div>
    {!stockCount ? <div className="history-detail-record">{event.entityType === 'inventory' ? <span className="history-device-icon" aria-hidden="true"><AuditDeviceIcon /></span> : null}<div><b data-ph-mask={event.entityType === 'client' || undefined}>{record.title}</b>{record.identifier || event.entitySubtitle ? <p data-ph-mask>{record.identifier || event.entitySubtitle}</p> : null}</div></div> : null}
    {counts.length ? <div className="history-detail-counts" role="group" aria-label="Resultado del control">{counts.map(count => <button key={count.field} type="button" className={count.field === bucket ? 'on' : undefined} aria-label={`${count.label} ${count.value}`} aria-pressed={count.field === bucket} onClick={() => setBucket(count.field)}><b>{count.value}</b><span>{count.label}</span></button>)}</div> : null}
    {lines.length ? <HistoryStockDevices key={bucket} lines={lines} label={groupLabel} /> : null}
    {rows.length ? <table className={`history-diff${hasBefore ? ' comparison' : ' values'}${rows.length === 1 && rows[0].hasBefore && /precio/i.test(rows[0].label) ? ' single' : ''}`}>{hasBefore ? <thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead> : null}<tbody>
      {rows.map((change, index) => <tr key={`${change.label}-${index}`} className={change.hasBefore ? undefined : 'history-diff-after-only'}>
        <th scope="row">{change.label}</th>
        {change.hasBefore ? <td><span className="history-diff-label" aria-hidden="true">Antes</span><span data-ph-mask={maskReplayHistoryValue(change.label, event.entityType)} className="history-diff-before">{change.before}</span></td> : null}
        <td colSpan={!change.hasBefore && hasBefore ? 2 : 1}>{change.hasBefore ? <span className="history-diff-label" aria-hidden="true">Después</span> : null}<b data-ph-mask={maskReplayHistoryValue(change.label, event.entityType)}>{change.after ?? '—'}</b></td>
      </tr>)}
    </tbody></table> : !counts.length && event.detail?.trim() ? <p className="history-plain-detail">{event.detail}</p> : null}
    {event.reason?.trim() ? <p className="history-reason"><b>Motivo</b> {event.reason}</p> : null}
    {note ? <p className="history-missing">{note}</p> : null}
    {openError && !isNetworkErrorMessage(openError) ? <div className="ferr" role="alert">{openError}</div> : null}
  </Sheet>;
}
