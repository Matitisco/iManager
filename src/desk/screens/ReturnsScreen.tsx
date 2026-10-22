import { rememberArchivedReturns } from '../archive-cache';
import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchReturns, type ReturnCaseView } from '../../services/returns-api';
import { formatMoney, formatShortDate } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, Pill, PressTarget, ScreenTitle, useDesk } from '../ui';

function moneyOf(row: ReturnCaseView) {
  if (!row.moneyAmount && isVoidRow(row)) return '—';
  if (!row.moneyAmount) return row.status === 'ABIERTO' || row.status === 'EN_DIAGNOSTICO' ? 'Sin resolver' : 'Sin plata';
  return formatMoney(row.moneyAmount, row.moneyCurrency === 'USD' ? 'USD' : 'ARS');
}

const loadArchived = (user: Parameters<typeof fetchReturns>[0]) => fetchReturns(user, true);

export function ReturnsScreen() {
  const { returns, returnsError, user } = useAppContext();
  const { open, back } = useDesk();
  const [filter, setFilter] = useState('Todos');
  const archived = filter === 'Archivados';
  const { rows: archivedRows, loading } = useArchivedRows(returns, loadArchived, rememberArchivedReturns);
  const activeRows = returns;
  const rows = archived ? (loading ? null : archivedRows) : activeRows == null ? null : filter === 'Activos' ? activeRows.filter(row => !isVoidRow(row)) : mergeRecordRows(activeRows, archivedRows);
  const error = archived ? '' : returnsError;
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
            <PressTarget as="button" key={row.id} className={`member return-row${isVoidRow(row) ? ' is-void' : ''}`} testId={`return-${row.id}`} onActivate={() => open({ type: 'return', id: row.id })} onMenu={point => open({ type: 'ctx', kind: 'return', id: row.id, label: row.code, ...point })}>
              <span className="ico-row"><DeskIcon name="swap" size={18} /></span>
              <span className="info">
                <span className="name">{row.code} · {row.clientName || 'Sin cliente'}</span>
                <span className="role">{[row.deviceLabel, row.imei ? `IMEI ${row.imei}` : ''].filter(Boolean).join(' · ') || 'Sin equipo'} · {formatShortDate(row.openedOn)}</span>
              </span>
              <span className={`rtxt${isVoidRow(row) && row.moneyAmount ? ' void-money' : ''}`}>{moneyOf(row)}</span>
              <Pill status={isVoidRow(row) ? 'ANULADO' : row.rmaStatus || row.status} />
            </PressTarget>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo reclamo" onPrimary={() => open({ type: 'new-return' })} />
    </div>
  );
}
