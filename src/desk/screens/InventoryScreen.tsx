import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
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
import { priceListMessage } from '../price-list';
import { Actions, Battery, ChipRow, DeskCta, DeskIcon, ImportButton, MenuButton, Pill, PressTarget, SearchBox, Sheet, useDesk } from '../ui';

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
  const { inventory, appSession } = useAppContext();
  const catalogs = useCatalogs();
  const { open, toast } = useDesk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [columns, setColumns] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [sort, setSort] = useState('Recientes');
  const [listOpen, setListOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<string | null>(null);

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
      const haystack = `${item.model} ${item.capacity} ${item.color}`.toLowerCase();
      return matchesFilter && (!q || haystack.includes(q)) && matchesInventoryColumns(item, columns);
    });
    if (sort === 'Precio ↑') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'Precio ↓') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [inventory, query, filter, columns, sort]);
  const page = usePagedRows(rows, `${query}|${filter}|${columnFilterKey(columns)}|${sort}`);
  const priceMessage = priceListMessage(rows, appSession?.store?.name);

  const available = inventory.filter((item) => isInStock(item.status)).length;
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
                  <td className="r"><b>{formatMoney(item.price)}</b></td>
                  <td>{item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : '—'}</td>
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
    </div>
  );
}

function ColumnFilter({ label, open, onToggle, active, align = 'left', onClear, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  align?: 'left' | 'right';
  onClear: () => void;
  children: React.ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 248;
      const left = align === 'right'
        ? Math.max(8, rect.right - width)
        : Math.min(rect.left, window.innerWidth - width - 8);
      setPoint({ top: rect.bottom + 8, left });
    };
    const down = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.current?.contains(target) || popover.current?.contains(target)) return;
      onToggle();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggle();
    };
    place();
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [align, onToggle, open]);

  const host = document.querySelector('.desk-app') ?? document.body;
  return (
    <span className="thfil">
      <button ref={anchor} type="button" className={active ? 'on' : ''} aria-label={`Filtrar ${label}`} aria-expanded={open} aria-pressed={active} onClick={onToggle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" /></svg>
      </button>
      {open ? createPortal(
        <div ref={popover} className="thpop" role="dialog" aria-label={`Filtrar ${label}`} style={{ top: point.top, left: point.left }}>
          {children}
          {active ? <button className="clear" type="button" onClick={() => { onClear(); onToggle(); }}>Limpiar</button> : null}
        </div>,
        host,
      ) : null}
    </span>
  );
}
