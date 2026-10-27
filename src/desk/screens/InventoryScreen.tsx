import { ReplayValue } from '../replay-privacy';
import { DeskSelect } from '../select';
import { consumePriceToDefineFilter, PRICE_TO_DEFINE_EVENT } from '../price-to-define-filter';
import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useNavigationState } from '../route-viewport';
import { OnboardingInventorySummary } from '../getting-started';
import { BulkActions, useBulkScope } from '../bulk-actions';
import { SelectFiltered, useBulkSelection } from '../bulk-selection';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fetchArchivedInventory } from '../../services/inventory-api';
import { rememberArchivedProducts } from '../archive-cache';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, PhoneRecord, PhoneRecords } from '../section-notice-view';
import { ColumnFilter, MoneyFilterInput, MoneyRange, useColumnMenu } from '../ColumnFilter';
import { catalogChoices, useCatalogs } from '../catalog';
import { approxUsd, useDisplayQuote, useMoney, type MoneyApi } from '../exchange';
import { conditionLabel, conditionName, equipmentTitle, formatImei, formatShortDate, statusLabel } from '../format';
import { compareQuality, DEVICE_QUALITIES, displayQuality, qualityPhrase } from '../quality';
import {
  CONDITION_FILTERS,
  EMPTY_COLUMN_FILTERS,
  columnFilterActive,
  columnFilterKey,
  columnFiltersActive,
  compareInventoryColor,
  inventoryColorOptions,
  inventoryConditionOptions,
  searchInventoryColors,
  matchesInventoryColumns,
  type InventoryColumnFilters,
} from '../inventory-filters';
import { TablePager, usePagedRows } from '../pager';
import { useOperationDraftError } from '../operation-drafts';
import { PendingDrafts } from '../pending-drafts';
import { ImanagerIcon } from '../icons';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { Actions, Battery, ChipRow, DeskCta, DeskIcon, Field, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import type { Product } from '../../types';

function StatusMenu({ options, pressed, onToggle }: {
  options: { id: string; label: string }[];
  pressed: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  const chosen = options.filter((option) => option.id !== 'Todos' && pressed(option.id));
  const label = chosen.length === 0 ? 'Estado' : chosen.length === 1 ? chosen[0]!.label : `${chosen.length} estados`;
  return (
    <div className={`dsel menu-start${chosen.length ? ' on' : ''}`} ref={box} data-testid="inventory-status-filter">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? (
        <div className="menu" role="menu" aria-label="Estado">
          {options.map((option) => (
            <button key={option.id} type="button" role="menuitemcheckbox" aria-checked={pressed(option.id)} className={pressed(option.id) ? 'on' : ''} onClick={() => onToggle(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_FILTERS = [
  { id: 'DISPONIBLE', label: 'Disponible' },
  { id: 'EN_REVISION', label: 'En revisión' },
  { id: 'RESERVADO', label: 'Reservado' },
  { id: 'VENDIDO', label: 'Vendido' },
];

const BATTERY_FILTERS = [
  { id: '', label: 'Todas' },
  { id: '90', label: '≥ 90%' },
  { id: '80', label: '≥ 80%' },
  { id: '70', label: '≥ 70%' },
] as const;

function batteryLine(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '0' || trimmed === '0%') return '';
  return `Bat. ${trimmed.includes('%') ? trimmed : `${trimmed}%`}`;
}

function activeColumnCount(filters: InventoryColumnFilters) {
  return Number(filters.conditions.length > 0)
    + Number(filters.qualities.length > 0)
    + Number(filters.statuses.length > 0)
    + Number(filters.colors.length > 0)
    + Number(Boolean(filters.battery))
  + Number(Boolean(filters.priceToDefine || filters.priceMin.trim() || filters.priceMax.trim()))
  + Number(Boolean(filters.equipo.trim()))
  + Number(filters.needsCompletion)
  + Number(Boolean(filters.supplierId));
}

function withStatus(statuses: string[], id: string, checked: boolean) {
  if (checked) return statuses.includes(id) ? statuses : [...statuses, id];
  return statuses.filter((item) => item !== id);
}

export function InventoryScreen() {
  const { inventory, suppliers, deleteProduct, operationDrafts = [], listsLoaded } = useAppContext();
  const loadingLists = listsAreLoading(listsLoaded);
  const money = useMoney();
  const { sell } = useDisplayQuote();
  const catalogs = useCatalogs();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [searchOpen, setSearchOpen] = useNavigationState('Inventory.searchOpen', false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colorQuery, setColorQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const notices = useSectionNotices('inventory');
  const [query, setQuery] = useNavigationState('Inventory.query', '');
  const [columns, setColumns] = useNavigationState<InventoryColumnFilters>('Inventory.columns', EMPTY_COLUMN_FILTERS);
  const [sort, setSort] = useNavigationState('Inventory.sort', 'Recientes');
  const [archivedMode, setArchivedMode] = useNavigationState('Inventory.archivedMode', false);
  const { rows: archived } = useArchivedRows(inventory, fetchArchivedInventory, rememberArchivedProducts);
  const menu = useColumnMenu();
  const draftError = useOperationDraftError('inventory');
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'inventory' && trade.confirmationStatus === 'PENDING');

  useEffect(() => {
    const reset = () => {
      setColumns(EMPTY_COLUMN_FILTERS);
    };
    window.addEventListener('desk-eq-saved', reset);
    return () => window.removeEventListener('desk-eq-saved', reset);
  }, []);

  useEffect(() => {
    const show = () => { if (consumePriceToDefineFilter()) { setQuery(''); setArchivedMode(false); setColumns({ ...EMPTY_COLUMN_FILTERS, priceToDefine: true }); } };
    window.addEventListener(PRICE_TO_DEFINE_EVENT, show);
    show();
    return () => window.removeEventListener(PRICE_TO_DEFINE_EVENT, show);
  }, [setColumns, setQuery, setArchivedMode]);

  const source = archivedMode ? archived : mergeRecordRows(inventory, archived);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = source.filter((item) => {
      const haystack = `${item.model} ${item.capacity} ${item.color}${phone ? ` ${item.imei}` : ''}`.toLowerCase();
      return (archivedMode || columns.statuses.length === 0 || !isVoidRow(item)) && (!q || haystack.includes(q)) && matchesInventoryColumns(item, columns);
    });
    const priceOf = (item: { price: number | null; currency?: string | null }) => money.number(item.price ?? 0, item.currency) ?? item.price ?? 0;
    const qualityOf = (item: Product) => displayQuality(item.condition, item.grade);
    if (sort === 'Precio ↑') list = [...list].sort((a, b) => a.price == null ? (b.price == null ? 0 : 1) : b.price == null ? -1 : priceOf(a) - priceOf(b));
    if (sort === 'Precio ↓') list = [...list].sort((a, b) => a.price == null ? (b.price == null ? 0 : 1) : b.price == null ? -1 : priceOf(b) - priceOf(a));
    if (sort === 'Calidad ↑') list = [...list].sort((a, b) => compareQuality(qualityOf(a), qualityOf(b), 'best') || a.model.localeCompare(b.model, 'es'));
    if (sort === 'Calidad ↓') list = [...list].sort((a, b) => compareQuality(qualityOf(a), qualityOf(b), 'worst') || a.model.localeCompare(b.model, 'es'));
    if (sort === 'Color ↑') list = [...list].sort((a, b) => compareInventoryColor(a.color, b.color, 'asc') || a.model.localeCompare(b.model, 'es'));
    if (sort === 'Color ↓') list = [...list].sort((a, b) => compareInventoryColor(a.color, b.color, 'desc') || a.model.localeCompare(b.model, 'es'));
    return list;
  }, [source, query, columns, sort, money, phone, archivedMode]);
  const listed = sort === 'Recientes' ? notices.prioritize(rows) : rows;
  const page = usePagedRows(listed, `${query}|${columnFilterKey(columns)}|${sort}|${notices.key}`, undefined, 'Inventory');
  const scope = useBulkScope();
  const selection = useBulkSelection(listed, scope);

  const statusOptions = useMemo(() => {
    const known = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', STATUS_FILTERS);
    const extra = [...new Set(inventory.map((item) => item.status))].filter((status) => status && !known.some((item) => item.id === status));
    return [...known, ...extra.map((id) => ({ id, label: statusLabel(id) }))];
  }, [catalogs?.options, inventory]);
  const filters = useMemo(() => [{ id: 'Todos', label: 'Todos' }, ...statusOptions, { id: 'PARA_COMPLETAR', label: 'Para completar' }, { id: 'PRECIO_A_DEFINIR', label: 'Precio a definir' }], [statusOptions]);
  const conditionOptions = useMemo(
    () => inventoryConditionOptions(
      catalogChoices(catalogs?.options ?? [], 'INVENTORY_CONDITION', CONDITION_FILTERS),
      inventory.map((item) => item.condition),
    ),
    [catalogs?.options, inventory],
  );
  const colorOptions = useMemo(
    () => inventoryColorOptions(inventory.map((item) => item.color)),
    [inventory],
  );
  const visibleColorOptions = searchInventoryColors(colorOptions, colorQuery);
  const setColumn = (patch: Partial<InventoryColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const toggleStatus = (id: string) => setColumns((current) => {
    if (id === 'PRECIO_A_DEFINIR') return { ...current, priceToDefine: !current.priceToDefine, priceMin: '', priceMax: '' };
    if (id === 'PARA_COMPLETAR') return { ...current, needsCompletion: !current.needsCompletion };
    return {
      ...current,
      statuses: id === 'Todos' ? [] : withStatus(current.statuses, id, !current.statuses.includes(id)),
      needsCompletion: id === 'Todos' ? false : current.needsCompletion,
      priceToDefine: id === 'Todos' ? false : current.priceToDefine,
    };
  });
  const statusPressed = (id: string) => {
    if (id === 'PRECIO_A_DEFINIR') return Boolean(columns.priceToDefine);
    if (id === 'PARA_COMPLETAR') return columns.needsCompletion;
    if (id === 'Todos') return columns.statuses.length === 0 && !columns.needsCompletion && !columns.priceToDefine;
    return columns.statuses.includes(id);
  };
  const filterCount = activeColumnCount(columns);
  const clearColumns = () => setColumns(EMPTY_COLUMN_FILTERS);
  const quietEmpty = source.length === 0 && !query.trim() && !columnFiltersActive(columns);
  const openFilters = () => {
    setDraftFilters(columns);
    setColorQuery('');
    setFiltersOpen(true);
  };
  const showApprox = phone && sell != null && page.visible.some((item) => approxUsd(item.price, item.currency, money.active, sell));

  return (
    <div className={`dscreen mobile-list-screen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Inventario"
        back={back}
        tools={(
          <>
            <IconButton label="Buscar" name="buscar" pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} />
            <span className="rslot">
              <IconButton label="Filtros" name="filtrar" pressed={filterCount > 0} onClick={openFilters} />
              {filterCount > 0 ? <span className="rbadge">{filterCount}</span> : null}
            </span>
          </>
        )}
        desktop={(
          <div className="dright">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar modelo o color" />
            <ImportButton onClick={() => open({ type: 'import', kind: 'inv' })} />
            <button className="dbtn s" type="button" onClick={() => open({ type: 'batch-eq' })}>Carga en serie</button>
            <DeskCta onClick={() => open({ type: 'new-eq' })}>Registrar equipo</DeskCta>
          </div>
        )}
      />
      <OnboardingInventorySummary />
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por IMEI, modelo o color" /></div> : null}
      {phone ? <button className="dbtn s stock-entry" type="button" onClick={() => open({ type: 'batch-eq' })}>Carga en serie</button> : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      <PendingDrafts drafts={ownDrafts} hint="Podés retomarlos para completar el cliente y la venta." onOpen={(id) => open({ type: 'edit-cj', id, source: 'inventory' })} />
      <div className="dbar">
        {phone ? <StatusMenu options={filters} pressed={statusPressed} onToggle={toggleStatus} /> : <ChipRow options={filters} pressed={statusPressed} onToggle={toggleStatus} />}
        <button type="button" className={`wchip${archivedMode ? ' on' : ''}`} aria-pressed={archivedMode} onClick={() => setArchivedMode((current) => !current)}>Archivados</button>
        <MenuButton label={sort} options={['Recientes', 'Precio ↑', 'Precio ↓', 'Calidad ↑', 'Calidad ↓', 'Color ↑', 'Color ↓']} value={sort} onChange={setSort} />
      </div>
      <div className="inventory-selection-tools">
        <BulkActions key={scope} selection={selection} total={listed.length}
          label={(item) => equipmentTitle(item.model, item.capacity)}
          action={{ label: 'Archivar selección', explanation: 'Se archivarán los equipos seleccionados. Los equipos vinculados a operaciones activas no se pueden archivar. Podés restaurarlos desde Archivados.', execute: (item, reason) => deleteProduct(item.id, reason) }}
        />
        {phone ? <SupplierFilter suppliers={suppliers} value={columns.supplierId || ''} onChange={(supplierId) => setColumn({ supplierId })} /> : null}
      </div>
      {phone && source.length > 0 ? (
        <>
          <div className="sale-sec"><span>Equipos</span><span data-testid="inventory-total">{archivedMode ? `${listed.length} ${listed.length === 1 ? 'archivado' : 'archivados'}` : `${listed.length} de ${source.length}`}</span></div>
          {columnFiltersActive(columns) ? <button className="wlink" type="button" onClick={clearColumns}>Limpiar filtros</button> : null}
        </>
      ) : null}
      <div className="dcard flush">
        {phone ? (
          page.visible.length === 0 ? null : <PhoneRecords>
            {page.visible.map((item) => {
              const reason = notices.reasonFor(item.id);
              return (
                <PhoneRecord
                  className={isVoidRow(item) ? 'is-void' : undefined}
                  selection={selection.row(item.id, equipmentTitle(item.model, item.capacity))}
                  key={item.id}
                  reason={reason}
                  onActivate={() => { open({ type: 'eq', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), onSelect: () => selection.start(item.id), ...point })}
                >
                  <InventoryCard item={item} money={money} sell={sell} />
                  {item.catalogIncluded ? <small className="catalog-mark">En catálogo</small> : null}
                  {item.reservedClientName ? <small className="reservation-label">Reservado para <ReplayValue>{item.reservedClientName}</ReplayValue></small> : null}
                  {item.pendingSaleRegistration ? <small className="pending-sale-label"><ImanagerIcon name="venta-por-registrar" size={16} />Venta por registrar</small> : null}
                </PhoneRecord>
              );
            })}
          </PhoneRecords>
        ) : (
        <>
        {source.length > 0 ? (
          <div className="dch pad">
            <h3>Equipos</h3>
            <SupplierFilter suppliers={suppliers} value={columns.supplierId || ''} onChange={(supplierId) => setColumn({ supplierId })} />
            <span className="mut" data-testid="inventory-total">{archivedMode ? `${listed.length} ${listed.length === 1 ? 'archivado' : 'archivados'}` : `${listed.length} de ${source.length}`}</span>
            {columnFiltersActive(columns) ? <button className="wlink" type="button" onClick={clearColumns}>Limpiar filtros</button> : null}
          </div>
        ) : null}
        <div className="dtable-scroll"><table className="dtable inv-stock-table">
            <thead>
              <tr>
                <th className="bulk-cell"><SelectFiltered selection={selection} total={listed.length} /></th>
                <th className="inv-entry-col">Fecha de ingreso</th>
                <th>
                  <span className="thf">Equipo
                    <ColumnFilter label="equipo" {...menu('equipo')} active={columnFilterActive(columns, 'equipo')} onClear={() => setColumn({ equipo: '' })}>
                      <input aria-label="Contiene" placeholder="Modelo, capacidad o color" value={columns.equipo} onChange={(event) => setColumn({ equipo: event.target.value })} />
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">
                    <button type="button" className="thsort" aria-label="Ordenar por color" onClick={() => setSort((current) => current === 'Color ↑' ? 'Color ↓' : 'Color ↑')}>
                      Color{sort === 'Color ↑' ? ' ↑' : sort === 'Color ↓' ? ' ↓' : ''}
                    </button>
                    <ColumnFilter label="color" {...menu('color')} active={columnFilterActive(columns, 'colors')} onClear={() => setColumn({ colors: [] })}>
                      <div className="opts">
                        {colorOptions.map((label) => (
                          <label key={label} className="chk">
                            <input
                              type="checkbox"
                              checked={columns.colors.includes(label)}
                              onChange={(event) => setColumn({ colors: withStatus(columns.colors, label, event.target.checked) })}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">Condición
                    <ColumnFilter label="condición" {...menu('condición')} active={columnFilterActive(columns, 'conditions')} onClear={() => setColumn({ conditions: [] })}>
                      <div className="opts">
                        {conditionOptions.map((option) => (
                          <label key={option.id} className="chk">
                            <input
                              type="checkbox"
                              checked={columns.conditions.includes(option.id)}
                              onChange={(event) => setColumn({
                                conditions: withStatus(columns.conditions, option.id, event.target.checked),
                              })}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">
                    <button type="button" className="thsort" aria-label="Ordenar por calidad" onClick={() => setSort((current) => current === 'Calidad ↑' ? 'Calidad ↓' : 'Calidad ↑')}>
                      Calidad{sort === 'Calidad ↑' ? ' ↑' : sort === 'Calidad ↓' ? ' ↓' : ''}
                    </button>
                    <ColumnFilter label="calidad" {...menu('calidad')} active={columnFilterActive(columns, 'qualities')} onClear={() => setColumn({ qualities: [] })}>
                      <div className="opts">
                        {DEVICE_QUALITIES.map((item) => (
                          <label key={item.value} className="chk" title={`${item.name}: ${item.description}`}>
                            <input
                              type="checkbox"
                              checked={columns.qualities.includes(item.value)}
                              onChange={(event) => setColumn({
                                qualities: event.target.checked
                                  ? [...columns.qualities, item.value]
                                  : columns.qualities.filter((grade) => grade !== item.value),
                              })}
                            />
                            <span>{item.value}</span>
                          </label>
                        ))}
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">Batería
                    <ColumnFilter label="batería" {...menu('batería')} active={columnFilterActive(columns, 'battery')} onClear={() => setColumn({ battery: '' })}>
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
                    <ColumnFilter label="precio" align="right" {...menu('precio')} active={columnFilterActive(columns, 'priceMin')} onClear={() => setColumn({ priceMin: '', priceMax: '', priceToDefine: false })}>
                      <label className="inv-check"><input type="checkbox" checked={Boolean(columns.priceToDefine)} onChange={event => setColumn({ priceToDefine: event.target.checked, priceMin: '', priceMax: '' })} />Precio a definir</label><MoneyRange min={columns.priceMin} max={columns.priceMax} onMin={(priceMin) => setColumn({ priceMin })} onMax={(priceMax) => setColumn({ priceMax })} />
                    </ColumnFilter>
                  </span>
                </th>
                <th>
                  <span className="thf">Estado
                    <ColumnFilter label="estado" align="right" {...menu('estado')} active={columnFilterActive(columns, 'statuses')} onClear={() => setColumn({ statuses: [], needsCompletion: false })}>
                      <div className="opts">
                        {statusOptions.map((option) => (
                          <label key={option.id} className="chk">
                            <input
                              type="checkbox"
                              checked={columns.statuses.includes(option.id)}
                              onChange={(event) => setColumn({ statuses: withStatus(columns.statuses, option.id, event.target.checked) })}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                        <label className="chk">
                          <input type="checkbox" checked={columns.needsCompletion} onChange={(event) => setColumn({ needsCompletion: event.target.checked })} />
                          <span>Para completar</span>
                        </label>
                      </div>
                    </ColumnFilter>
                  </span>
                </th>
                <th>Catálogo</th>
              </tr>
            </thead>
            <tbody>
              {page.visible.map((item) => (
                <PressTarget
                  selection={selection.row(item.id, equipmentTitle(item.model, item.capacity))}
                  leadingCell={<td className="inv-entry-col">{item.entryDate ? formatShortDate(item.entryDate) : '—'}</td>}
                  key={item.id}
                  as="tr"
                  className={[notices.reasonFor(item.id) ? 'novedad' : '', isVoidRow(item) ? 'is-void' : ''].filter(Boolean).join(' ')}
                  onActivate={() => { open({ type: 'eq', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), onSelect: () => selection.start(item.id), ...point })}
                >
                  <td>
                    <div className="dcell">
                      <div className="dthumb"><ImanagerIcon name="equipo" size={24} /></div>
                      <div><b>{equipmentTitle(item.model, item.capacity)}</b><NoticeTag reason={notices.reasonFor(item.id)} />{item.customFields?.onboardingReview ? <small className="needs-completion-label">Para revisar</small> : null}{item.needsCompletion ? <small className="needs-completion-label" data-testid="needs-completion">Para completar</small> : null}<SupplierMark item={item} />{archiveCaption(item) ? <small className="archive-note">{archiveCaption(item)}</small> : null}</div>
                    </div>
                  </td>
                  <td>{(item.color ?? '').trim() || '—'}</td>
                  <td>{conditionLabel(item.condition)}</td>
                  <td>{displayQuality(item.condition, item.grade) || '—'}</td>
                  <td>{item.batteryHealth ? <Battery value={item.batteryHealth} /> : '—'}</td>
                  <td className="r"><b data-ph-mask>{item.price == null ? 'A definir' : item.price > 0 ? money.show(item.price, item.currency) : 'Sin precio'}</b></td>
                  <td>
                    {item.archivedAt ? <span className="spill mid">Archivado</span> : item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : '—'}
                    {item.reservedClientName ? <small className="reservation-label">Para <ReplayValue>{item.reservedClientName}</ReplayValue></small> : null}
                    {item.pendingSaleRegistration ? <div className="pending-sale-cell"><small className="pending-sale-label"><ImanagerIcon name="venta-por-registrar" size={16} />Venta por registrar</small><button type="button" onClick={(event) => { event.stopPropagation(); open({ type: 'new-sale', productId: item.id, source: 'inventory' }); }}>Retomar</button></div> : null}
                  </td>
                  <td>{item.catalogIncluded ? <small className="catalog-mark">En catálogo</small> : '—'}</td>
                </PressTarget>
              ))}
            </tbody>
          </table></div>
        </>
        )}
        {loadingLists ? <ListSkeleton variant={phone ? 'cards' : 'rows'} rows={phone ? 4 : 6} testId="inventory-loading" /> : listed.length === 0 ? (
          quietEmpty
            ? <InventoryEmpty showActions={phone} onImport={() => open({ type: 'import', kind: 'inv' })} onSeries={() => open({ type: 'batch-eq' })} onCreate={() => open({ type: 'new-eq' })} />
            : <div className="wempty">No hay equipos con ese filtro.</div>
        ) : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      {showApprox ? <p className="inv-fx">Los precios en dólares son aproximados, con la cotización de la tienda.</p> : null}
      {inventory.length === 0 ? null : <div className="dhint">{phone ? 'Mantené presionado un equipo para seleccionarlo. Tocá ⋯ para más acciones.' : 'Tip: usá los checkboxes para seleccionar varios equipos. Clic derecho para más acciones.'}</div>}
      {phone && !selection.mode ? <MobileDock primary="Registrar equipo" onPrimary={() => open({ type: 'new-eq' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'inv' })} /> : null}
      {filtersOpen ? (
        <Sheet title="Filtros" onClose={() => setFiltersOpen(false)} className="inv-filter-sheet">
          <div className="inv-filters">
            <p className="inv-filter-count" role="status">{activeColumnCount(draftFilters)} {activeColumnCount(draftFilters) === 1 ? 'filtro seleccionado' : 'filtros seleccionados'}</p>
            <p className="mut">Los cambios, incluso Limpiar filtros, se confirman con Aplicar filtros.</p>
            <p className="sec">Para completar</p>
            <div className="inv-checks">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={draftFilters.needsCompletion}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, needsCompletion: event.target.checked }))}
                />
                <span>Solo equipos para completar</span>
              </label>
            </div>
            <p className="sec">Estado</p>
            <div className="inv-checks">
              {statusOptions.map((option) => (
                <label key={option.id} className="chk">
                  <input
                    type="checkbox"
                    checked={draftFilters.statuses.includes(option.id)}
                    onChange={(event) => setDraftFilters((current) => ({
                      ...current,
                      statuses: withStatus(current.statuses, option.id, event.target.checked),
                    }))}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className="sec">Proveedor</p>
            <SupplierFilter suppliers={suppliers} value={draftFilters.supplierId || ''} onChange={(supplierId) => setDraftFilters((current) => ({ ...current, supplierId }))} />
            <p className="sec">Condición</p>
            <div className="inv-checks">
              {conditionOptions.map((option) => (
                <label key={option.id} className="chk">
                  <input
                    type="checkbox"
                    checked={draftFilters.conditions.includes(option.id)}
                    onChange={(event) => setDraftFilters((current) => ({
                      ...current,
                      conditions: withStatus(current.conditions, option.id, event.target.checked),
                    }))}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className="sec">Calidad</p>
            <div className="inv-checks">
              {DEVICE_QUALITIES.map((item) => (
                <label key={item.value} className="chk" title={`${item.name}: ${item.description}`}>
                  <input
                    type="checkbox"
                    checked={draftFilters.qualities.includes(item.value)}
                    onChange={(event) => setDraftFilters((current) => ({
                      ...current,
                      qualities: event.target.checked
                        ? [...current.qualities, item.value]
                        : current.qualities.filter((grade) => grade !== item.value),
                    }))}
                  />
                  <span>{item.value} · {item.name}</span>
                </label>
              ))}
            </div>
            <p className="sec">Batería</p>
            <div className="inv-opts">
              {BATTERY_FILTERS.map((option) => (
                <button key={option.label} className={`wchip${draftFilters.battery === option.id ? ' on' : ''}`} type="button" aria-pressed={draftFilters.battery === option.id} onClick={() => setDraftFilters((current) => ({ ...current, battery: option.id }))}>{option.label}</button>
              ))}
            </div>
            <p className="sec">Precio</p><label className="inv-check"><input type="checkbox" checked={Boolean(draftFilters.priceToDefine)} onChange={event => setDraftFilters(current => ({ ...current, priceToDefine: event.target.checked, priceMin: '', priceMax: '' }))} />Precio a definir</label>
            <div className="inv-range">
              <Field label={`Mínimo · ${money.active}`}>
                <MoneyFilterInput label="Mínimo" value={draftFilters.priceMin} onChange={(digits) => setDraftFilters((current) => ({ ...current, priceMin: digits }))} />
              </Field>
              <Field label={`Máximo · ${money.active}`}>
                <MoneyFilterInput label="Máximo" value={draftFilters.priceMax} onChange={(digits) => setDraftFilters((current) => ({ ...current, priceMax: digits }))} />
              </Field>
            </div>
            <details className="inv-colors" open={colorOptions.length <= 6}>
              <summary>Color · {draftFilters.colors.length} {draftFilters.colors.length === 1 ? 'seleccionado' : 'seleccionados'}</summary>
              {colorOptions.length === 0 ? <p className="mut">Todavía no hay colores en el stock.</p> : (
                <>
                  <Field label="Buscar color">
                    <input type="search" value={colorQuery} placeholder="Nombre del color" onChange={(event) => setColorQuery(event.target.value)} />
                  </Field>
                  <div className="inv-checks">
                    {visibleColorOptions.map((label) => (
                      <label key={label} className="chk">
                        <input
                          type="checkbox"
                          checked={draftFilters.colors.includes(label)}
                          onChange={(event) => setDraftFilters((current) => ({
                            ...current,
                            colors: withStatus(current.colors, label, event.target.checked),
                          }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {visibleColorOptions.length === 0 ? <p className="mut" role="status">No hay colores con esa búsqueda. Probá otro nombre.</p> : null}
                </>
              )}
            </details>
          </div>
          <Actions
            secondary="Limpiar filtros"
            onSecondary={() => setDraftFilters(EMPTY_COLUMN_FILTERS)}
            primary="Aplicar filtros"
            onPrimary={() => { setColumns(draftFilters); setFiltersOpen(false); }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function archiveCaption(item: Product) {
  if (!item.archivedAt) return '';
  const when = new Date(item.archivedAt);
  const date = Number.isNaN(when.getTime()) ? '' : when.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const who = item.archivedBy ? `por ${item.archivedBy}${date ? ` el ${date}` : ''}` : (date ? `el ${date}` : '');
  return `Archivado ${who}${item.archiveReason ? ` · ${item.archiveReason}` : ''}`.replace(/\s+/g, ' ').trim();
}

function InventoryCard({ item, money, sell }: { item: Product; money: MoneyApi; sell: number | null }) {
  const condition = [conditionName(item.condition), item.color].filter(Boolean).join(' · ');
  const specs = [qualityPhrase(item.condition, item.grade), batteryLine(item.batteryHealth)].filter(Boolean).join(' · ');
  const approx = approxUsd(item.price, item.currency, money.active, sell);
  return (
    <span className="inv-card">
      <span className="inv-entry-date">Ingreso {item.entryDate ? formatShortDate(item.entryDate) : '—'}</span>
      <span data-ph-mask className="inv-imei">{item.imei ? `IMEI ${formatImei(item.imei)}` : 'Sin IMEI'}</span>
      <span className="inv-status">{item.archivedAt ? <span className="spill mid">Archivado</span> : item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : null}</span>
      <span className="inv-title">
        <b>{equipmentTitle(item.model, item.capacity)}</b>
        {item.customFields?.onboardingReview ? <small className="needs-completion-label">Para revisar</small> : null}{item.needsCompletion ? <small className="needs-completion-label" data-testid="needs-completion">Para completar</small> : null}<SupplierMark item={item} />{archiveCaption(item) ? <small className="archive-note">{archiveCaption(item)}</small> : null}
      </span>
      <span className="inv-meta">
        <small>{condition || '—'}</small>
        {specs ? <small>{specs}</small> : null}
      </span>
      <span className="inv-price">
        <b data-ph-mask>{item.price == null ? 'A definir' : item.price > 0 ? money.show(item.price, item.currency) : 'Sin precio'}</b>
        {approx ? <small data-ph-mask>{approx}</small> : null}
      </span>
    </span>
  );
}

function InventoryEmpty({ showActions, onImport, onSeries, onCreate }: { showActions: boolean; onImport: () => void; onSeries: () => void; onCreate: () => void }) {
  return (
    <div className="inv-empty" data-testid="inventory-empty">
      <div className="inv-empty-box">
        <div className="inv-empty-mark"><ImanagerIcon name="equipo" size={24} /></div>
        <b>Todavía no cargaste equipos</b>
        <p>Ingresá tu primer equipo o importá tu stock desde una planilla.</p>
        {showActions ? (
          <div className="inv-empty-actions">
            <button className="dbtn s" type="button" onClick={onImport}>
              <ImanagerIcon name="importar" size={16} />
              Importar
            </button>
            <button className="dbtn s" type="button" onClick={onSeries}>Carga en serie</button>
            <button className="dbtn p" type="button" onClick={onCreate}>
              <ImanagerIcon name="agregar" size={16} />
              Registrar equipo
            </button>
          </div>
        ) : null}
      </div>
      <p className="inv-count">0 resultados</p>
    </div>
  );
}

function SupplierMark({ item }: { item: Product }) {
  const date = formatShortDate(item.purchasedAt);
  const label = [item.supplierName?.trim(), date !== '—' ? date.slice(0, 5) : ''].filter(Boolean).join(' · ');
  if (!label) return null;
  return <small className="archive-note sup-mark" data-testid="inventory-origin"><DeskIcon name="store" size={12} /><span>{label}</span></small>;
}

function SupplierFilter({ suppliers, value, onChange }: {
  suppliers: { id: string; name: string }[] | null | undefined;
  value: string;
  onChange: (id: string) => void;
}) {
  // Keep the saved selection while the shared supplier catalog is still loading.
  const options = [...(suppliers ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return <DeskSelect className={`inventory-supplier-filter${value ? ' filtered' : ''}`} label="Proveedor" value={value} onChange={onChange}
    options={[{ value: '', label: value ? 'Todos los proveedores' : 'Proveedor' },
      ...(value && !options.some(row => row.id === value) ? [{ value, label: 'Proveedor' }] : []),
      ...options.map(row => ({ value: row.id, label: row.name }))]} />;
}
