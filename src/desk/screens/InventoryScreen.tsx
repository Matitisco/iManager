import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { catalogChoices, useCatalogs } from '../catalog';
import { conditionLabel, equipmentTitle, formatMoney, isInStock } from '../format';
import { TablePager, usePagedRows } from '../pager';
import { priceListMessage } from '../price-list';
import { Actions, Battery, ChipRow, DeskCta, DeskIcon, ImportButton, MenuButton, Pill, PressTarget, SearchBox, Sheet, useDesk } from '../ui';

const FILTERS = [
  { id: 'Todos', label: 'Todos' },
  { id: 'DISPONIBLE', label: 'Disponible' },
  { id: 'EN_REVISION', label: 'En revisión' },
  { id: 'VENDIDO', label: 'Vendido' },
];

export function InventoryScreen() {
  const { inventory, appSession } = useAppContext();
  const catalogs = useCatalogs();
  const { open, toast } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sort, setSort] = useState('Recientes');
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    const reset = () => setFilter('Todos');
    window.addEventListener('desk-eq-saved', reset);
    return () => window.removeEventListener('desk-eq-saved', reset);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = inventory.filter((item) => {
      const matchesFilter = filter === 'Todos' || (filter === 'DISPONIBLE' ? isInStock(item.status) : item.status === filter);
      const haystack = `${item.model} ${item.capacity} ${item.color}`.toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
    if (sort === 'Precio ↑') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'Precio ↓') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [inventory, query, filter, sort]);
  const page = usePagedRows(rows, `${query}|${filter}|${sort}`);
  const priceMessage = priceListMessage(rows, appSession?.store?.name);

  const available = inventory.filter((item) => isInStock(item.status)).length;
  const filters = useMemo(() => {
    const known = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', FILTERS.filter((item) => item.id !== 'Todos'));
    const extra = [...new Set(inventory.map((item) => item.status))].filter((status) => !known.some((item) => item.id === status));
    return [{ id: 'Todos', label: 'Todos' }, ...known, ...extra.map((id) => ({ id, label: id }))];
  }, [catalogs?.options, inventory]);

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Inventario</h1>
          <div className="dsub">{inventory.length} equipos · {available} disponibles</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar modelo o color" />
          <button className="dbtn s" type="button" onClick={() => setListOpen(true)} disabled={rows.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
            </svg>
            Lista de precios
          </button>
          <ImportButton onClick={() => open({ type: 'import', kind: 'inv' })} />
          <DeskCta onClick={() => open({ type: 'new-eq' })}>Registrar equipo</DeskCta>
        </div>
      </div>
      <div className="dbar">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <MenuButton label={sort} options={['Recientes', 'Precio ↑', 'Precio ↓']} value={sort} onChange={setSort} />
      </div>
      <div className="dcard flush">
        {rows.length === 0 ? <div className="wempty">No hay equipos con ese filtro.</div> : (
          <table className="dtable">
            <thead>
              <tr><th>Equipo</th><th>Condición</th><th>Batería</th><th className="r">Precio</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {page.visible.map((item) => (
                <PressTarget
                  key={item.id}
                  as="tr"
                  onActivate={() => open({ type: 'eq', id: item.id })}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), ...point })}
                >
                  <td>
                    <div className="dcell">
                      <div className="dthumb"><DeskIcon name="logo" size={22} /></div>
                      <div><b>{equipmentTitle(item.model, item.capacity)}</b><small>{item.color || '—'}</small></div>
                    </div>
                  </td>
                  <td>{conditionLabel(item.condition, item.grade)}</td>
                  <td>{item.batteryHealth ? <Battery value={item.batteryHealth} /> : '—'}</td>
                  <td className="r"><b>{formatMoney(item.price)}</b></td>
                  <td>{item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : '—'}</td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        )}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      <div className="dhint">Tip: mantené apretada una fila (o clic derecho) para editar o eliminar.</div>
      {listOpen ? (
        <Sheet
          title="Lista de precios"
          subtitle={`${rows.length} ${rows.length === 1 ? 'equipo' : 'equipos'} con el filtro actual. Copiá el mensaje y mandalo.`}
          onClose={() => setListOpen(false)}
        >
          <label className="fl">
            <span>Mensaje</span>
            <textarea className="plist" readOnly value={priceMessage} />
          </label>
          <Actions
            secondary="Cerrar"
            onSecondary={() => setListOpen(false)}
            primary="Copiar mensaje"
            onPrimary={() => {
              void navigator.clipboard.writeText(priceMessage).then(
                () => { toast('Mensaje copiado'); setListOpen(false); },
                () => toast('No se pudo copiar el mensaje'),
              );
            }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}
