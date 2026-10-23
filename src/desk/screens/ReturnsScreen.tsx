import { ImanagerIcon } from '../icons';
import { isNetworkErrorMessage } from '../../lib/user-message';
import { rememberArchivedReturns } from '../archive-cache';
import { useArchivedRows } from '../use-archived-rows';
import { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchReturns, type ReturnCaseView } from '../../services/returns-api';
import { formatMoney, formatShortDate, isVoidRow, mergeRecordRows } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { MobileDock, Pill, PressTarget, ScreenTitle, useDesk } from '../ui';
import { returnsView } from '../returns-navigation';
import { ReturnsPatterns } from './ReturnsPatterns';
import { useNavigationState } from '../route-viewport';

function moneyOf(row: ReturnCaseView) {
  if (isVoidRow(row)) return '—';
  if (!row.moneyAmount) return row.status === 'ABIERTO' || row.status === 'EN_DIAGNOSTICO' ? 'Sin resolver' : 'Sin plata';
  return formatMoney(row.moneyAmount, row.moneyCurrency === 'USD' ? 'USD' : 'ARS');
}

const loadArchived = (user: Parameters<typeof fetchReturns>[0]) => fetchReturns(user, true);

export function ReturnsScreen() {
  const { returns, returnsError, user, appSession } = useAppContext();
  const { open, back } = useDesk();
  const [filter, setFilter] = useNavigationState('returns:filter', 'Todos');
  const [view, setView] = useNavigationState('returns:view', () => returnsView(window.location.hash));
  useEffect(() => {
    const sync = () => setView(returnsView(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [setView]);
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}`;
  const archived = filter === 'Archivados';
  const { rows: archivedRows, loading } = useArchivedRows(returns, loadArchived, rememberArchivedReturns);
  const activeRows = returns;
  const rows = archived ? (loading ? null : archivedRows) : activeRows == null ? null : filter === 'Activos' ? activeRows.filter(row => !isVoidRow(row)) : mergeRecordRows(activeRows, archivedRows);
  const error = archived ? '' : returnsError;
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-return' })}><ImanagerIcon name="agregar" size={20} />Nuevo reclamo</button>;

  return (
    <div className="dscreen returns-screen" data-testid="returns-screen">
      <ScreenTitle title="Devoluciones" back={back} tools={null} desktop={add} />
      {view.patterns ? <div className="gfilters pat-filters">
        <div className="pat-by" role="group" aria-label="Agrupar">
          {([{ id: 'supplier', label: 'Proveedor' }, { id: 'purchase', label: 'Compra' }, { id: 'model', label: 'Modelo' }] as const).map(option => <button key={option.id} className={`gchip sm${view.groupBy === option.id ? ' on' : ''}`} type="button" aria-pressed={view.groupBy === option.id} onClick={() => setView({ patterns: true, groupBy: option.id, group: undefined })}>{option.label}</button>)}
        </div>
      </div> : null}
      {view.patterns ? <ReturnsPatterns key={scope} groupBy={view.groupBy} requestedGroup={view.group} /> : <>
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          {['Todos', 'Activos', 'Archivados'].map(value => <button key={value} className={`gchip${filter === value ? ' on' : ''}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
      </div>
      {error && !isNetworkErrorMessage(error) ? <p className="ferr" role="alert">{error}</p> : null}
      {rows == null ? <ListSkeleton variant="cards" rows={4} testId="returns-loading" /> : null}
      {rows && rows.length === 0 && !error ? (
        <div className="card team-empty" data-testid="returns-empty">
          <h2>{archived ? 'No hay reclamos archivados.' : 'Todavía no cargaste reclamos.'}</h2>
          <p>Cuando un cliente devuelve un equipo, abrí el reclamo desde acá o desde la venta.</p>
        </div>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="card ledger-list" data-testid="returns-list">
          {rows.map((row) => (
            <PressTarget as="button" key={row.id} className={`member return-row${isVoidRow(row) ? ' is-void' : row.status === 'RESUELTO' ? ' is-resolved' : ''}`} testId={`return-${row.id}`} onActivate={() => open({ type: 'return', id: row.id })} onMenu={isVoidRow(row) ? undefined : point => open({ type: 'ctx', kind: 'return', id: row.id, label: `${row.code} · ${row.clientName || 'Sin cliente'}`, ...point })}>
              <span className="ico-row"><ImanagerIcon name="canje" size={20} /></span>
              <span className="info">
                <span className="name">{row.code} · {row.clientName || 'Sin cliente'}</span>
                <span className="role">{[row.deviceLabel, row.imei ? `IMEI ${row.imei}` : ''].filter(Boolean).join(' · ') || 'Sin equipo'} · {formatShortDate(row.openedOn)}</span>
              </span>
              <span className="rtxt">{moneyOf(row)}</span>
              <Pill status={isVoidRow(row) ? 'ANULADO' : row.rmaStatus || row.status} />
            </PressTarget>
          ))}
        </div>
      ) : null}
      </>}
      {!view.patterns ? <MobileDock primary="Nuevo reclamo" onPrimary={() => open({ type: 'new-return' })} /> : null}
    </div>
  );
}
