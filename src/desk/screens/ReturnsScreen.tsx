import { RotateCcw } from 'lucide-react';
import { ReplayValue } from '../replay-privacy';
import { ImanagerIcon } from '../icons';
import { isNetworkErrorMessage } from '../../lib/user-message';
import { rememberArchivedReturns } from '../archive-cache';
import { useArchivedRows } from '../use-archived-rows';
import { useAppContext } from '../../context/AppContext';
import { fetchReturns, type ReturnCaseView } from '../../services/returns-api';
import { formatMoney, formatShortDate, isVoidRow, mergeRecordRows } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { MobileDock, Pill, PressTarget, ScreenTitle, useDesk } from '../ui';
import { useNavigationState } from '../route-viewport';

function moneyOf(row: ReturnCaseView) {
  if (isVoidRow(row)) return '—';
  if (!row.moneyAmount) return row.status === 'ABIERTO' || row.status === 'EN_DIAGNOSTICO' ? 'Sin resolver' : 'Sin plata';
  return formatMoney(row.moneyAmount, row.moneyCurrency === 'USD' ? 'USD' : 'ARS');
}

const loadArchived = (user: Parameters<typeof fetchReturns>[0]) => fetchReturns(user, true);

export function ReturnsScreen() {
  const { returns, returnsError } = useAppContext();
  const { open, back } = useDesk();
  const [filter, setFilter] = useNavigationState('returns:filter', 'Todos');
  const archived = filter === 'Archivados';
  const { rows: archivedRows, loading } = useArchivedRows(returns, loadArchived, rememberArchivedReturns);
  const activeRows = returns;
  const rows = archived ? (loading ? null : archivedRows) : activeRows == null ? null : filter === 'Activos' ? activeRows.filter(row => !isVoidRow(row)) : mergeRecordRows(activeRows, archivedRows);
  const error = archived ? '' : returnsError;
  const empty = rows?.length === 0 && !error;
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-return' })}><ImanagerIcon name="agregar" size={20} />Nuevo reclamo</button>;

  return (
    <div className="dscreen returns-screen" data-testid="returns-screen">
      <ScreenTitle title="Devoluciones" back={back} tools={null} desktop={empty ? null : add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          {['Todos', 'Activos', 'Archivados'].map(value => <button key={value} className={`gchip${filter === value ? ' on' : ''}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
      </div>
      {error && !isNetworkErrorMessage(error) ? <p className="ferr" role="alert">{error}</p> : null}
      {rows == null ? <ListSkeleton variant="cards" rows={4} testId="returns-loading" /> : null}
      {empty ? (
        <div className="ret-empty" data-testid="returns-empty">
          <RotateCcw size={24} strokeWidth={1.75} aria-hidden="true" />
          <h2>{archived ? 'Sin reclamos archivados' : filter === 'Activos' ? 'Sin reclamos activos' : 'Sin reclamos'}</h2>
          <p>{archived ? 'Los reclamos que archives van a aparecer acá.' : filter === 'Activos' ? 'Los reclamos en curso van a aparecer acá.' : 'Registrá una devolución o abrí el reclamo desde una venta.'}</p>
          <button className="btn2 p" type="button" onClick={() => open({ type: 'new-return' })}>
            <ImanagerIcon name="agregar" size={20} />Nuevo reclamo
          </button>
        </div>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="card ledger-list" data-testid="returns-list">
          {rows.map((row) => (
            <PressTarget as="button" key={row.id} className={`member return-row${isVoidRow(row) ? ' is-void' : row.status === 'RESUELTO' ? ' is-resolved' : ''}`} testId={`return-${row.id}`} onActivate={() => open({ type: 'return', id: row.id })} onMenu={isVoidRow(row) ? undefined : point => open({ type: 'ctx', kind: 'return', id: row.id, label: `${row.code} · ${row.clientName || 'Sin cliente'}`, ...point })}>
              <span className="ico-row"><ImanagerIcon name="canje" size={20} /></span>
              <span className="info">
                <span className="name">{row.code} · <ReplayValue>{row.clientName || 'Sin cliente'}</ReplayValue></span>
                <span className="role"><ReplayValue>{[row.deviceLabel, row.imei ? `IMEI ${row.imei}` : ''].filter(Boolean).join(' · ') || 'Sin equipo'}</ReplayValue> · {formatShortDate(row.openedOn)}</span>
              </span>
              <span className="rtxt">{moneyOf(row)}</span>
              <Pill status={isVoidRow(row) ? 'ANULADO' : row.rmaStatus || row.status} />
            </PressTarget>
          ))}
        </div>
      ) : null}
      {!empty ? <MobileDock primary="Nuevo reclamo" onPrimary={() => open({ type: 'new-return' })} /> : null}
    </div>
  );
}
