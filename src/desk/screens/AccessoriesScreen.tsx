import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { isAccessory, isLowStock, LOW_STOCK_THRESHOLD } from '../../lib/accessories';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { fetchAccessorySales, fetchArchivedInventory } from '../../services/inventory-api';
import { rememberArchivedProducts } from '../archive-cache';
import { useMoney } from '../exchange';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { TablePager, usePagedRows } from '../pager';
import { canSeeFinancials } from '../sections';
import { usePhoneLayout } from '../section-notices';
import { DeskIcon, MobileDock, ScreenTitle, SearchBox, useDesk } from '../ui';
import { useArchivedRows } from '../use-archived-rows';
import './accessories.css';

export function AccessoriesScreen() {
  const { inventory, sales, user, appSession, listsLoaded, listsLoadFailed } = useAppContext();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const money = useMoney();
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [retry, setRetry] = useState(0);
  const { rows: archivedRows, loading: loadingArchive } = useArchivedRows(inventory, fetchArchivedInventory, rememberArchivedProducts);
  const scope = JSON.stringify([user?.uid, appSession?.store?.id]);
  const [monthly, setMonthly] = useState<{ scope: string; sold: Record<string, number> } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user || !appSession?.store) return;
    let active = true;
    setError('');
    void fetchAccessorySales(user).then(data => { if (active) setMonthly({ scope, sold: data.sold }); })
      .catch(cause => { if (active) setError(getFriendlyErrorMessage(cause, 'No se pudieron cargar las ventas del mes')); });
    return () => { active = false; };
  }, [user, scope, inventory, sales, retry, appSession?.store?.id]);
  const sold = monthly?.scope === scope && !error ? monthly.sold : null;
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const items = useMemo(() => inventory.filter(item => isAccessory(item) && !item.archivedAt), [inventory]);
  const rows = (archived ? archivedRows.filter(isAccessory) : items).filter(item => [item.model, item.accessoryType, item.compatibleWith].join(' ').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')));
  const page = usePagedRows(rows, `${search}:${archived}`);
  const units = items.reduce((total, item) => total + (item.cantidad ?? 0), 0);
  const value = seeCosts && items.every(item => item.costValue != null) ? money.sum(items.map(item => ({ amount: item.costValue!, currency: item.currency }))) : null;
  const loading = listsAreLoading(listsLoaded);
  const add = () => open({ type: 'new-eq', kind: 'ACCESSORY' });
  const stock = (quantity: number) => <span className="accessory-stock"><b>{quantity} u.</b>{isLowStock(quantity) ? <span className="accessory-low">Poco stock</span> : null}</span>;
  return <div className="dscreen accessories-screen has-dock" data-testid="accessories-screen">
    <ScreenTitle title="Accesorios" back={back} tools={null} desktop={<><SearchBox value={search} onChange={setSearch} placeholder="Buscar accesorio o modelo" /><button type="button" className="dbtn p" onClick={add}>Registrar accesorio</button></>} />
    {phone ? <SearchBox value={search} onChange={setSearch} placeholder="Buscar accesorio o modelo" /> : null}
    <div className="accessory-kpis">
      <div className="dcard"><span>Unidades en stock</span><strong>{loading || listsLoadFailed ? '—' : units}</strong></div>
      {seeCosts ? <div className="dcard"><span>Valor al costo</span><strong data-ph-mask>{loading || listsLoadFailed || value == null ? '—' : money.showActive(value)}</strong></div> : null}
      <div className="dcard"><span>Vendidos este mes</span><strong>{sold ? Object.values(sold).reduce((total, count) => total + count, 0) : '—'}</strong></div>
      <div className="dcard"><span>Con poco stock</span><strong>{loading || listsLoadFailed ? '—' : items.filter(item => isLowStock(item.cantidad ?? 0)).length}</strong><small>menos de {LOW_STOCK_THRESHOLD} u.</small></div>
    </div>
    {error ? <p className="ferr" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p> : null}
    {listsLoadFailed ? <p className="ferr" role="alert">No se pudo cargar el inventario. Reintentá desde el aviso de conexión.</p> : null}
    <div className="gfilters"><button type="button" className={`gchip${archived ? ' on' : ''}`} aria-pressed={archived} onClick={() => setArchived(value => !value)}>Archivados</button></div>
    {loading || (archived && loadingArchive) ? <ListSkeleton variant="rows" rows={5} /> : <div className="dcard flush">
      <div className="accessory-list-title"><b>{archived ? 'Accesorios archivados' : 'Accesorios'}</b><span>{rows.length} {rows.length === 1 ? 'producto' : 'productos'}</span></div>
      {!rows.length ? <p className="wempty">{search ? 'No encontramos accesorios con esa búsqueda.' : archived ? 'No hay accesorios archivados.' : 'Todavía no cargaste accesorios.'}</p> : phone ? <div className="accessory-phone-list">{page.visible.map(item => <button type="button" className="accessory-phone-row" key={item.id} onClick={() => open({ type: 'eq', id: item.id })}>
        <b>{item.model}</b><span className="mut">{item.accessoryType} · {item.compatibleWith || 'Todos'}</span>
        {stock(item.cantidad ?? 0)}
        <span data-ph-mask>{seeCosts ? `Costo: ${item.cost == null ? '—' : money.show(item.cost, item.currency)} · ` : ''}Precio: {item.price == null ? 'A definir' : money.show(item.price, item.currency)}</span>
        <span className="mut">Vendidos del mes: {sold?.[item.id] ?? (sold ? 0 : '—')}</span>
      </button>)}</div> : <table className="dtable accessory-table"><thead><tr><th>Accesorio</th><th>Tipo</th><th>Compatible con</th><th>Stock</th>{seeCosts ? <th className="r">Costo</th> : null}<th className="r">Precio</th><th className="r">Vendidos (mes)</th></tr></thead><tbody>{page.visible.map(item => <tr key={item.id}>
        <td><button type="button" className="accessory-name" onClick={() => open({ type: 'eq', id: item.id })}><span className="ico-row"><DeskIcon name="list" size={18} /></span><b>{item.model}</b></button></td>
        <td>{item.accessoryType}</td><td>{item.compatibleWith || 'Todos'}</td><td>{stock(item.cantidad ?? 0)}</td>
        {seeCosts ? <td className="r" data-ph-mask>{item.cost == null ? '—' : money.show(item.cost, item.currency)}</td> : null}
        <td className="r" data-ph-mask>{item.price == null ? 'A definir' : money.show(item.price, item.currency)}</td><td className="r">{sold?.[item.id] ?? (sold ? 0 : '—')}</td>
      </tr>)}</tbody></table>}
      <TablePager {...page} onPage={page.setPage} />
    </div>}
    <MobileDock primary="Registrar accesorio" onPrimary={add} />
  </div>;
}
