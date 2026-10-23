import { isNetworkErrorMessage } from '../../lib/user-message';
import { useArchivedRows } from '../use-archived-rows';
import { formatShortDate, isVoidRow, mergeRecordRows } from '../format';
import { ImanagerIcon } from '../icons';
import '../overlays/supplier.css';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchSuppliers } from '../../services/suppliers-api';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, ScreenTitle, useDesk } from '../ui';

const loadArchived = (user: Parameters<typeof fetchSuppliers>[0]) => fetchSuppliers(user, true);

export function SuppliersScreen() {
  const { suppliers, supplierError } = useAppContext();
  const { open, back } = useDesk();
  const [filter, setFilter] = useState('Todos');
  const archived = filter === 'Archivados';
  const { rows: archivedRows, loading } = useArchivedRows(suppliers, loadArchived);
  const activeRows = suppliers;
  const rows = archived ? (loading ? null : archivedRows) : activeRows == null ? null : filter === 'Activos' ? activeRows : mergeRecordRows(activeRows, archivedRows);
  const error = archived ? '' : supplierError;
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-supplier' })}><span aria-hidden="true">＋</span>Nuevo proveedor</button>;

  return (
    <div className="dscreen" data-testid="suppliers-screen">
      <ScreenTitle title="Proveedores" back={back} tools={null} desktop={add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          {['Todos', 'Activos', 'Archivados'].map(value => <button key={value} className={`gchip${filter === value ? ' on' : ''}`} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
      </div>
      {error && !isNetworkErrorMessage(error) ? <p className="ferr" role="alert">{error}</p> : null}
      {rows == null ? <ListSkeleton variant="cards" rows={4} testId="suppliers-loading" /> : null}
      {rows && rows.length === 0 && !error ? (
        <div className="card team-empty" data-testid="suppliers-empty">
          <h2>{archived ? 'No hay proveedores archivados.' : 'Todavía no cargaste proveedores.'}</h2>
          <p>Cuando cargues uno, vas a poder registrar o subir el stock desde acá.</p>
        </div>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="card ledger-list" data-testid="suppliers-list">
          {rows.map((row) => (
            <button key={row.id} className={`member${isVoidRow(row) ? ' is-void' : ''}`} type="button" data-testid={`supplier-${row.id}`} onClick={() => open({ type: 'supplier', id: row.id })}>
              <span className="ico-row"><DeskIcon name="store" size={18} /></span>
              <span className="info">
                <span className="name">{row.name}</span>
                <span className="role">
                  {row.deviceCount} {row.deviceCount === 1 ? 'equipo' : 'equipos'}
                  {row.lastPurchasedAt ? ` · última compra ${formatShortDate(row.lastPurchasedAt).slice(0, 5)}` : ''}
                </span>
              </span>
              {row.problemCount > 0 ? <span className="sup-aside"><span className="spill lime" aria-label={`${row.problemCount} con problemas`}><ImanagerIcon name="en-revision" size={16} /><span>{row.problemCount}<span className="sup-pill-t"> con problemas</span></span></span></span> : null}
              <span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo proveedor" onPrimary={() => open({ type: 'new-supplier' })} />
    </div>
  );
}
