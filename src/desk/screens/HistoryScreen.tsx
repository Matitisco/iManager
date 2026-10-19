import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ApiError } from '../../services/api-client';
import { fetchHistory, fetchHistoryActors, type HistoryActor, type HistoryEvent } from '../../services/history-api';
import { fetchArchivedClients } from '../../services/clients-api';
import { fetchArchivedInventory } from '../../services/inventory-api';
import { fetchArchivedRepairs } from '../../services/repairs-api';
import { rememberArchivedClients, rememberArchivedProducts, rememberArchivedRepairs, rememberVoidedSales, rememberVoidedTrades } from '../archive-cache';
import { fetchVoidedSales } from '../../services/sales-api';
import { fetchVoidedTradeIns } from '../../services/trade-ins-api';
import { historyAction, historyDetailRows, historyRecordNote, historySentence } from '../history-copy';
import { formatArDateTime, formatArTime } from '../../lib/ar-date';
import { avatarTone, initials } from '../format';
import { usePhoneLayout } from '../section-notices';
import { ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import { NoSectionAccess } from './NoSectionAccess';
import type { Overlay } from '../types';

const PERIODS = [
  { id: '', label: 'Período' },
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

function dayKey(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((start.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
}

function clock(iso: string) {
  return formatArTime(iso);
}

function FilterChip({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  const current = options.find((option) => option.id === value);
  return (
    <label className={`gchip history-chip${value ? ' on' : ''}`}>
      <span>{value && current ? current.label : label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todas</option>
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
  const [period, setPeriod] = useState('');
  const [group, setGroup] = useState('');
  const [section, setSection] = useState('');
  const [actors, setActors] = useState<HistoryActor[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    return () => { active = false; };
  }, [user, filters]);

  useEffect(() => {
    if (!user) return;
    fetchHistoryActors(user).then((body) => setActors(body.actors)).catch(() => setActors([]));
  }, [user]);

  const groups = events.reduce<Array<{ label: string; rows: HistoryEvent[] }>>((list, event) => {
    const label = dayKey(event.createdAt);
    const current = list.at(-1);
    if (current?.label === label) current.rows.push(event);
    else list.push({ label, rows: [event] });
    return list;
  }, []);
  const filtered = Boolean(query.trim() || actorId || period || group || section);

  if (forbidden) {
    return <NoSectionAccess section="Historial" ownerName={appSession?.store?.ownerDisplayName || 'el propietario'} onDashboard={() => desk.go('dashboard')} />;
  }

  return <div className="dscreen history-screen" data-testid="history-screen">
    <ScreenTitle title="Historial" subtitle="Quién hizo qué y cuándo" back={desk.back} desktop={<SearchBox value={query} onChange={setQuery} placeholder="Buscar equipo, cliente o número" />} />
    {phone ? <SearchBox value={query} onChange={setQuery} placeholder="Buscar" /> : null}
    <div className="dbar history-filters">
      <FilterChip label="Persona" value={actorId} onChange={setActorId} options={actors.map((actor) => ({ id: actor.userId, label: `${actor.name}${actor.removed ? ' (salió)' : ''}` }))} />
      <FilterChip label="Período" value={period} onChange={setPeriod} options={PERIODS.filter((item) => item.id).map((item) => ({ id: item.id, label: item.label }))} />
      <FilterChip label="Tipo" value={group} onChange={setGroup} options={GROUPS.filter(Boolean).map((item) => ({ id: item, label: item }))} />
      <FilterChip label="Sección" value={section} onChange={setSection} options={SECTIONS.filter((item) => item.id).map((item) => ({ id: item.id, label: item.label }))} />
    </div>
    {loading ? <div className="card history-skeleton" data-testid="history-loading">Cargando historial…</div> : null}
    {error ? <div className="ferr" role="alert">{error}<button className="dbtn s" type="button" onClick={() => setPeriod((current) => current)}>Reintentar</button></div> : null}
    {!loading && !error && events.length === 0 ? <div className="card empty" data-testid="history-empty">
      <b>{filtered ? 'Nada con esos filtros' : 'Todavía no hay movimientos'}</b>
      <p>{filtered ? 'Probá con otra persona, período o sección.' : 'Cuando el equipo registre, edite o archive, va a aparecer acá.'}</p>
      {filtered ? <button className="dbtn s" type="button" onClick={() => { setQuery(''); setActorId(''); setPeriod(''); setGroup(''); setSection(''); }}>Limpiar filtros</button> : null}
    </div> : null}
    {groups.map((day) => <section key={day.label}>
      <div className="sale-sec"><span>{day.label.toUpperCase()}</span><span>{day.rows.length} {day.rows.length === 1 ? 'movimiento' : 'movimientos'}</span></div>
      <div className="card history-list">
        {day.rows.map((event) => <button key={event.id} type="button" className="history-row" title={historySentence(event)} onClick={() => setSelected(event)}>
          <span className={`av-c ${event.actorName === 'Sistema' ? 'k' : avatarTone(event.actorName || 'S')}`}>{initials(event.actorName || 'S')}</span>
          <span className="info"><b>{event.actorName || 'Alguien'}</b> {historyAction(event)}</span>
          <span className="spill mid">{event.sectionLabel}</span>
          <span className="mut">{clock(event.createdAt)}</span>
          <svg className="history-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>)}
      </div>
    </section>)}
    {cursor ? <button className="dbtn s" type="button" onClick={() => {
      if (!user || !cursor) return;
      void fetchHistory(user, { ...filters, cursor }).then((page) => {
        setEvents((current) => [...current, ...page.events]);
        setCursor(page.nextCursor);
      });
    }}>Cargar más</button> : null}
    {selected ? <HistoryDetail event={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function HistoryDetail({ event, onClose }: { event: HistoryEvent; onClose: () => void }) {
  const desk = useDesk();
  const { user } = useAppContext();
  const when = formatArDateTime(event.createdAt);
  const rows = historyDetailRows(event);
  const note = historyRecordNote(event);
  const openRecord = () => {
    const tab = event.section === 'tradeins' ? 'tradeins' : event.section === 'service' ? 'service' : event.section === 'sales' ? 'sales' : event.section === 'clients' ? 'clients' : event.section === 'inventory' ? 'inventory' : null;
    if (!tab || !user || event.recordState === 'gone' || event.legacy) return;
    const open = () => {
      desk.go(tab);
      const kind = event.entityType === 'inventory' ? 'eq' : event.entityType === 'sale' ? 'sale' : event.entityType === 'trade' ? 'cj' : event.entityType === 'client' ? 'cl' : event.entityType === 'repair' ? 'ot' : null;
      if (kind) desk.open({ type: kind, id: event.entityId } as Overlay);
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
              : Promise.resolve();
    void load.then(open).catch(open);
  };
  return <Sheet className="history-detail" title={event.title} subtitle={event.entityLabel ?? undefined} onClose={onClose} footer={note ? undefined : (
    <button className="btn2 p" type="button" onClick={openRecord}>
      {event.recordState === 'archived' ? 'Ver en archivados' : 'Ver registro'}
    </button>
  )}>
    <p className="eqs-note">{event.actorName}{event.actorRoleLabel ? ` · ${event.actorRoleLabel}` : ''} · {when}</p>
    {rows.length ? <table className="dtable history-diff"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>
      {rows.map((change, index) => <tr key={`${change.label}-${index}`}><td>{change.label}</td><td>{change.before || '—'}</td><td>{change.after || '—'}</td></tr>)}
    </tbody></table> : null}
    {event.reason ? <p><b>Motivo</b> {event.reason}</p> : null}
    {note ? <p className="history-missing">{note}</p> : null}
  </Sheet>;
}

export function RecordHistory({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { user } = useAppContext();
  const desk = useDesk();
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(!phone);
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  useEffect(() => {
    if (!user || !open) return;
    let active = true;
    fetchHistory(user, { entityType, entityId, limit: 5 }).then((page) => { if (active) setEvents(page.events); }).catch(() => { if (active) setEvents([]); });
    return () => { active = false; };
  }, [user, entityType, entityId, open]);
  return <div className="record-history">
    <button type="button" className="wlink" onClick={() => setOpen((current) => !current)}>{open ? 'Ocultar historial' : 'Ver historial'}</button>
    {open && events ? <ul>{events.length ? events.map((event) => <li key={event.id}>{historySentence(event)} · {clock(event.createdAt)}</li>) : <li>Sin movimientos recientes</li>}</ul> : null}
    {open ? <button type="button" className="wlink" onClick={() => { desk.close(); desk.go('history'); }}>Ver todo</button> : null}
  </div>;
}
