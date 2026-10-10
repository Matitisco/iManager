import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, NoticesBar, PhoneRecord } from '../section-notice-view';
import { ColumnFilter } from '../ColumnFilter';
import { approxActive, approxUsd, useDisplayQuote, useMoney } from '../exchange';
import {
  saleBuyer,
  formatInputMoney,
  formatShortDate,
  inPeriod,
  parseMoney,
  paymentLabel,
  periodBounds,
  saleCode,
  saleEquipment,
  statusLabel,
  type PeriodKey,
} from '../format';
import { displayQuality, qualityDetail } from '../quality';
import { useOperationDraftError } from '../operation-drafts';
import { TablePager, usePagedRows } from '../pager';
import {
  EMPTY_SALE_FILTERS,
  matchesSaleColumns,
  saleColumnActive,
  saleFilterKey,
  saleFiltersActive,
  type SaleColumnFilters,
} from '../sale-column-filters';
import { canSeeFinancials } from '../sections';
import { ImanagerIcon } from '../icons';
import { DeskCta, IconButton, ImportButton, MenuButton, MobileDock, Pill, PressTarget, ScreenTitle, SearchBox, useDesk } from '../ui';
import type { Sale } from '../../types';

const PERIODS: PeriodKey[] = ['Semana', 'Mes', 'Año'];

export function SalesScreen() {
  const { sales, clients, inventory, operationDrafts = [], appSession } = useAppContext();
  const money = useMoney();
  const { sell, staleClock } = useDisplayQuote();
  const seeFinancials = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const { open, back } = useDesk();
  const phone = usePhoneLayout();
  const [searchOpen, setSearchOpen] = useState(false);
  const notices = useSectionNotices('sales');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('Mes');
  const [statusPill, setStatusPill] = useState('Todos');
  const [columns, setColumns] = useState<SaleColumnFilters>(EMPTY_SALE_FILTERS);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const draftError = useOperationDraftError('sales');
  const ownDrafts = operationDrafts.filter((trade) => trade.operationSource === 'sales' && trade.confirmationStatus === 'PENDING');
  const bounds = periodBounds(period);

  const inWindow = (sale: { date: string }) => (parseOk(sale.date) ? inPeriod(sale.date, bounds.start, bounds.end) : period === 'Mes');
  const periodSales = useMemo(
    () => sales.filter((sale) => sale.status !== 'CANCELADA' && inWindow(sale)),
    [sales, bounds.start, bounds.end, period],
  );
  const listed = useMemo(() => sales.filter((sale) => inWindow(sale)), [sales, bounds.start, bounds.end, period]);
  const previous = sales.filter((sale) => sale.status !== 'CANCELADA' && inPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
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
  const toggleList = (key: 'payments' | 'statuses', value: string) => setColumns((current) => ({
    ...current,
    [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
  }));
  const rows = listed.filter((sale) => {
    const q = query.trim().toLowerCase();
    const labels = { client: saleBuyer(sale, clients), equipment: saleEquipment(sale, inventory) };
    if (q && !`${labels.client} ${labels.equipment} ${saleCode(sale)}`.toLowerCase().includes(q)) return false;
    return matchesSaleColumns(sale, columns, labels);
  });
  const statusOn = phone && statusPill !== 'Todos';
  const narrowed = statusOn ? rows.filter((sale) => statusLabel(sale.status) === statusPill) : rows;
  const shown = onlyNotices ? sales.filter((sale) => notices.reasonFor(sale.id)) : narrowed;
  const page = usePagedRows(shown, `${query}|${period}|${saleFilterKey(columns)}|${onlyNotices ? 'notices' : 'all'}|${statusOn ? statusPill : ''}`);
  const visibleKey = page.visible.map((sale) => sale.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((sale) => sale.id)); }, [visibleKey, notices.markVisible]);
  const payments = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cripto'];
  const statuses = [...new Set([...listed.map((sale) => sale.status), 'COMPLETADA', 'PENDIENTE', 'CANCELADA'])].filter(Boolean);

  const subtitle = period === 'Semana' ? 'Esta semana' : period === 'Mes' ? 'Este mes' : 'Este año';
  const quiet = !query.trim() && !saleFiltersActive(columns) && !onlyNotices && !statusOn;
  const marginPct = hasCost && margin != null && total ? Math.round((margin / total) * 100) : null;

  return (
    <div className={`dscreen${phone ? ' has-dock' : ''}`}>
      <ScreenTitle
        title="Ventas"
        subtitle={subtitle}
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
          <MenuButton testId="sales-status" label={statusPill === 'Todos' ? 'Estado' : statusPill} options={['Todos', 'Completada', 'Pendiente', 'Cancelada']} value={statusPill} active={statusOn} onChange={setStatusPill} />
        </div>
      ) : null}
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className={`dcard op-drafts${phone ? ' compact' : ''}`}>
          <div><b>Canjes pendientes de confirmar</b><small>Podés retomarlos aunque hayas recargado la página.</small></div>
          <div className="op-draft-list">{ownDrafts.map((trade) => (
            <button key={trade.id} type="button" onClick={() => open({ type: 'edit-cj', id: trade.id, source: 'sales' })}>
              <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
            </button>
          ))}</div>
        </div>
      ) : null}
      {phone ? (
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
      ) : (
      <div className="dstats">
        {seeFinancials ? <div className="dstat"><div className="eb">Facturación total</div><div className="big">{total == null ? '—' : money.showActive(total)}</div><span className="spill lime">{periodSales.length} ventas</span></div> : null}
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
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
      {phone ? (
        shown.length === 0 ? (
          listed.length === 0 && quiet ? <SalesEmpty onCreate={() => open({ type: 'new-sale' })} /> : <div className="wempty">No hay ventas con ese filtro.</div>
        ) : (
          <>
            <div className="sale-sec"><span>Ventas del período</span><span>{shown.length} de {listed.length}</span></div>
            <div className="sale-line" data-testid="sales-timeline">
              {page.visible.map((sale) => {
                const reason = notices.reasonFor(sale.id);
                return (
                  <div key={sale.id} className={`sale-node${sale.status === 'PENDIENTE' ? ' pending' : ''}${sale.status === 'CANCELADA' ? ' cancelled' : ''}`}>
                    <PhoneRecord
                      reason={reason}
                      onActivate={() => { notices.markVisible([sale.id]); open({ type: 'sale', id: sale.id }); }}
                      onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}
                    >
                      <SaleCard sale={sale} buyer={saleBuyer(sale, clients)} equipment={[saleEquipment(sale, inventory), soldQualityLabel(sale, inventory)].filter(Boolean).join(' · ')} amount={money.show(sale.amount, sale.amountCurrency)} approx={approxUsd(sale.amount, sale.amountCurrency, money.active, sell)} />
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
        <div className="dch pad"><h3>Ventas del período</h3><span className="mut">{shown.length} de {listed.length}</span>{saleFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_SALE_FILTERS)}>Limpiar filtros</button> : null}</div>
        <table className="dtable">
            <thead>
              <tr>
                <th><span className="thf">Venta
                  <ColumnFilter label="venta" open={openColumn === 'venta'} onToggle={() => setOpenColumn((current) => current === 'venta' ? null : 'venta')} active={saleColumnActive(columns, 'code')} onClear={() => setColumn({ code: '' })}>
                    <input aria-label="Contiene" placeholder="Número" value={columns.code} onChange={(event) => setColumn({ code: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Fecha
                  <ColumnFilter label="fecha" open={openColumn === 'fecha'} onToggle={() => setOpenColumn((current) => current === 'fecha' ? null : 'fecha')} active={saleColumnActive(columns, 'date')} onClear={() => setColumn({ dateFrom: '', dateTo: '' })}>
                    <div className="range">
                      <label><span>Desde</span><input aria-label="Desde" placeholder="dd/mm/aaaa" value={columns.dateFrom} onChange={(event) => setColumn({ dateFrom: event.target.value })} /></label>
                      <label><span>Hasta</span><input aria-label="Hasta" placeholder="dd/mm/aaaa" value={columns.dateTo} onChange={(event) => setColumn({ dateTo: event.target.value })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Cliente
                  <ColumnFilter label="cliente" open={openColumn === 'cliente'} onToggle={() => setOpenColumn((current) => current === 'cliente' ? null : 'cliente')} active={saleColumnActive(columns, 'client')} onClear={() => setColumn({ client: '' })}>
                    <input aria-label="Contiene" placeholder="Nombre" value={columns.client} onChange={(event) => setColumn({ client: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Equipo
                  <ColumnFilter label="equipo" open={openColumn === 'equipo'} onToggle={() => setOpenColumn((current) => current === 'equipo' ? null : 'equipo')} active={saleColumnActive(columns, 'equipment')} onClear={() => setColumn({ equipment: '' })}>
                    <input aria-label="Contiene" placeholder="Modelo" value={columns.equipment} onChange={(event) => setColumn({ equipment: event.target.value })} />
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Pago
                  <ColumnFilter label="pago" open={openColumn === 'pago'} onToggle={() => setOpenColumn((current) => current === 'pago' ? null : 'pago')} active={saleColumnActive(columns, 'payments')} onClear={() => setColumn({ payments: [] })}>
                    <div className="opts">
                      {payments.map((label) => (
                        <label key={label} className="chk"><input type="checkbox" checked={columns.payments.includes(label)} onChange={() => toggleList('payments', label)} />{label}</label>
                      ))}
                    </div>
                  </ColumnFilter>
                </span></th>
                <th className="r"><span className="thf">Total
                  <ColumnFilter label="total" align="right" open={openColumn === 'total'} onToggle={() => setOpenColumn((current) => current === 'total' ? null : 'total')} active={saleColumnActive(columns, 'amount')} onClear={() => setColumn({ amountMin: '', amountMax: '' })}>
                    <div className="range">
                      <label><span>Mínimo</span><input aria-label="Mínimo" inputMode="numeric" value={columns.amountMin ? formatInputMoney(parseMoney(columns.amountMin)) : ''} onChange={(event) => setColumn({ amountMin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                      <label><span>Máximo</span><input aria-label="Máximo" inputMode="numeric" value={columns.amountMax ? formatInputMoney(parseMoney(columns.amountMax)) : ''} onChange={(event) => setColumn({ amountMax: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></label>
                    </div>
                  </ColumnFilter>
                </span></th>
                <th><span className="thf">Estado
                  <ColumnFilter label="estado" align="right" open={openColumn === 'estado'} onToggle={() => setOpenColumn((current) => current === 'estado' ? null : 'estado')} active={saleColumnActive(columns, 'statuses')} onClear={() => setColumn({ statuses: [] })}>
                    <div className="opts">
                      {statuses.map((status) => (
                        <label key={status} className="chk"><input type="checkbox" checked={columns.statuses.includes(status)} onChange={() => toggleList('statuses', status)} />{statusLabel(status)}</label>
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
                    key={sale.id}
                    as="tr"
                    className={notices.reasonFor(sale.id) ? 'novedad' : undefined}
                    onActivate={() => { notices.markVisible([sale.id]); open({ type: 'sale', id: sale.id }); }}
                    onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}
                  >
                    <td><b>#{saleCode(sale)}</b><NoticeTag reason={notices.reasonFor(sale.id)} /></td>
                    <td>{formatShortDate(sale.date)}</td>
                    <td>{saleBuyer(sale, clients)}</td>
                    <td>{saleEquipment(sale, inventory)}{soldQualityLabel(sale, inventory) ? <small>{soldQualityLabel(sale, inventory)}</small> : null}</td>
                    <td>{paymentLabel(sale.paymentMethod)}</td>
                    <td className="r"><b>{money.show(sale.amount, sale.amountCurrency)}</b></td>
                    <td><Pill status={sale.status} kind="SALE_STATUS" /></td>
                  </PressTarget>
                );
              })}
            </tbody>
          </table>
        {shown.length === 0 ? <div className="wempty">{listed.length === 0 && !saleFiltersActive(columns) && !onlyNotices ? 'No encontré ventas.' : 'No hay ventas con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
      )}
      {phone ? <MobileDock primary="Registrar venta" onPrimary={() => open({ type: 'new-sale' })} secondary="Importar" onSecondary={() => open({ type: 'import', kind: 'sale' })} /> : null}
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

function SaleCard({ sale, buyer, equipment, amount, approx }: { sale: Sale; buyer: string; equipment: string; amount: string; approx: string | null }) {
  return (
    <span className="sale-card">
      <span className="sale-top">
        <span className="sale-id">#{saleCode(sale)} · {formatShortDate(sale.date)}</span>
        <Pill status={sale.status} kind="SALE_STATUS" />
      </span>
      <b>{buyer}</b>
      <small>{equipment}</small>
      <span className="sale-bot"><span>{paymentLabel(sale.paymentMethod)}</span><span className="sale-amt"><b>{amount}</b>{approx ? <small>{approx}</small> : null}</span></span>
    </span>
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
