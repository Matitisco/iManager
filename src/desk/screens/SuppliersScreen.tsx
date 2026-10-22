import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchSuppliers, type SupplierListItem } from '../../services/suppliers-api';
import { ListSkeleton } from '../list-skeleton';
import { financeDate } from '../finance-dates';
import './finance.css';
import { MobileDock, ScreenTitle, useDesk } from '../ui';

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
    <div className="dscreen finance-screen" data-testid="suppliers-screen">
      <ScreenTitle title="Proveedores" subtitle="A quién le comprás y qué equipos están vinculados." back={back} tools={null} desktop={add} />
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
          <div className="finance-supplier-head" aria-hidden="true"><span>Proveedor</span><span>Contacto</span><span>Equipos</span><span>Última compra</span></div>
          {rows.map((row) => (
            <button key={row.id} className="finance-supplier-row" type="button" data-testid={`supplier-${row.id}`} onClick={() => open({ type: 'supplier', id: row.id })}>
              <span><b>{row.name}</b></span>
              <span>{row.phone || row.email || 'Sin contacto registrado'}{row.phone && row.email ? <small>{row.email}</small> : null}</span>
              <span>{row.deviceCount} {row.deviceCount === 1 ? 'equipo' : 'equipos'}{row.problemCount ? <small>{row.problemCount} con problemas</small> : null}</span>
              <span className="finance-supplier-date">{row.lastPurchaseAt === undefined ? '—' : row.lastPurchaseAt ? `Última compra ${financeDate(row.lastPurchaseAt)}` : 'Sin compras registradas'}</span>
            </button>
          ))}
        </div>
      ) : null}
      <MobileDock primary="Nuevo proveedor" onPrimary={() => open({ type: 'new-supplier' })} />
    </div>
  );
}
