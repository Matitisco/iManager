import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchReturns, type ReturnCaseView } from '../../services/returns-api';
import { formatMoney, formatShortDate, statusLabel } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, Pill, ScreenTitle, useDesk } from '../ui';

function moneyOf(row: ReturnCaseView) {
  if (!row.moneyAmount) return row.status === 'ABIERTO' || row.status === 'EN_DIAGNOSTICO' ? 'Sin resolver' : 'Sin plata';
  return formatMoney(row.moneyAmount, row.moneyCurrency === 'USD' ? 'USD' : 'ARS');
}

export function ReturnsScreen() {
  const { returns, returnsError, user } = useAppContext();
  const { open, back } = useDesk();
  const [archived, setArchived] = useState(false);
  const [archivedRows, setArchivedRows] = useState<ReturnCaseView[] | null>(null);
  const [archivedError, setArchivedError] = useState('');

  useEffect(() => {
    if (!archived || !user) return;
    let active = true;
    setArchivedRows(null);
    setArchivedError('');
    void fetchReturns(user, true).then((rows) => {
      if (active) setArchivedRows(rows);
    }).catch((cause: unknown) => {
      if (active) {
        setArchivedRows([]);
        setArchivedError(getFriendlyErrorMessage(cause, 'No se pudieron cargar los reclamos archivados.'));
      }
    });
    return () => { active = false; };
  }, [archived, user]);

  const rows = archived ? archivedRows : returns;
  const error = archived ? archivedError : returnsError;
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-return' })}>Nuevo reclamo</button>;

  return (
    <div className="dscreen" data-testid="returns-screen">
      <ScreenTitle title="Devoluciones" subtitle="Reclamos, notas de crédito y RMA con el proveedor." back={back} tools={null} desktop={add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          <button className={`gchip${!archived ? ' on' : ''}`} type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Activos</button>
          <button className={`gchip${archived ? ' on' : ''}`} type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archivados</button>
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
            <button key={row.id} className="member" type="button" data-testid={`return-${row.id}`} onClick={() => open({ type: 'return', id: row.id })}>
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
