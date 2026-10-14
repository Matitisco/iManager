import { BulkActions, useBulkScope } from '../bulk-actions';
import { SelectFiltered, useBulkSelection } from '../bulk-selection';
import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, NoticesBar, PhoneRecord, PhoneRecords } from '../section-notice-view';
import { ColumnFilter, MoneyFilterInput, MoneyRange, useColumnMenu } from '../ColumnFilter';
import { catalogChoices, useCatalogs } from '../catalog';
import { approxUsd, useDisplayQuote, useMoney, type MoneyApi } from '../exchange';
import { conditionLabel, conditionName, equipmentTitle, formatImei, isInStock, statusLabel } from '../format';
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
  matchesInventoryColumns,
  type InventoryColumnFilters,
} from '../inventory-filters';
import { TablePager, usePagedRows } from '../pager';
import { useOperationDraftError } from '../operation-drafts';
import { PendingDrafts } from '../pending-drafts';
import { ImanagerIcon } from '../icons';
import { Actions, Battery, ChipRow, DeskCta, Field, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import type { Product } from '../../types';

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
  + Number(Boolean(filters.priceMin.trim() || filters.priceMax.trim()))
  + Number(Boolean(filters.equipo.trim()))
  + Number(filters.needsCompletion);
}

function withStatus(statuses: string[], id: string, checked: boolean) {
  if (checked) return statuses.includes(id) ? statuses : [...statuses, id];
  return statuses.filter((item) => item !== id);
}

export function InventoryScreen() {
  const { inventory, deleteProduct, operationDrafts = [] } = useAppContext();
  const money = useMoney();
  const { sell } = useDisplayQuote();
  const catalogs = useCatalogs();
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const notices = useSectionNotices('inventory');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [columns, setColumns] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [sort, setSort] = useState('Recientes');
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = inventory.filter((item) => {
      const haystack = `${item.model} ${item.capacity} ${item.color}${phone ? ` ${item.imei}` : ''}`.toLowerCase();
      return (!q || haystack.includes(q)) && matchesInventoryColumns(item, columns);
    });
    const priceOf = (item: { price: number; currency?: string | null }) => money.number(item.price, item.currency) ?? item.price;
    const qualityOf = (item: Product) => displayQuality(item.condition, item.grade);
    if (sort === 'Precio ↑') list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === 'Precio ↓') list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === 'Calidad ↑') list = [...list].sort((a, b) => compareQuality(qualityOf(a), qualityOf(b), 'best') || a.model.localeCompare(b.model, 'es'));
    if (sort === 'Calidad ↓') list = [...list].sort((a, b) => compareQuality(qualityOf(a), qualityOf(b), 'worst') || a.model.localeCompare(b.model, 'es'));
    if (sort === 'Color ↑') list = [...list].sort((a, b) => compareInventoryColor(a.color, b.color, 'asc') || a.model.localeCompare(b.model, 'es'));
    if (sort === 'Color ↓') list = [...list].sort((a, b) => compareInventoryColor(a.color, b.color, 'desc') || a.model.localeCompare(b.model, 'es'));
    return list;
  }, [inventory, query, columns, sort, money, phone]);
  const listed = onlyNotices ? inventory.filter((item) => notices.reasonFor(item.id)) : rows;
  const page = usePagedRows(listed, `${query}|${columnFilterKey(columns)}|${sort}|${onlyNotices ? 'notices' : 'all'}`);
  const scope = useBulkScope();
  const selection = useBulkSelection(listed, scope);
  const visibleKey = page.visible.map((item) => item.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((item) => item.id)); }, [visibleKey, notices.markVisible]);

  const available = inventory.filter((item) => isInStock(item.status)).length;
  const statusOptions = useMemo(() => {
    const known = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', STATUS_FILTERS);
    const extra = [...new Set(inventory.map((item) => item.status))].filter((status) => status && !known.some((item) => item.id === status));
    return [...known, ...extra.map((id) => ({ id, label: statusLabel(id) }))];
  }, [catalogs?.options, inventory]);
  const filters = useMemo(() => [{ id: 'Todos', label: 'Todos' }, ...statusOptions, { id: 'PARA_COMPLETAR', label: 'Para completar' }], [statusOptions]);
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
  const setColumn = (patch: Partial<InventoryColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const toggleStatus = (id: string) => setColumns((current) => {
    if (id === 'PARA_COMPLETAR') return { ...current, needsCompletion: !current.needsCompletion };
    return {
      ...current,
      statuses: id === 'Todos' ? [] : withStatus(current.statuses, id, !current.statuses.includes(id)),
      needsCompletion: id === 'Todos' ? false : current.needsCompletion,
    };
  });
  const statusPressed = (id: string) => {
    if (id === 'PARA_COMPLETAR') return columns.needsCompletion;
    if (id === 'Todos') return columns.statuses.length === 0 && !columns.needsCompletion;
    return columns.statuses.includes(id);
  };
  const filterCount = activeColumnCount(columns);
  const clearColumns = () => setColumns(EMPTY_COLUMN_FILTERS);
  const quietEmpty = inventory.length === 0 && !query.trim() && !columnFiltersActive(columns) && !onlyNotices;
  const openFilters = () => {
    setDraftFilters(columns);
    setFiltersOpen(true);
  };
  const showApprox = phone && sell != null && page.visible.some((item) => approxUsd(item.price, item.currency, money.active, sell));

  return (
    <div className={`dscreen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Inventario"
        subtitle={`${inventory.length} equipos · ${available} disponibles · ${inventory.filter(item => item.catalogIncluded).length} en catálogo`}
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
            <DeskCta onClick={() => open({ type: 'new-eq' })}>Registrar equipo</DeskCta>
          </div>
        )}
      />
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por IMEI, modelo o color" /></div> : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      <PendingDrafts drafts={ownDrafts} hint="Podés retomarlos para completar el cliente y la venta." onOpen={(id) => open({ type: 'edit-cj', id, source: 'inventory' })} />
      <div className="dbar">
        <ChipRow options={filters} pressed={statusPressed} onToggle={toggleStatus} />
        <MenuButton label={sort} options={['Recientes', 'Precio ↑', 'Precio ↓', 'Calidad ↑', 'Calidad ↓', 'Color ↑', 'Color ↓']} value={sort} onChange={setSort} />
      </div>
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
      <BulkActions key={scope} selection={selection} total={listed.length}
        label={(item) => equipmentTitle(item.model, item.capacity)}
        action={{ label: 'Eliminar selección', explanation: 'Se eliminarán los equipos seleccionados. Los equipos vinculados a operaciones activas no se pueden eliminar. Esta acción no se puede deshacer.', execute: (item) => deleteProduct(item.id) }}
      />
      {phone && inventory.length > 0 ? (
        <>
          <div className="sale-sec"><span>Equipos</span><span data-testid="inventory-total">{listed.length} de {inventory.length}</span></div>
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
                  selection={selection.row(item.id, equipmentTitle(item.model, item.capacity))}
                  key={item.id}
                  reason={reason}
                  onActivate={() => { notices.markVisible([item.id]); open({ type: 'eq', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), onSelect: () => selection.start(item.id), ...point })}
                >
                  <InventoryCard item={item} money={money} sell={sell} />
                  {item.catalogIncluded ? <small className="catalog-mark">En catálogo</small> : null}
                  {item.reservedClientName ? <small className="reservation-label">Reservado para {item.reservedClientName}</small> : null}
                  {item.pendingSaleRegistration ? <small className="pending-sale-label"><ImanagerIcon name="venta-por-registrar" size={16} />Venta por registrar</small> : null}
                </PhoneRecord>
              );
            })}
          </PhoneRecords>
        ) : (
        <>
        {inventory.length > 0 ? (
          <div className="dch pad">
            <h3>Equipos</h3>
            <span className="mut" data-testid="inventory-total">{listed.length} de {inventory.length}</span>
            {columnFiltersActive(columns) ? <button className="wlink" type="button" onClick={clearColumns}>Limpiar filtros</button> : null}
          </div>
        ) : null}
        <table className="dtable">
            <thead>
              <tr>
                <th className="bulk-cell"><SelectFiltered selection={selection} total={listed.length} /></th>
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
                            {label}
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
                            {option.label}
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
                            {item.value}
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
                    <ColumnFilter label="precio" align="right" {...menu('precio')} active={columnFilterActive(columns, 'priceMin')} onClear={() => setColumn({ priceMin: '', priceMax: '' })}>
                      <MoneyRange min={columns.priceMin} max={columns.priceMax} onMin={(priceMin) => setColumn({ priceMin })} onMax={(priceMax) => setColumn({ priceMax })} />
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
                            {option.label}
                          </label>
                        ))}
                        <label className="chk">
                          <input type="checkbox" checked={columns.needsCompletion} onChange={(event) => setColumn({ needsCompletion: event.target.checked })} />
                          Para completar
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
                  key={item.id}
                  as="tr"
                  className={notices.reasonFor(item.id) ? 'novedad' : undefined}
                  onActivate={() => { notices.markVisible([item.id]); open({ type: 'eq', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), onSelect: () => selection.start(item.id), ...point })}
                >
                  <td>
                    <div className="dcell">
                      <div className="dthumb"><ImanagerIcon name="equipo" size={24} /></div>
                      <div><b>{equipmentTitle(item.model, item.capacity)}</b><NoticeTag reason={notices.reasonFor(item.id)} />{item.needsCompletion ? <small className="needs-completion-label" data-testid="needs-completion">Para completar</small> : null}</div>
                    </div>
                  </td>
                  <td>{(item.color ?? '').trim() || '—'}</td>
                  <td>{conditionLabel(item.condition)}</td>
                  <td>{displayQuality(item.condition, item.grade) || '—'}</td>
                  <td>{item.batteryHealth ? <Battery value={item.batteryHealth} /> : '—'}</td>
                  <td className="r"><b>{item.price > 0 ? money.show(item.price, item.currency) : '-'}</b></td>
                  <td>
                    {item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : '—'}
                    {item.reservedClientName ? <small className="reservation-label">Para {item.reservedClientName}</small> : null}
                    {item.pendingSaleRegistration ? <div className="pending-sale-cell"><small className="pending-sale-label"><ImanagerIcon name="venta-por-registrar" size={16} />Venta por registrar</small><button type="button" onClick={(event) => { event.stopPropagation(); open({ type: 'new-sale', productId: item.id, source: 'inventory' }); }}>Retomar</button></div> : null}
                  </td>
                  <td>{item.catalogIncluded ? <small className="catalog-mark">En catálogo</small> : '—'}</td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        </>
        )}
        {listed.length === 0 ? (
          quietEmpty
            ? <InventoryEmpty showActions={phone} onImport={() => open({ type: 'import', kind: 'inv' })} onCreate={() => open({ type: 'new-eq' })} />
            : <div className="wempty">No hay equipos con ese filtro.</div>
        ) : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      {showApprox ? <p className="inv-fx">Los precios en dólares son aproximados, con la cotización de la tienda.</p> : null}
      {inventory.length === 0 ? null : <div className="dhint">{phone ? 'Mantené presionado un equipo para seleccionarlo. Tocá ⋯ para más acciones.' : 'Tip: usá los checkboxes para seleccionar varios equipos. Clic derecho para más acciones.'}</div>}
      {phone && selection.selected.length === 0 ? <MobileDock primary="Registrar equipo" onPrimary={() => open({ type: 'new-eq' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'inv' })} /> : null}
      {filtersOpen ? (
        <Sheet title="Filtros" onClose={() => setFiltersOpen(false)} className="inv-filter-sheet">
          <div className="inv-filters">
            <p className="sec">Para completar</p>
            <div className="inv-checks">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={draftFilters.needsCompletion}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, needsCompletion: event.target.checked }))}
                />
                Solo equipos para completar
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
                  {option.label}
                </label>
              ))}
            </div>
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
                  {option.label}
                </label>
              ))}
            </div>
            <p className="sec">Color</p>
            {colorOptions.length === 0 ? <p className="mut">Todavía no hay colores en el stock.</p> : (
              <div className="inv-checks">
                {colorOptions.map((label) => (
                  <label key={label} className="chk">
                    <input
                      type="checkbox"
                      checked={draftFilters.colors.includes(label)}
                      onChange={(event) => setDraftFilters((current) => ({
                        ...current,
                        colors: withStatus(current.colors, label, event.target.checked),
                      }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
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
                  {item.value} · {item.name}
                </label>
              ))}
            </div>
            <p className="sec">Batería</p>
            <div className="inv-opts">
              {BATTERY_FILTERS.map((option) => (
                <button key={option.label} className={`wchip${draftFilters.battery === option.id ? ' on' : ''}`} type="button" onClick={() => setDraftFilters((current) => ({ ...current, battery: option.id }))}>{option.label}</button>
              ))}
            </div>
            <p className="sec">Precio</p>
            <div className="inv-range">
              <Field label={`Mínimo · ${money.active}`}>
                <MoneyFilterInput label="Mínimo" value={draftFilters.priceMin} onChange={(digits) => setDraftFilters((current) => ({ ...current, priceMin: digits }))} />
              </Field>
              <Field label={`Máximo · ${money.active}`}>
                <MoneyFilterInput label="Máximo" value={draftFilters.priceMax} onChange={(digits) => setDraftFilters((current) => ({ ...current, priceMax: digits }))} />
              </Field>
            </div>
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

function InventoryCard({ item, money, sell }: { item: Product; money: MoneyApi; sell: number | null }) {
  const condition = [conditionName(item.condition), item.color].filter(Boolean).join(' · ');
  const specs = [qualityPhrase(item.condition, item.grade), batteryLine(item.batteryHealth)].filter(Boolean).join(' · ');
  const approx = approxUsd(item.price, item.currency, money.active, sell);
  return (
    <span className="inv-card">
      <span className="inv-imei">{item.imei ? `IMEI ${formatImei(item.imei)}` : 'Sin IMEI'}</span>
      <span className="inv-status">{item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : null}</span>
      <span className="inv-title">
        <b>{equipmentTitle(item.model, item.capacity)}</b>
        {item.needsCompletion ? <small className="needs-completion-label" data-testid="needs-completion">Para completar</small> : null}
      </span>
      <span className="inv-meta">
        <small>{condition || '—'}</small>
        {specs ? <small>{specs}</small> : null}
      </span>
      <span className="inv-price">
        <b>{item.price > 0 ? money.show(item.price, item.currency) : 'Sin precio'}</b>
        {approx ? <small>{approx}</small> : null}
      </span>
    </span>
  );
}

function InventoryEmpty({ showActions, onImport, onCreate }: { showActions: boolean; onImport: () => void; onCreate: () => void }) {
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
