import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ColumnFilter } from '../ColumnFilter';
import { catalogChoices, useCatalogs } from '../catalog';
import { conditionLabel, equipmentTitle, formatInputMoney, formatMoney, isInStock, parseMoney } from '../format';
import {
  EMPTY_COLUMN_FILTERS,
  columnFilterActive,
  columnFilterKey,
  matchesInventoryColumns,
  type InventoryColumnFilters,
} from '../inventory-filters';
import { TablePager, usePagedRows } from '../pager';
import { needsRestock } from '../accessories';
import { priceListMessage } from '../price-list';
import { Actions, Battery, ChipRow, DeskCta, DeskIcon, ImportButton, MenuButton, Pill, PressTarget, SearchBox, Sheet, useDesk } from '../ui';
import { AccessoriesPanel } from './AccessoriesPanel';

const FILTERS = [
  { id: 'Todos', label: 'Todos' },
  { id: 'DISPONIBLE', label: 'Disponible' },
  { id: 'EN_REVISION', label: 'En revisión' },
  { id: 'VENDIDO', label: 'Vendido' },
];

const BATTERY_FILTERS = [
  { id: '', label: 'Todas' },
  { id: '90', label: '≥ 90%' },
  { id: '80', label: '≥ 80%' },
  { id: '70', label: '≥ 70%' },
] as const;

export function InventoryScreen() {
  const { inventory, accessories = [], appSession, operationDrafts = [], loadOperationDrafts } = useAppContext();
  const catalogs = useCatalogs();
  const { open, toast } = useDesk();
  const [stockTab, setStockTab] = useState<'equipos' | 'accesorios'>('equipos');
  const [query, setQuery] = useState('');
  const [accessoryQuery, setAccessoryQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [columns, setColumns] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [sort, setSort] = useState('Recientes');
  const [listOpen, setListOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  useEffect(() => {
    if (typeof loadOperationDrafts !== 'function') return;
    let active = true;
    loadOperationDrafts('inventory').catch((error: unknown) => {
      if (active) setDraftError(error instanceof Error ? error.message : 'No se pudieron cargar los borradores.');
    });
    return () => { active = false; };
  }, []);
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'inventory' && trade.confirmationStatus === 'PENDING');

  useEffect(() => {
    const reset = () => {
      setFilter('Todos');
      setColumns(EMPTY_COLUMN_FILTERS);
    };
    window.addEventListener('desk-eq-saved', reset);
    return () => window.removeEventListener('desk-eq-saved', reset);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = inventory.filter((item) => {
      const matchesFilter = filter === 'Todos' || (filter === 'DISPONIBLE' ? isInStock(item.status) : item.status === filter);
      const haystack = `${item.model} ${item.capacity} ${item.color} ${item.imei}`.toLowerCase();
      return matchesFilter && (!q || haystack.includes(q)) && matchesInventoryColumns(item, columns);
    });
    if (sort === 'Precio ↑') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'Precio ↓') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [inventory, query, filter, columns, sort]);
  const page = usePagedRows(rows, `${query}|${filter}|${columnFilterKey(columns)}|${sort}`);
  const priceMessage = priceListMessage(rows, appSession?.store?.name);

  const available = inventory.filter((item) => isInStock(item.status)).length;
  const lowAccessories = accessories.filter((item) => needsRestock(item)).length;
  const filters = useMemo(() => {
    const known = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', FILTERS.filter((item) => item.id !== 'Todos'));
    const extra = [...new Set(inventory.map((item) => item.status))].filter((status) => !known.some((item) => item.id === status));
    return [{ id: 'Todos', label: 'Todos' }, ...known, ...extra.map((id) => ({ id, label: id }))];
  }, [catalogs?.options, inventory]);
  const conditionOptions = useMemo(() => {
    const labels = [...new Set(inventory.map((item) => conditionLabel(item.condition, item.grade)))].filter((label) => label !== '—');
    const preferred = ['Nuevo', 'Usado', 'Pre-owned'];
    return labels.sort((left, right) => {
      const leftRank = preferred.indexOf(left);
      const rightRank = preferred.indexOf(right);
      if (leftRank !== -1 || rightRank !== -1) return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      return left.localeCompare(right, 'es');
    });
  }, [inventory]);
  const setColumn = (patch: Partial<InventoryColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Inventario</h1>
          <div className="dsub">{stockTab === 'accesorios' ? `${accessories.length} accesorios · ${lowAccessories} con stock bajo` : `${inventory.length} equipos · ${available} disponibles`}</div>
        </div>
        <div className="dright">
          <SearchBox value={stockTab === 'accesorios' ? accessoryQuery : query} onChange={stockTab === 'accesorios' ? setAccessoryQuery : setQuery} placeholder={stockTab === 'accesorios' ? 'Buscar accesorio, código o modelo' : 'Buscar modelo, color o IMEI'} />
          {stockTab === 'equipos' ? <button className="dbtn s" type="button" onClick={() => setListOpen(true)} disabled={rows.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
            </svg>
            Lista de precios
          </button> : null}
          <ImportButton onClick={() => stockTab === 'accesorios' ? toast('La importación de accesorios todavía no está disponible.') : open({ type: 'import', kind: 'inv' })} />
          {stockTab === 'accesorios'
            ? <DeskCta onClick={() => open({ type: 'new-acc' })}>Nuevo accesorio</DeskCta>
            : <DeskCta onClick={() => open({ type: 'new-eq' })}>Registrar equipo</DeskCta>}
        </div>
      </div>
      <div className="inv-tabs">
        <button className={`inv-tab${stockTab === 'equipos' ? ' on' : ''}`} type="button" onClick={() => setStockTab('equipos')}>Equipos <span className="n">{inventory.length}</span></button>
        <button className={`inv-tab${stockTab === 'accesorios' ? ' on' : ''}`} type="button" onClick={() => setStockTab('accesorios')}>Accesorios <span className="n">{accessories.length}</span></button>
      </div>
      {stockTab === 'accesorios' ? <AccessoriesPanel query={accessoryQuery} /> : null}
      {stockTab === 'equipos' ? <>
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className="dcard op-drafts">
          <div><b>Canjes pendientes de confirmar</b><small>Podés retomarlos para completar el cliente y la venta.</small></div>
          <div className="op-draft-list">{ownDrafts.map((trade) => (
            <button key={trade.id} type="button" onClick={() => open({ type: 'edit-cj', id: trade.id, source: 'inventory' })}>
              <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="dbar">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <MenuButton label={sort} options={['Recientes', 'Precio ↑', 'Precio ↓']} value={sort} onChange={setSort} />
      </div>
      <div className="dcard flush">
        <table className="dtable">
            <thead>
              <tr>
                <th>
                  <span className="thf">Equipo
                    <ColumnFilter label="equipo" open={openColumn === 'equipo'} onToggle={() => setOpenColumn((current) => current === 'equipo' ? null : 'equipo')} active={columnFilterActive(columns, 'equipo')} onClear={() => setColumn({ equipo: '' })}>
                      <input aria-label="Contiene" placeholder="Modelo, capacidad o color" value={columns.equipo} onChange={(event) => setColumn({ equipo: event.target.value })} />
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">Condición
                    <ColumnFilter label="condición" open={openColumn === 'condición'} onToggle={() => setOpenColumn((current) => current === 'condición' ? null : 'condición')} active={columnFilterActive(columns, 'conditions')} onClear={() => setColumn({ conditions: [] })}>
                      <div className="opts">
                        {conditionOptions.map((label) => (
                          <label key={label} className="chk">
                            <input
                              type="checkbox"
                              checked={columns.conditions.includes(label)}
                              onChange={(event) => setColumn({
                                conditions: event.target.checked
                                  ? [...columns.conditions, label]
                                  : columns.conditions.filter((item) => item !== label),
                              })}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">Batería
                    <ColumnFilter label="batería" open={openColumn === 'batería'} onToggle={() => setOpenColumn((current) => current === 'batería' ? null : 'batería')} active={columnFilterActive(columns, 'battery')} onClear={() => setColumn({ battery: '' })}>
                      <div className="opts">
                        {BATTERY_FILTERS.map((option) => (
                          <button key={option.label} className={`opt${columns.battery === option.id ? ' on' : ''}`} type="button" onClick={() => setColumn({ battery: option.id })}>{option.label}</button>
                        ))}
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th className="r">
                  <span className="thf">Precio
                    <ColumnFilter label="precio" align="right" open={openColumn === 'precio'} onToggle={() => setOpenColumn((current) => current === 'precio' ? null : 'precio')} active={columnFilterActive(columns, 'priceMin')} onClear={() => setColumn({ priceMin: '', priceMax: '' })}>
                      <div className="range">
                        <label><span>Mínimo</span><input aria-label="Mínimo" inputMode="numeric" value={columns.priceMin ? formatInputMoney(parseMoney(columns.priceMin)) : ''} onChange={(event) => setColumn({ priceMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                        <label><span>Máximo</span><input aria-label="Máximo" inputMode="numeric" value={columns.priceMax ? formatInputMoney(parseMoney(columns.priceMax)) : ''} onChange={(event) => setColumn({ priceMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">Estado
                    <ColumnFilter label="estado" align="right" open={openColumn === 'estado'} onToggle={() => setOpenColumn((current) => current === 'estado' ? null : 'estado')} active={filter !== 'Todos'} onClear={() => setFilter('Todos')}>
                      <div className="opts">
                        {filters.map((option) => (
                          <button key={option.id} className={`opt${filter === option.id ? ' on' : ''}`} type="button" onClick={() => setFilter(option.id)}>{option.label}</button>
                        ))}
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
              </tr>
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
                  <td className="r"><b>{item.price > 0 ? formatMoney(item.price) : '-'}</b></td>
                  <td>
                    {item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : '—'}
                    {item.pendingSaleRegistration ? <div className="pending-sale-cell"><small>Venta por registrar</small><button type="button" onClick={(event) => { event.stopPropagation(); open({ type: 'new-sale', productId: item.id, source: 'inventory' }); }}>Retomar</button></div> : null}
                  </td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        {rows.length === 0 ? <div className="wempty">No hay equipos con ese filtro.</div> : null}
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
      </> : null}
    </div>
  );
}
