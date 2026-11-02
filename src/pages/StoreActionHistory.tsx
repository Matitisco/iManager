import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatArDateTime } from '../lib/ar-date';
import { HISTORY_LABELS, type HistoryAction, type HistoryFilters, type HistoryType } from '../lib/store-history';
import { fetchStoreHistory } from '../services/admin-activity-api';
import { ApiError } from '../services/api-client';

/** Mounted only after the parent has checked admin access and loaded the store. */
export function StoreActionHistory({ storeId }: { storeId: string }) {
  const { user } = useAppContext();
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [actions, setActions] = useState<HistoryAction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  useEffect(() => {
    if (!user || invalidRange) return;
    let active = true;
    setLoading(true); setError(null);
    if (!filters.cursor) { setActions([]); setNextCursor(null); setWarning(null); }
    fetchStoreHistory(user, storeId, filters).then(page => {
      if (!active) return;
      setActions(previous => {
        const combined = [...(filters.cursor ? previous : []), ...page.actions];
        return combined.filter((a, i) => combined.findIndex(other => other.id === a.id) === i);
      });
      setNextCursor(page.nextCursor); setWarning(page.warning);
    }).catch((err: unknown) => {
      if (!active) return;
      const denied = err instanceof ApiError && [401, 403, 404].includes(err.status);
      if (denied) { setActions([]); setNextCursor(null); }
      setError(denied ? 'El historial ya no está disponible para esta cuenta.' : 'No pudimos cargar el historial. Reintentá en un rato.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, storeId, filters, revision, invalidRange]);
  const change = (key: 'type' | 'from' | 'to', value: string) => setFilters(previous => ({ ...previous, [key]: value || undefined, cursor: undefined }));
  return <section className="dcard action-history" aria-labelledby="action-history-title">
    <div className="history-heading"><div><h3 id="action-history-title">Historial de acciones</h3><p className="activity-note">Lo más reciente primero · hora de Buenos Aires</p></div>
      <button type="button" className="dbtn s" disabled={loading || invalidRange} onClick={() => { setFilters(f => ({ ...f, cursor: undefined })); setRevision(n => n + 1); }}>Actualizar</button>
    </div>
    <div className="history-filters">
      <label>Tipo de acción<select value={filters.type ?? ''} onChange={e => change('type', e.target.value as HistoryType)}><option value="">Todas las acciones</option>{Object.entries(HISTORY_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
      <label>Desde<input type="date" value={filters.from ?? ''} max={filters.to} onChange={e => change('from', e.target.value)} /></label>
      <label>Hasta<input type="date" value={filters.to ?? ''} min={filters.from} onChange={e => change('to', e.target.value)} /></label>
    </div>
    {invalidRange ? <p role="alert">La fecha Desde tiene que ser anterior o igual a Hasta.</p> : <>
      {warning && <p className="history-warning" role="status">{warning}</p>}
      {error && <p role="alert">{error} <button className="dbtn s" type="button" onClick={() => setRevision(n => n + 1)}>Reintentar historial</button></p>}
      {!actions.length && !loading && !error && <p className="activity-note">No hay acciones registradas para estos filtros.</p>}
      <ol className="history-list" aria-label="Acciones de la tienda" aria-busy={loading}>{actions.map(action => <li key={action.id}>
        <time dateTime={action.at}>{formatArDateTime(action.at)}</time>
        <div><b>{action.text}</b><div className="history-actor">{action.actor.name}{action.actor.role ? ` · ${action.actor.role}` : ''}</div></div>
      </li>)}</ol>
      {loading && <p className="activity-note" role="status">Cargando acciones…</p>}
      {nextCursor && !error && <button type="button" className="dbtn s" disabled={loading} onClick={() => setFilters(f => ({ ...f, cursor: nextCursor }))}>Cargar más acciones</button>}
    </>}
  </section>;
}
