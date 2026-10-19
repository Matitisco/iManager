import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchSuppliers, type SupplierListItem } from '../../services/suppliers-api';
import { ListSkeleton } from '../list-skeleton';
import { DeskIcon, MobileDock, ScreenTitle, useDesk } from '../ui';

export function SuppliersScreen() {
  const { suppliers, supplierError, user } = useAppContext();
  const { open, back } = useDesk();
  const [archived, setArchived] = useState(false);
  const [archivedRows, setArchivedRows] = useState<SupplierListItem[] | null>(null);
  const [archivedError, setArchivedError] = useState('');

  useEffect(() => {
    if (!archived || !user) return;
    let active = true;
    setArchivedRows(null);
    setArchivedError('');
    void fetchSuppliers(user, true).then((rows) => {
      if (active) setArchivedRows(rows);
    }).catch((cause: unknown) => {
      if (active) {
        setArchivedRows([]);
        setArchivedError(getFriendlyErrorMessage(cause, 'No se pudieron cargar los proveedores archivados.'));
      }
    });
    return () => { active = false; };
  }, [archived, user]);

  const rows = archived ? archivedRows : suppliers;
  const error = archived ? archivedError : supplierError;
  const add = <button className="dbtn p" type="button" onClick={() => open({ type: 'new-supplier' })}>Nuevo proveedor</button>;

  return (
    <div className="dscreen" data-testid="suppliers-screen">
      <ScreenTitle title="Proveedores" subtitle="De dónde vino cada equipo." back={back} tools={null} desktop={add} />
      <div className="gfilters">
        <div role="group" aria-label="Estado">
          <button className={`gchip${!archived ? ' on' : ''}`} type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Activos</button>
          <button className={`gchip${archived ? ' on' : ''}`} type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archivados</button>
        </div>
      </div>
      {error ? <p className="ferr" role="alert">{error}</p> : null}
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
            <button key={row.id} className="member" type="button" data-testid={`supplier-${row.id}`} onClick={() => open({ type: 'supplier', id: row.id })}>
              <span className="ico-row"><DeskIcon name="store" size={18} /></span>
              <span className="info">
                <span className="name">{row.name}</span>
                <span className="role">
                  {row.deviceCount} {row.deviceCount === 1 ? 'equipo' : 'equipos'}
                  {row.problemCount ? ` · ${row.problemCount} con problemas` : ''}
                </span>
              </span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo proveedor" onPrimary={() => open({ type: 'new-supplier' })} />
    </div>
  );
}
