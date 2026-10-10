import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, NoticesBar, PhoneRecord, PhoneRecords } from '../section-notice-view';
import { ColumnFilter } from '../ColumnFilter';
import { catalogChoices, useCatalogs } from '../catalog';
import { approxUsd, useDisplayQuote, useMoney, type MoneyApi } from '../exchange';
import { conditionLabel, conditionName, equipmentTitle, formatImei, formatInputMoney, isInStock, parseMoney, statusLabel } from '../format';
import { compareQuality, DEVICE_QUALITIES, displayQuality, qualityPhrase } from '../quality';
import {
  EMPTY_COLUMN_FILTERS,
  columnFilterActive,
  columnFilterKey,
  columnFiltersActive,
  matchesInventoryColumns,
  type InventoryColumnFilters,
} from '../inventory-filters';
import { TablePager, usePagedRows } from '../pager';
import { useOperationDraftError } from '../operation-drafts';
import { priceListMessage } from '../price-list';
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
    + Number(Boolean(filters.battery))
    + Number(Boolean(filters.priceMin.trim() || filters.priceMax.trim()))
    + Number(Boolean(filters.equipo.trim()));
}

function withStatus(statuses: string[], id: string, checked: boolean) {
  if (checked) return statuses.includes(id) ? statuses : [...statuses, id];
  return statuses.filter((item) => item !== id);
}

export function InventoryScreen() {
  const { inventory, appSession, operationDrafts = [] } = useAppContext();
  const money = useMoney();
  const { sell } = useDisplayQuote();
  const catalogs = useCatalogs();
  const { open, toast, back } = useDesk();
  const phone = usePhoneLayout();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const notices = useSectionNotices('inventory');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [columns, setColumns] = useState<InventoryColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [sort, setSort] = useState('Recientes');
  const [listOpen, setListOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
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
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [moreOpen]);

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
    return list;
  }, [inventory, query, columns, sort, money, phone]);
  const listed = onlyNotices ? inventory.filter((item) => notices.reasonFor(item.id)) : rows;
  const page = usePagedRows(listed, `${query}|${columnFilterKey(columns)}|${sort}|${onlyNotices ? 'notices' : 'all'}`);
  const visibleKey = page.visible.map((item) => item.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((item) => item.id)); }, [visibleKey, notices.markVisible]);
  const priceMessage = priceListMessage(rows, appSession?.store?.name, (item) => money.show(item.price, item.currency));

  const available = inventory.filter((item) => isInStock(item.status)).length;
  const statusOptions = useMemo(() => {
    const known = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', STATUS_FILTERS);
    const extra = [...new Set(inventory.map((item) => item.status))].filter((status) => status && !known.some((item) => item.id === status));
    return [...known, ...extra.map((id) => ({ id, label: statusLabel(id) }))];
  }, [catalogs?.options, inventory]);
  const filters = useMemo(() => [{ id: 'Todos', label: 'Todos' }, ...statusOptions], [statusOptions]);
  const conditionOptions = useMemo(() => {
    const labels = [...new Set(inventory.map((item) => conditionLabel(item.condition)))].filter((label) => label !== '—');
    const preferred = ['Nuevo', 'Usado', 'Pre-owned'];
    return labels.sort((left, right) => {
      const leftRank = preferred.indexOf(left);
      const rightRank = preferred.indexOf(right);
      if (leftRank !== -1 || rightRank !== -1) return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
      return left.localeCompare(right, 'es');
    });
  }, [inventory]);
  const setColumn = (patch: Partial<InventoryColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const toggleStatus = (id: string) => setColumns((current) => ({
    ...current,
    statuses: id === 'Todos' ? [] : withStatus(current.statuses, id, !current.statuses.includes(id)),
  }));
  const statusPressed = (id: string) => (id === 'Todos' ? columns.statuses.length === 0 : columns.statuses.includes(id));
  const filterCount = activeColumnCount(columns);
  const clearColumns = () => setColumns(EMPTY_COLUMN_FILTERS);
  const openFilters = () => {
    setDraftFilters(columns);
    setFiltersOpen(true);
    setMoreOpen(false);
  };
  const showApprox = phone && sell != null && page.visible.some((item) => approxUsd(item.price, item.currency, money.active, sell));

  return (
    <div className={`dscreen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Inventario"
        subtitle={`${inventory.length} equipos · ${available} disponibles`}
        back={back}
        tools={(
          <>
            <IconButton label="Buscar" name="buscar" pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} />
            <span className="rslot">
              <IconButton label="Filtros" name="filtrar" pressed={filterCount > 0} onClick={openFilters} />
              {filterCount > 0 ? <span className="rbadge">{filterCount}</span> : null}
            </span>
            <div className="htools" ref={moreRef}>
              <IconButton label="Más opciones" name="mas" pressed={moreOpen} onClick={() => setMoreOpen((current) => !current)} />
              {moreOpen ? (
                <div className="menu">
                  <button type="button" disabled={rows.length === 0} onClick={() => { setMoreOpen(false); setListOpen(true); }}>
                    <ImanagerIcon name="lista-de-precios" size={16} />
                    Lista de precios
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
        desktop={(
          <div className="dright">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar modelo o color" />
            <button className="dbtn s" type="button" onClick={() => setListOpen(true)} disabled={rows.length === 0}>
              <ImanagerIcon name="lista-de-precios" size={16} />
              Lista de precios
            </button>
            <ImportButton onClick={() => open({ type: 'import', kind: 'inv' })} />
            <DeskCta onClick={() => open({ type: 'new-eq' })}>Registrar equipo</DeskCta>
          </div>
        )}
      />
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por IMEI, modelo o color" /></div> : null}
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
        <ChipRow options={filters} pressed={statusPressed} onToggle={toggleStatus} />
        <MenuButton label={sort} options={['Recientes', 'Precio ↑', 'Precio ↓', 'Calidad ↑', 'Calidad ↓']} value={sort} onChange={setSort} />
      </div>
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
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
                  key={item.id}
                  reason={reason}
                  onActivate={() => { notices.markVisible([item.id]); open({ type: 'eq', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), ...point })}
                >
                  <InventoryCard item={item} money={money} sell={sell} />
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
                  <span className="thf">
                    <button type="button" className="thsort" aria-label="Ordenar por calidad" onClick={() => setSort((current) => current === 'Calidad ↑' ? 'Calidad ↓' : 'Calidad ↑')}>
                      Calidad{sort === 'Calidad ↑' ? ' ↑' : sort === 'Calidad ↓' ? ' ↓' : ''}
                    </button>
                    <ColumnFilter label="calidad" open={openColumn === 'calidad'} onToggle={() => setOpenColumn((current) => current === 'calidad' ? null : 'calidad')} active={columnFilterActive(columns, 'qualities')} onClear={() => setColumn({ qualities: [] })}>
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
                    <ColumnFilter label="estado" align="right" open={openColumn === 'estado'} onToggle={() => setOpenColumn((current) => current === 'estado' ? null : 'estado')} active={columnFilterActive(columns, 'statuses')} onClear={() => setColumn({ statuses: [] })}>
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
                  className={notices.reasonFor(item.id) ? 'novedad' : undefined}
                  onActivate={() => { notices.markVisible([item.id]); open({ type: 'eq', id: item.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'eq', id: item.id, label: equipmentTitle(item.model, item.capacity), ...point })}
                >
                  <td>
                    <div className="dcell">
                      <div className="dthumb"><ImanagerIcon name="equipo" size={24} /></div>
                      <div><b>{equipmentTitle(item.model, item.capacity)}</b><small>{item.color || '—'}</small><NoticeTag reason={notices.reasonFor(item.id)} /></div>
                    </div>
                  </td>
                  <td>{conditionLabel(item.condition)}</td>
                  <td>{displayQuality(item.condition, item.grade) || '—'}</td>
                  <td>{item.batteryHealth ? <Battery value={item.batteryHealth} /> : '—'}</td>
                  <td className="r"><b>{item.price > 0 ? money.show(item.price, item.currency) : '-'}</b></td>
                  <td>
                    {item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : '—'}
                    {item.pendingSaleRegistration ? <div className="pending-sale-cell"><small className="pending-sale-label"><ImanagerIcon name="venta-por-registrar" size={16} />Venta por registrar</small><button type="button" onClick={(event) => { event.stopPropagation(); open({ type: 'new-sale', productId: item.id, source: 'inventory' }); }}>Retomar</button></div> : null}
                  </td>
                </PressTarget>
              ))}
            </tbody>
          </table>
        </>
        )}
        {listed.length === 0 ? (
          phone && inventory.length === 0
            ? <InventoryEmpty onImport={() => open({ type: 'import', kind: 'inv' })} onCreate={() => open({ type: 'new-eq' })} />
            : <div className="wempty">No hay equipos con ese filtro.</div>
        ) : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      {showApprox ? <p className="inv-fx">Los precios en dólares son aproximados, con la cotización de la tienda.</p> : null}
      {phone && inventory.length === 0 ? null : <div className="dhint">{phone ? 'Tocá ⋯ en una fila para editar o eliminar.' : 'Tip: mantené apretada una fila (o clic derecho) para editar o eliminar.'}</div>}
      {phone ? <MobileDock primary="Registrar equipo" onPrimary={() => open({ type: 'new-eq' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'inv' })} /> : null}
      {filtersOpen ? (
        <Sheet title="Filtros" onClose={() => setFiltersOpen(false)} className="inv-filter-sheet">
          <div className="inv-filters">
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
            {conditionOptions.length === 0 ? <p className="mut">Todavía no hay condiciones en el stock.</p> : (
              <div className="inv-checks">
                {conditionOptions.map((label) => (
                  <label key={label} className="chk">
                    <input
                      type="checkbox"
                      checked={draftFilters.conditions.includes(label)}
                      onChange={(event) => setDraftFilters((current) => ({
                        ...current,
                        conditions: event.target.checked
                          ? [...current.conditions, label]
                          : current.conditions.filter((item) => item !== label),
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
                <input aria-label="Mínimo" inputMode="numeric" value={draftFilters.priceMin ? formatInputMoney(parseMoney(draftFilters.priceMin)) : ''} onChange={(event) => setDraftFilters((current) => ({ ...current, priceMin: event.target.value.replace(/\D/g, '').slice(0, 12) }))} />
              </Field>
              <Field label={`Máximo · ${money.active}`}>
                <input aria-label="Máximo" inputMode="numeric" value={draftFilters.priceMax ? formatInputMoney(parseMoney(draftFilters.priceMax)) : ''} onChange={(event) => setDraftFilters((current) => ({ ...current, priceMax: event.target.value.replace(/\D/g, '').slice(0, 12) }))} />
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

function InventoryCard({ item, money, sell }: { item: Product; money: MoneyApi; sell: number | null }) {
  const condition = [conditionName(item.condition), item.color].filter(Boolean).join(' · ');
  const specs = [qualityPhrase(item.condition, item.grade), batteryLine(item.batteryHealth)].filter(Boolean).join(' · ');
  const approx = approxUsd(item.price, item.currency, money.active, sell);
  return (
    <span className="inv-card">
      <span className="inv-imei">{item.imei ? `IMEI ${formatImei(item.imei)}` : 'Sin IMEI'}</span>
      <span className="inv-status">{item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : null}</span>
      <b className="inv-title">{equipmentTitle(item.model, item.capacity)}</b>
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

function InventoryEmpty({ onImport, onCreate }: { onImport: () => void; onCreate: () => void }) {
  return (
    <div className="inv-empty" data-testid="inventory-empty">
      <div className="inv-empty-box">
        <div className="inv-empty-mark"><ImanagerIcon name="equipo" size={24} /></div>
        <b>Todavía no cargaste equipos</b>
        <p>Ingresá tu primer equipo o importá tu stock desde una planilla.</p>
        <button className="dbtn s" type="button" onClick={onImport}>
          <ImanagerIcon name="importar" size={16} />
          Importar
        </button>
        <button className="dbtn p" type="button" onClick={onCreate}>
          <ImanagerIcon name="agregar" size={16} />
          Registrar equipo
        </button>
      </div>
      <p className="inv-count">0 resultados</p>
    </div>
  );
}
