import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { formatArDateTime } from '../lib/ar-date';
import { fetchHistory, type HistoryEvent } from '../services/history-api';
import { historyAction, historyDetailRows } from './history-copy';
import { DeskIcon, Sheet } from './ui';
import { ListSkeleton } from './list-skeleton';

/** Keeps record tracking focused; the history owns its own layer and request lifetime. */
export function RecordHistoryButton({ entityType, entityId, label }: {
  entityType: 'inventory' | 'sale' | 'trade' | 'client' | 'repair'; entityId: string; label: string;
}) {
  const { user, appSession } = useAppContext();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className="btn2 s record-history-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <DeskIcon name="clock" size={16} />Historial
    </button>
    {open ? createPortal(<div className="record-history-layer">
      <RecordHistoryModal key={`${appSession?.store?.id}:${user?.uid}:${entityType}:${entityId}`} entityType={entityType} entityId={entityId} label={label} onClose={() => setOpen(false)} />
    </div>, trigger.current?.closest('.desk-app') ?? document.body) : null}
  </>;
}

function RecordHistoryModal({ entityType, entityId, label, onClose }: {
  entityType: string; entityId: string; label: string; onClose: () => void;
}) {
  const { user } = useAppContext();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setEvents([]);
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        if (!user) throw new Error('Iniciá sesión para ver el historial.');
        let cursor: string | undefined;
        do {
          const page = await fetchHistory(user, { entityType, entityId, limit: 50, ...(cursor ? { cursor } : {}) });
          if (!active) return;
          setEvents(current => [...current, ...page.events]);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el historial.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, entityType, entityId, attempt]);

  return <Sheet title="Historial" subtitle={label} className="record-history-sheet" onClose={onClose}>
    {events.length ? <ol className="record-history-timeline">
      {events.map(event => <li key={event.id}>
        <b>{historyAction(event) || event.title}</b>
        <p className="record-history-meta"><time dateTime={event.createdAt}>{formatArDateTime(event.createdAt)}</time> · {event.actorName || 'Sistema'}</p>
        {historyDetailRows(event).map((change, index) => <p className="record-history-change" key={`${change.label}-${index}`}>
          <span>{change.label}: </span>{change.before ? <>{change.before} <span aria-label="a">→</span> </> : null}{change.after || '—'}
        </p>)}
        {!historyDetailRows(event).length && event.detail?.trim() ? <p className="record-history-change">{event.detail}</p> : null}
        {event.reason ? <p className="record-history-change">{event.reason}</p> : null}
      </li>)}
    </ol> : null}
    {loading ? <ListSkeleton variant="cards" rows={3} testId="record-history-loading" /> : null}
    {error ? <div className="ferr" role="alert">{error}<button type="button" className="btn2 s" onClick={() => setAttempt(current => current + 1)}>Reintentar</button></div> : null}
    {!loading && !error && !events.length ? <p className="record-history-empty">Sin movimientos</p> : null}
  </Sheet>;
}
