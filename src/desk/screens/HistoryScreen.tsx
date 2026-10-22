import { ListSkeleton } from '../list-skeleton';
import { isSectionHidden } from '../../config/hiddenSections';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ApiError } from '../../services/api-client';
import { fetchHistory, fetchHistoryActors, type HistoryActor, type HistoryEvent } from '../../services/history-api';
import { fetchArchivedClients } from '../../services/clients-api';
import { fetchArchivedInventory } from '../../services/inventory-api';
import { fetchArchivedRepairs } from '../../services/repairs-api';
import { fetchReturns } from '../../services/returns-api';
import { rememberArchivedClients, rememberArchivedProducts, rememberArchivedRepairs, rememberArchivedReturns, rememberVoidedSales, rememberVoidedTrades } from '../archive-cache';
import { fetchVoidedSales } from '../../services/sales-api';
import { fetchVoidedTradeIns } from '../../services/trade-ins-api';
import { groupHistoryDays, historyDetailRows, historyRecord, historyRecordNote, historySentence } from '../history-copy';
import { formatArDateTime, formatArTime } from '../../lib/ar-date';
import { sectionAllowed } from '../nav';
import { avatarTone, initials } from '../format';
import { usePhoneLayout } from '../section-notices';
import { ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
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
    <label className={`gchip history-chip${value ? ' on' : ''}`}>
      <span>{value && current ? current.label : <><span className="history-filter-desktop">{emptyLabel}</span><span className="history-filter-phone">{label}</span></>}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.filter((option) => option.id).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
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
      else setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
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
      if (generation.current === request) setPageError(err instanceof Error ? err.message : 'No se pudieron cargar más movimientos');
    } finally {
      if (generation.current === request) { pagePending.current = false; setLoadingMore(false); }
    }
  };

  if (forbidden) {
    return <NoSectionAccess section="Historial" ownerName={appSession?.store?.ownerDisplayName || 'el propietario'} onDashboard={() => desk.go('dashboard')} />;
  }

  return <div className="dscreen history-screen" data-testid="history-screen">
    <ScreenTitle title="Historial" desktop={<SearchBox value={query} onChange={setQuery} placeholder="Buscar equipo, cliente o IMEI" />} />
    {phone ? <SearchBox value={query} onChange={setQuery} placeholder="Buscar equipo, cliente o IMEI" /> : null}
    <div className="dbar history-filters">
      <FilterChip label="Persona" emptyLabel="Todas las personas" value={actorId} onChange={setActorId} options={actors.map((actor) => ({ id: actor.userId, label: `${actor.name}${actor.removed ? ' (salió)' : ''}` }))} />
      <FilterChip label="Período" emptyLabel="Todo el historial" value={period} onChange={setPeriod} options={PERIODS.filter((item) => item.id).map((item) => ({ id: item.id, label: item.label }))} />
      <FilterChip label="Acción" emptyLabel="Todas las acciones" value={group} onChange={setGroup} options={GROUPS.filter(Boolean).map((item) => ({ id: item, label: item }))} />
      <FilterChip label="Sección" emptyLabel="Todas las secciones" value={section} onChange={setSection} options={SECTIONS.filter((item) => item.id && !isSectionHidden(item.id)).map((item) => ({ id: item.id, label: item.label }))} />
    </div>
    {loading ? <ListSkeleton variant={phone ? "cards" : "rows"} testId="history-loading" /> : null}
    {error ? <div className="ferr" role="alert">{error}<button className="dbtn s" type="button" onClick={() => setAttempt(current => current + 1)}>Reintentar</button></div> : null}
    {!loading && !error && events.length === 0 ? <div className="inv-empty-box" data-testid="history-empty">
      <b>{filtered ? 'Nada con esos filtros' : 'Todavía no hay movimientos'}</b>
      <p>{filtered ? 'Probá con otra persona, período o sección.' : 'Cuando el equipo registre, edite o archive, va a aparecer acá.'}</p>
      {filtered ? <button className="dbtn s" type="button" onClick={() => { setQuery(''); setActorId(''); setPeriod('30'); setGroup(''); setSection(''); }}>Limpiar filtros</button> : null}
    </div> : null}
    {!loading && !error ? groups.map((day) => <section className="history-day" key={day.key} aria-label={day.label}>
      <div className="sale-sec"><span>{day.label.toUpperCase()}</span><span>{day.rows.length} {day.rows.length === 1 ? 'movimiento' : 'movimientos'}</span></div>
      <div className="card history-list">
        <div className="history-columns" aria-hidden="true"><span>Persona</span><span>Acción</span><span>Registro</span><span>Hora</span><span /></div>
        {day.rows.map((event) => {
          const record = historyRecord(event);
          return <button key={event.id} type="button" className="history-row" data-entity={event.entityType} aria-label={`${event.actorName || 'Alguien'} · ${event.title} · ${record.title} · ${formatArTime(event.createdAt)}`} title={historySentence(event)} onClick={() => setSelected(event)}>
            <span className="history-person"><HistoryAvatar name={event.actorName} /><b>{event.actorName || 'Alguien'}</b><time className="history-phone-time" dateTime={event.createdAt}> · {formatArTime(event.createdAt)}</time></span>
            <span className="history-action">{event.title}</span>
            <span className={`history-record${!record.identifier && !event.entitySubtitle ? ' history-record-inline' : ''}`}><b>{record.title}</b><span className="history-record-meta">{record.identifier || event.entitySubtitle ? <span>{record.identifier || event.entitySubtitle}</span> : null}<span className="history-section">{event.sectionLabel}</span></span></span>
            <time className="history-time" dateTime={event.createdAt}>{formatArTime(event.createdAt)}</time>
            <svg className="history-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>;
        })}
      </div>
    </section>) : null}
    {pageError ? <div className="ferr" role="alert">{pageError}</div> : null}
    {loadingMore ? <ListSkeleton variant={phone ? 'cards' : 'rows'} rows={2} testId="history-more-loading" /> : null}
    {!loading && !error && cursor ? <button className="dbtn s history-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>Cargar más</button> : null}
    {selected ? <HistoryDetail event={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function HistoryAvatar({ name }: { name: string }) {
  return <span className={`av-c ${name === 'Sistema' ? 'k' : avatarTone(name || 'S')}`} aria-hidden="true">{initials(name || 'S')}</span>;
}

function HistoryDetail({ event, onClose }: { event: HistoryEvent; onClose: () => void }) {
  const desk = useDesk();
  const { user, appSession } = useAppContext();
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const when = formatArDateTime(event.createdAt);
  const rows = historyDetailRows(event);
  const note = historyRecordNote(event);
  const record = historyRecord(event);
  const destinations = { inventory: 'inventory', sale: 'sales', trade: 'tradeins', client: 'clients', repair: 'service', supplier: 'suppliers', expense: 'expenses', return: 'returns' } as const;
  const tab = destinations[event.entityType as keyof typeof destinations];
  const canOpen = !note && !!user && !!event.entityId && !!tab && sectionAllowed(tab, appSession?.membership?.sections, appSession?.membership?.role);
  const openRecord = async () => {
    if (!canOpen || opening) return;
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
    catch (err) { setOpenError(err instanceof Error ? err.message : 'No se pudo abrir el registro'); }
    finally { setOpening(false); }
  };
  return <Sheet className="history-detail" title={event.title} titleAccessory={<span className="history-section history-detail-section">{event.sectionLabel}</span>} onClose={onClose} busy={opening} footer={<div className="history-detail-actions">
    <button className="btn2 s" type="button" disabled={opening} onClick={onClose}>Cerrar</button>
    {canOpen ? <button className="btn2 p" type="button" disabled={opening} onClick={() => void openRecord()}>
      {event.recordState === 'archived' ? 'Ver en archivados' : event.entityType === 'inventory' ? 'Ver equipo' : 'Ver registro'}
    </button> : null}
  </div>}>
    <div className="history-detail-record"><b>{record.title}</b>{record.identifier || event.entitySubtitle ? <p>{record.identifier || event.entitySubtitle}</p> : null}</div>
    <div className="history-detail-person"><HistoryAvatar name={event.actorName} /><div><b>{event.actorName || 'Alguien'}</b><p>{event.actorRoleLabel ? `${event.actorRoleLabel} · ` : ''}<time dateTime={event.createdAt}>{when.replace(' ', ' · ')}</time></p></div></div>
    {rows.length ? <table className="history-diff"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>
      {rows.map((change, index) => <tr key={`${change.label}-${index}`}><th scope="row">{change.label}</th><td data-label="Antes">{change.before ?? '—'}</td><td data-label="Después">{change.after ?? '—'}</td></tr>)}
    </tbody></table> : event.detail?.trim() ? <p className="history-plain-detail">{event.detail}</p> : null}
    {event.reason?.trim() ? <p className="history-reason"><b>Motivo</b> {event.reason}</p> : null}
    {note ? <p className="history-missing">{note}</p> : null}
    {openError ? <div className="ferr" role="alert">{openError}</div> : null}
  </Sheet>;
}
