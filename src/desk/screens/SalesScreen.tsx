import { useArchivedRows } from '../use-archived-rows';
import { isVoidRow, mergeRecordRows } from '../format';
import { useNavigationState } from '../route-viewport';
import { monthKey, monthLabel } from '../commissions';
import { AssignSellerSheet } from '../AssignSellerSheet';
import { CommissionAvatar } from '../CommissionAvatar';
import { BulkActions, useBulkScope } from '../bulk-actions';
import { SelectFiltered, useBulkSelection } from '../bulk-selection';
import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, PhoneRecord } from '../section-notice-view';
import { ColumnFilter, DateRange, MoneyRange, useColumnMenu } from '../ColumnFilter';
import { approxActive, approxUsd, useDisplayQuote, useMoney } from '../exchange';
import {
  parseAppDate,
  saleBuyer,
  formatShortDate,
  inPeriod,
  paymentLabel,
  periodBounds,
  saleCode,
  saleEquipment,
  statusLabel,
  type PeriodKey,
} from '../format';
import { displayQuality, qualityDetail } from '../quality';
import { useOperationDraftError } from '../operation-drafts';
import { PendingDrafts } from '../pending-drafts';
import { TablePager, usePagedRows } from '../pager';
import {
  EMPTY_SALE_FILTERS,
  matchesSaleColumns,
  saleColumnActive,
  saleFilterKey,
  saleFiltersActive,
  type SaleColumnFilters,
} from '../sale-column-filters';
import { salesMatchingSellers, sellerChipLabel, sellerFilterOptions } from '../sale-sellers';
import { canManageCommissions, canSeeFinancials } from '../sections';
import { ImanagerIcon } from '../icons';
import { ListSkeleton, listsAreLoading } from '../list-skeleton';
import { DeskCta, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, Sheet, useDesk } from '../ui';
import type { Sale } from '../../types';
import { fetchVoidedSales } from '../../services/sales-api';
import { rememberVoidedSales } from '../archive-cache';

const PERIODS: PeriodKey[] = ['Semana', 'Mes', 'Año'];

export function SalesScreen() {
  const { sales, clients, inventory, deleteSale, operationDrafts = [], appSession, commissionSellers = [], loadCommissionSellers, listsLoaded } = useAppContext();
  const loadingLists = listsAreLoading(listsLoaded);
  const money = useMoney();
  const { sell, staleClock } = useDisplayQuote();
  const seeFinancials = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignedMonth] = useNavigationState('Sales.unassignedMonth', () => { const requested = sessionStorage.getItem('commission-unassigned'); return requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : null; });
  const [onlyUnassigned, setOnlyUnassigned] = useNavigationState('Sales.onlyUnassigned', Boolean(unassignedMonth));
  useEffect(() => { sessionStorage.removeItem('commission-unassigned'); }, []);
  const manageCommissions = canManageCommissions(appSession?.membership?.sections, appSession?.membership?.role);
  useEffect(() => {
    if (!loadCommissionSellers) return;
    let active = true;
    void loadCommissionSellers().catch((cause: unknown) => { if (active) console.warn('No se pudieron cargar los vendedores.', cause); });
    return () => { active = false; };
  }, [appSession?.store?.id]);
  const sellerPerson = (sale: Sale) => commissionSellers.find(person => person.id === sale.sellerMemberId);
  const sellerName = (sale: Sale) => sellerPerson(sale)?.name ?? (sale.sellerMemberId ? 'Vendedor no disponible' : 'Sin vendedor');
  const sellerRole = (sale: Sale) => sellerPerson(sale)?.role ?? (sale.sellerMemberId ? 'STAFF' as const : 'NONE' as const);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellerDraft, setSellerDraft] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useNavigationState('Sales.searchOpen', false);
  const notices = useSectionNotices('sales');
  const [query, setQuery] = useNavigationState('Sales.query', '');
  const [period, setPeriod] = useNavigationState<PeriodKey>('Sales.period', 'Mes');
  const [statusPill, setStatusPill] = useNavigationState('Sales.statusPill', 'Todos');
  const [columns, setColumns] = useNavigationState<SaleColumnFilters>('Sales.columns', EMPTY_SALE_FILTERS);
  const { rows: voidedSales } = useArchivedRows(sales, fetchVoidedSales, rememberVoidedSales);
  const menu = useColumnMenu();
  const draftError = useOperationDraftError('sales');
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'sales' && trade.confirmationStatus === 'PENDING');
  const bounds = periodBounds(period);

  const inWindow = (sale: { date: string }) => {
    if (onlyUnassigned && unassignedMonth) {
      const date = parseAppDate(sale.date);
      return date ? monthKey(date, appSession?.store?.timezone) === unassignedMonth : false;
    }
    return parseOk(sale.date) ? inPeriod(sale.date, bounds.start, bounds.end) : period === 'Mes';
  };
  const periodSales = useMemo(
    () => sales.filter((sale) => !isVoidRow(sale) && inWindow(sale)),
    [sales, bounds.start, bounds.end, period, onlyUnassigned, unassignedMonth, appSession?.store?.timezone],
  );

  const salePool = mergeRecordRows(sales, voidedSales);
  const listed = useMemo(() => salePool.filter((sale) => inWindow(sale)), [salePool, bounds.start, bounds.end, period, onlyUnassigned, unassignedMonth, appSession?.store?.timezone]);
  const previous = sales.filter((sale) => !isVoidRow(sale) && inPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
  const total = money.sum(periodSales.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const prevTotal = money.sum(previous.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const avg = total != null && periodSales.length ? Math.round(total / periodSales.length) : null;
  const cost = money.sum(periodSales.map((sale) => {
    const item = inventory.find((row) => row.id === sale.productId);
    return { amount: item?.cost ?? 0, currency: item?.currency };
  }));
  const hasCost = periodSales.some((sale) => (inventory.find((item) => item.id === sale.productId)?.cost ?? 0) > 0);
  const margin = total != null && cost != null ? total - cost : null;
  const delta = total != null && prevTotal != null && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const setColumn = (patch: Partial<SaleColumnFilters>) => setColumns((current) => ({ ...current, ...patch }));
  const toggleList = (key: 'payments' | 'statuses' | 'sellers', value: string) => setColumns((current) => ({
    ...current,
    [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
  }));
  const rowLabels = (sale: Sale) => ({ client: saleBuyer(sale, clients), equipment: saleEquipment(sale, inventory) });
  const matchesQuery = (sale: Sale) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const labels = rowLabels(sale);
    return `${labels.client} ${labels.equipment} ${saleCode(sale)}`.toLowerCase().includes(q);
  };
  const sellerPool = listed.filter((sale) => {
    if (onlyUnassigned && sale.sellerMemberId) return false;
    if (!matchesQuery(sale)) return false;
    return matchesSaleColumns(sale, { ...columns, sellers: [] }, rowLabels(sale));
  });
  const rows = sellerPool.filter((sale) => matchesSaleColumns(sale, columns, rowLabels(sale)));
  const statusOn = phone && statusPill !== 'Todos';
  const narrowed = statusOn ? rows.filter((sale) => statusLabel(isVoidRow(sale) ? 'ANULADA' : sale.status) === statusPill) : rows;
  const sellerBase = statusOn ? sellerPool.filter((sale) => statusLabel(isVoidRow(sale) ? 'ANULADA' : sale.status) === statusPill) : sellerPool;
  const sellerOptions = sellerFilterOptions(sellerBase, commissionSellers);
  const shown = notices.prioritize(narrowed);
  const page = usePagedRows(shown, `${query}|${period}|${saleFilterKey(columns)}|${notices.key}|${statusOn ? statusPill : ''}`, undefined, 'Sales');
  const scope = useBulkScope();
  const selection = useBulkSelection(shown, scope);
  const payments = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cripto'];
  const statuses = [...new Set([...listed.map((sale) => isVoidRow(sale) ? 'ANULADA' : sale.status), 'COMPLETADA', 'PENDIENTE', 'ANULADA'])].filter(Boolean);

  const filtersOn = Boolean(query.trim()) || saleFiltersActive(columns) || statusOn || onlyUnassigned;
  const filteredTotal = money.sum(shown.filter(sale => !isVoidRow(sale)).map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const summaryText = filtersOn
    ? `${shown.length} de ${listed.length} ${listed.length === 1 ? 'venta' : 'ventas'} · ${filteredTotal == null ? '—' : money.showActive(filteredTotal)}`
    : `${shown.length} de ${listed.length}`;
  const clearFilters = () => {
    setColumns(EMPTY_SALE_FILTERS);
    setStatusPill('Todos');
    setQuery('');
    setOnlyUnassigned(false);
  };
  const quiet = !query.trim() && !saleFiltersActive(columns) && !statusOn;
  const marginPct = hasCost && margin != null && total ? Math.round((margin / total) * 100) : null;

  return (
    <div className={`dscreen mobile-list-screen sales-screen${phone ? ' has-dock' : ''}`} data-testid="sales-screen">
      <ScreenTitle
        title="Ventas"
        back={back}
        tools={<IconButton label="Buscar" name="buscar" pressed={searchOpen} onClick={() => setSearchOpen((current) => !current)} />}
        desktop={(
          <div className="dright">
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo o número" />
            <MenuButton label={period} options={PERIODS} value={period} onChange={(value) => setPeriod(value as PeriodKey)} />
            <ImportButton onClick={() => open({ type: 'import', kind: 'sale' })} />
            <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta>
          </div>
        )}
      />
      {phone && searchOpen ? <div className="msearch"><SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo o número" /></div> : null}
      {phone ? (
        <div className="dbar sale-pills">
          <MenuButton testId="sales-period" label={period} options={PERIODS} value={period} onChange={(value) => setPeriod(value as PeriodKey)} />
          <SellerChip phone label={sellerChipLabel(columns.sellers, sellerOptions, true)} active={columns.sellers.length > 0} onOpen={() => { setSellerDraft(columns.sellers); setSellerOpen(true); }} onClear={() => setColumn({ sellers: [] })} />
          <MenuButton testId="sales-status" label={statusPill === 'Todos' ? 'Estado' : statusPill} options={['Todos', 'Completada', 'Pendiente', 'Anulada']} value={statusPill} active={statusOn} onChange={setStatusPill} />
        </div>
      ) : null}
      {sellerOpen ? (
        <SellerSheet
          options={sellerOptions}
          draft={sellerDraft}
          count={salesMatchingSellers(sellerBase, sellerDraft).length}
          onToggle={(id) => setSellerDraft((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
          onClear={() => setSellerDraft([])}
          onApply={() => { setColumn({ sellers: sellerDraft }); setSellerOpen(false); }}
          onClose={() => setSellerOpen(false)}
        />
      ) : null}
      {onlyUnassigned ? <div className="commission-banner">Ventas sin vendedor{unassignedMonth ? ` de ${monthLabel(unassignedMonth)}` : ''}<button className="wlink" type="button" onClick={() => setOnlyUnassigned(false)}>Ver todas</button></div> : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      <PendingDrafts compact={phone} drafts={ownDrafts} hint="Podés retomarlos aunque hayas recargado la página." onOpen={(id) => open({ type: 'edit-cj', id, source: 'sales' })} />
      {phone && !selection.mode ? (
        <SalesHero
          seeFinancials={seeFinancials}
          total={total == null ? '—' : money.showActive(total)}
          approx={approxActive(total, money.active, sell)}
          staleClock={staleClock}
          count={periodSales.length}
          average={avg == null ? '—' : money.showActive(avg)}
          margin={hasCost && margin != null ? money.showActive(margin) : '—'}
          marginNote={hasCost ? (marginPct == null ? 'precio menos costo' : `≈ ${marginPct}%`) : 'Cargá el costo en el equipo'}
          delta={delta}
        />
      ) : phone ? null : (
      <div className="dstats">
        {seeFinancials ? <div className="dstat"><div className="eb">Facturación total</div><div className="big">{total == null ? '—' : money.showActive(total)}</div><span className="spill lime">{periodSales.length === 1 ? '1 venta' : `${periodSales.length} ventas`}</span></div> : null}
        <div className="dstat"><div className="eb">Ticket promedio</div><div className="big">{avg == null ? '—' : money.showActive(avg)}</div></div>
        {seeFinancials ? (
          <div className="dstat">
            <div className="eb">Margen bruto est.</div>
            <div className="big">{hasCost && margin != null ? money.showActive(margin) : '—'}</div>
            <small className="mut">{hasCost ? 'precio menos costo' : 'Cargá el costo en el equipo'}</small>
          </div>
        ) : null}
        <div className="dstat">
          <div className="eb">Variación</div>
          <div className="big">{delta == null ? '—' : <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>}</div>
          <small className="mut">vs período anterior</small>
        </div>
      </div>
      )}
      <BulkActions key={scope} selection={selection} total={shown.length}
        label={saleCode}
        action={{
          label: 'Anular',
          explanation: 'Se anulan las ventas seleccionadas y sus operaciones asociadas, incluidos los canjes. Se restauran stock y saldos según las reglas de cada operación; el historial se conserva en rojo.',
          execute: (sale, reason) => deleteSale(sale.id, reason),
          unavailable: (sale) => sale.voidedAt ? 'La selección incluye ventas ya anuladas.' : undefined,
        }}
      >
        {manageCommissions ? <button type="button" className="dbtn s" disabled={selection.locked || selection.selected.length === 0} onClick={() => setAssignOpen(true)}>Asignar vendedor</button> : null}
      </BulkActions>
      {assignOpen && manageCommissions ? <AssignSellerSheet saleIds={selection.selected.map(sale => sale.id)} subtitle={`${selection.selected.length === 1 ? '1 venta' : `${selection.selected.length} ventas`}: ${selection.selected.map(saleCode).join(', ')}`} onClose={() => setAssignOpen(false)} onSaved={() => { setAssignOpen(false); selection.clear(); }} /> : null}
      {phone && filtersOn ? <FilterSummary text={summaryText} onClear={clearFilters} /> : null}
      {phone ? (
        loadingLists ? <ListSkeleton variant="cards" rows={4} testId="sales-loading" /> : shown.length === 0 ? (
          listed.length === 0 && quiet ? <SalesEmpty onCreate={() => open({ type: 'new-sale' })} /> : <div className="wempty">No hay ventas con ese filtro.</div>
        ) : (
          <>
            {filtersOn ? null : <div className="sale-sec"><span>Ventas del período</span><span>{shown.length} de {listed.length}</span></div>}
            <div className="sale-line" data-testid="sales-timeline">
              {page.visible.map((sale) => {
                const reason = notices.reasonFor(sale.id);
                return (
                  <div key={sale.id} className={`sale-node${sale.status === 'PENDIENTE' ? ' pending' : ''}${isVoidRow(sale) ? ' cancelled' : ''}`}>
                    <PhoneRecord
                      selection={selection.row(sale.id, saleCode(sale))}
                      className={isVoidRow(sale) ? 'is-void' : undefined}
                      reason={reason}
                      onActivate={() => { open({ type: 'sale', id: sale.id }); }}
                      onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, onSelect: () => selection.start(sale.id), ...point })}
                    >
                      <SaleCard sale={sale} buyer={saleBuyer(sale, clients)} equipment={[saleEquipment(sale, inventory), soldQualityLabel(sale, inventory)].filter(Boolean).join(' · ')} sellerId={sale.sellerMemberId || 'none'} seller={sellerName(sale)} sellerRole={sellerRole(sale)} amount={money.show(sale.amount, sale.amountCurrency)} approx={approxUsd(sale.amount, sale.amountCurrency, money.active, sell)} />
                    </PhoneRecord>
                  </div>
                );
              })}
            </div>
            <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
          </>
        )
      ) : (
      <div className="dcard flush">
        <div className="dch pad">
          <h3>Ventas del período</h3>
          <span className="sale-filter-meta">
            {columns.sellers.length > 0 ? <SellerChip label={sellerChipLabel(columns.sellers, sellerOptions, false)} active onOpen={() => undefined} onClear={() => setColumn({ sellers: [] })} /> : null}
            <span className="mut" data-testid="sales-filter-summary">{summaryText}</span>
            {filtersOn ? <button className="wlink" type="button" onClick={clearFilters}>Limpiar filtros</button> : null}
          </span>
        </div>
        <table className="dtable">
            <thead>
              <tr>
                <th className="bulk-cell"><SelectFiltered selection={selection} total={shown.length} /></th>
                <th><span className="thf">Venta
                  <ColumnFilter label="venta" {...menu('venta')} active={saleColumnActive(columns, 'code')} onClear={() => setColumn({ code: '' })}>
                    <input aria-label="Contiene" placeholder="Número" value={columns.code} onChange={(event) => setColumn({ code: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Fecha
                  <ColumnFilter label="fecha" {...menu('fecha')} active={saleColumnActive(columns, 'date')} onClear={() => setColumn({ dateFrom: '', dateTo: '' })}>
                    <DateRange value={columns} onChange={setColumn} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Cliente
                  <ColumnFilter label="cliente" {...menu('cliente')} active={saleColumnActive(columns, 'client')} onClear={() => setColumn({ client: '' })}>
                    <input aria-label="Contiene" placeholder="Nombre" value={columns.client} onChange={(event) => setColumn({ client: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Equipo
                  <ColumnFilter label="equipo" {...menu('equipo')} active={saleColumnActive(columns, 'equipment')} onClear={() => setColumn({ equipment: '' })}>
                    <input aria-label="Contiene" placeholder="Modelo" value={columns.equipment} onChange={(event) => setColumn({ equipment: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Vendedor
                  <ColumnFilter label="vendedor" {...menu('vendedor')} active={saleColumnActive(columns, 'sellers')} onClear={() => setColumn({ sellers: [] })}>
                    <div className="opts">
                      {sellerOptions.map((option) => (
                        <label key={option.id} className="chk"><input type="checkbox" aria-label={option.name} checked={columns.sellers.includes(option.id)} onChange={() => toggleList('sellers', option.id)} /><span>{option.name}</span><em>{option.count}</em></label>
                      ))}
                    </div>
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Pago
                  <ColumnFilter label="pago" {...menu('pago')} active={saleColumnActive(columns, 'payments')} onClear={() => setColumn({ payments: [] })}>
                    <div className="opts">
                      {payments.map((label) => (
                        <label key={label} className="chk"><input type="checkbox" checked={columns.payments.includes(label)} onChange={() => toggleList('payments', label)} /><span>{label}</span></label>
                      ))}
                    </div>
                  </ColumnFilter>
                </span></th>
                <th className="r"><span className="thf">Total
                  <ColumnFilter label="total" align="right" {...menu('total')} active={saleColumnActive(columns, 'amount')} onClear={() => setColumn({ amountMin: '', amountMax: '' })}>
                    <MoneyRange min={columns.amountMin} max={columns.amountMax} onMin={(amountMin) => setColumn({ amountMin })} onMax={(amountMax) => setColumn({ amountMax })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Estado
                  <ColumnFilter label="estado" align="right" {...menu('estado')} active={saleColumnActive(columns, 'statuses')} onClear={() => setColumn({ statuses: [] })}>
                    <div className="opts">
                      {statuses.map((status) => (
                        <label key={status} className="chk"><input type="checkbox" checked={columns.statuses.includes(status)} onChange={() => toggleList('statuses', status)} /><span>{statusLabel(status)}</span></label>
                      ))}
                    </div>
                  </ColumnFilter>
                </span></th>
              </tr>
            </thead>
            <tbody>
              {page.visible.map((sale) => {
                return (
                  <PressTarget
                    selection={selection.row(sale.id, saleCode(sale))}
                    key={sale.id}
                    as="tr"
                    className={[notices.reasonFor(sale.id) ? 'novedad' : '', isVoidRow(sale) ? 'is-void' : ''].filter(Boolean).join(' ') || undefined}
                    onActivate={() => { open({ type: 'sale', id: sale.id }); }}
                    onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, onSelect: () => selection.start(sale.id), ...point })}
                  >
                    <td><b className="keep">#{saleCode(sale)}</b><NoticeTag reason={notices.reasonFor(sale.id)} /></td>
                    <td>{formatShortDate(sale.date)}</td>
                    <td>{saleBuyer(sale, clients)}</td>
                    <td>{saleEquipment(sale, inventory)}{soldQualityLabel(sale, inventory) ? <small>{soldQualityLabel(sale, inventory)}</small> : null}</td>
                    <td><div className="dcell"><CommissionAvatar id={sale.sellerMemberId || 'none'} name={sellerName(sale)} role={sellerRole(sale)} /><span>{sellerName(sale)}</span></div></td>
                    <td>{paymentLabel(sale.paymentMethod)}</td>
                    <td className="r"><b className="keep">{money.show(sale.amount, sale.amountCurrency)}</b></td>
                    <td><Pill status={isVoidRow(sale) ? 'ANULADA' : sale.status} kind="SALE_STATUS" /></td>
                  </PressTarget>
                );
              })}
            </tbody>
          </table>
        {loadingLists ? <ListSkeleton variant="rows" rows={6} testId="sales-loading" /> : shown.length === 0 ? <div className="wempty">{listed.length === 0 && !saleFiltersActive(columns) ? 'No encontré ventas.' : 'No hay ventas con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      )}
      {phone && !selection.mode ? <MobileDock primary="Registrar venta" onPrimary={() => open({ type: 'new-sale' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'sale' })} /> : null}
    </div>
  );
}

function SalesHero({ seeFinancials, total, approx, staleClock, count, average, margin, marginNote, delta }: {
  seeFinancials: boolean;
  total: string;
  approx: string | null;
  staleClock: string;
  count: number;
  average: string;
  margin: string;
  marginNote: string;
  delta: number | null;
}) {
  return (
    <section className="sale-hero" data-testid="sales-hero">
      {seeFinancials ? (
        <>
          <div className="eb">Facturación total</div>
          <div className="big">{total}</div>
          {approx ? <small className="sale-fx" data-testid="sales-usd">{approx}{staleClock ? ` · con el dólar de las ${staleClock}` : ''}</small> : null}
          <span className="spill lime">{count === 1 ? '1 venta' : `${count} ventas`}</span>
          <small className="sale-delta">{delta == null ? '— vs período anterior' : <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs período anterior</span>}</small>
        </>
      ) : <span className="spill lime">{count === 1 ? '1 venta' : `${count} ventas`}</span>}
      <div className={`sale-hero-grid${seeFinancials ? '' : ' solo'}`}>
        <div>
          <div className="eb">Ticket promedio</div>
          <div className="mid">{average}</div>
          <small>Por venta</small>
        </div>
        {seeFinancials ? (
          <div>
            <div className="eb">Margen bruto est.</div>
            <div className="mid">{margin}</div>
            <small>{marginNote}</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function soldQualityLabel(sale: Sale, inventory: { id: string; condition: string; grade: string }[]) {
  const product = sale.productId ? inventory.find((item) => item.id === sale.productId) : undefined;
  const value = product ? displayQuality(product.condition, product.grade) : '';
  return value ? `Calidad ${qualityDetail(value)}` : '';
}

function SaleCard({ sale, buyer, equipment, sellerId, seller, sellerRole, amount, approx }: {
  sale: Sale;
  buyer: string;
  equipment: string;
  sellerId: string;
  seller: string;
  sellerRole: 'OWNER' | 'MANAGER' | 'STAFF' | 'NONE';
  amount: string;
  approx: string | null;
}) {
  return (
    <span className="sale-card">
      <span className="sale-top">
        <span className="sale-id">#{saleCode(sale)} · {formatShortDate(sale.date)}</span>
        <Pill status={isVoidRow(sale) ? 'ANULADA' : sale.status} kind="SALE_STATUS" />
      </span>
      <span className="sale-who">
        <CommissionAvatar id={sellerId} name={seller} role={sellerRole} />
        <span>
          <b>{buyer}</b>
          <small>{equipment}</small>
        </span>
      </span>
      <span className="sale-bot"><span>{paymentLabel(sale.paymentMethod)}</span><span className="sale-amt"><b>{amount}</b>{approx ? <small>{approx}</small> : null}</span></span>
    </span>
  );
}

function FilterSummary({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <div className="sale-filter-line" data-testid="sales-filter-summary">
      <span>{text}</span>
      <button className="wlink" type="button" onClick={onClear}>Limpiar</button>
    </div>
  );
}

function SellerChip({ label, active, onOpen, onClear, phone = false }: {
  label: string;
  active: boolean;
  onOpen: () => void;
  onClear: () => void;
  phone?: boolean;
}) {
  if (!phone && !active) return null;
  return (
    <span className={`wchip seller-chip${active ? ' on' : ''}`}>
      <button type="button" data-testid="sales-seller-chip" onClick={phone ? onOpen : onClear}>{label}{active && !phone ? ' ×' : ''}</button>
      {phone && active ? <button type="button" aria-label="Quitar filtro de vendedor" onClick={onClear}>×</button> : null}
    </span>
  );
}

function SellerSheet({ options, draft, count, onToggle, onClear, onApply, onClose }: {
  options: { id: string; name: string; role: 'OWNER' | 'MANAGER' | 'STAFF' | 'NONE'; count: number }[];
  draft: string[];
  count: number;
  onToggle: (id: string) => void;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Vendedor" onClose={onClose} footer={(
      <div className="sacts">
        <button className="btn2 s" type="button" onClick={onClear}>Limpiar</button>
        <button className="btn2 p" type="button" onClick={onApply}>{count === 1 ? 'Ver 1 venta' : `Ver ${count} ventas`}</button>
      </div>
    )}>
      <div className="seller-sheet" data-testid="seller-sheet">
        {options.map((option) => (
          <label key={option.id} className="seller-opt">
            <CommissionAvatar id={option.id} name={option.name} role={option.role} />
            <span>{option.name}</span>
            <em>{option.count}</em>
            <input type="checkbox" checked={draft.includes(option.id)} onChange={() => onToggle(option.id)} />
          </label>
        ))}
      </div>
    </Sheet>
  );
}

function SalesEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="inv-empty" data-testid="sales-empty">
      <div className="inv-empty-box">
        <div className="inv-empty-mark"><ImanagerIcon name="vendido" size={24} /></div>
        <b>No hay ventas</b>
        <p>Todavía no registraste ventas en este período. Cargá la primera cuando cierres una operación.</p>
        <button className="dbtn p" type="button" onClick={onCreate}>
          <ImanagerIcon name="agregar" size={16} />
          Registrar venta
        </button>
      </div>
      <p className="inv-count">0 resultados</p>
    </div>
  );
}

function parseOk(value: string) {
  return /\d/.test(value);
}
