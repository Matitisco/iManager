import { rememberArchivedReturns } from '../archive-cache';
import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchReturns, type ReturnCaseView } from '../../services/returns-api';
import { formatMoney, formatShortDate, statusLabel } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, Pill, ScreenTitle, useDesk } from '../ui';

function moneyOf(row: ReturnCaseView) {
  if (!row.moneyAmount) return row.status === 'ABIERTO' || row.status === 'EN_DIAGNOSTICO' ? 'Sin resolver' : 'Sin plata';
  return formatMoney(row.moneyAmount, row.moneyCurrency === 'USD' ? 'USD' : 'ARS');
}

const loadArchived = (user: Parameters<typeof fetchReturns>[0]) => fetchReturns(user, true);

export function ReturnsScreen() {
  const { returns, returnsError, user } = useAppContext();
  const { open, back } = useDesk();
  const [filter, setFilter] = useState('Todos');
  const archived = filter === 'Archivados';
  const { rows: archivedRows, error: archivedError, loading } = useArchivedRows(returns, loadArchived, rememberArchivedReturns);
  const activeRows = returns;
  const rows = archived ? (loading ? null : archivedRows) : activeRows == null ? null : filter === 'Activos' ? activeRows : mergeRecordRows(activeRows, archivedRows);
  const error = archived ? archivedError : [ returnsError, filter === 'Todos' ? archivedError : '' ].filter(Boolean).join(' ');
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-return' })}>Nuevo reclamo</button>;

  return (
    <div className="dscreen" data-testid="returns-screen">
      <ScreenTitle title="Devoluciones" subtitle="Reclamos, notas de crédito y RMA con el proveedor." back={back} tools={null} desktop={add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          {['Todos', 'Activos', 'Archivados'].map(value => <button key={value} className={`gchip${filter === value ? ' on' : ''}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
      </div>
      {error ? <p className="ferr" role="alert">{error}</p> : null}
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
            <button key={row.id} className={`member${isVoidRow(row) ? ' is-void' : ''}`} type="button" data-testid={`return-${row.id}`} onClick={() => open({ type: 'return', id: row.id })}>
              <span className="ico-row"><DeskIcon name="swap" size={18} /></span>
              <span className="info">
                <span className="name">{row.code} · {row.clientName || 'Sin cliente'}</span>
                <span className="role">{[row.deviceLabel, row.imei ? `IMEI ${row.imei}` : ''].filter(Boolean).join(' · ') || 'Sin equipo'} · {formatShortDate(row.openedOn)}</span>
              </span>
              <span className="rtxt">{moneyOf(row)}</span>
              <Pill status={row.rmaStatus || row.status} />
            </button>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo reclamo" onPrimary={() => open({ type: 'new-return' })} />
    </div>
  );
}
