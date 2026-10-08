import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePhoneLayout, useSectionNotices } from '../section-notices';
import { NoticeTag, NoticesBar, PhoneRecord, PhoneRecords } from '../section-notice-view';
import { ColumnFilter } from '../ColumnFilter';
import {
  saleBuyer,
  formatInputMoney,
  formatMoney,
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
import { DeskCta, ImportButton, MenuButton, Pill, PressTarget, SearchBox, useDesk } from '../ui';

const PERIODS: PeriodKey[] = ['Semana', 'Mes', 'Año'];

export function SalesScreen() {
  const { sales, clients, inventory, operationDrafts = [] } = useAppContext();
  const { open } = useDesk();
  const phone = usePhoneLayout();
  const notices = useSectionNotices('sales');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('Mes');
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
  const total = periodSales.reduce((sum, sale) => sum + sale.amount, 0);
  const prevTotal = previous.reduce((sum, sale) => sum + sale.amount, 0);
  const avg = periodSales.length ? Math.round(total / periodSales.length) : 0;
  const cost = periodSales.reduce((sum, sale) => sum + (inventory.find((item) => item.id === sale.productId)?.cost ?? 0), 0);
  const hasCost = periodSales.some((sale) => (inventory.find((item) => item.id === sale.productId)?.cost ?? 0) > 0);
  const margin = total - cost;
  const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

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
  const shown = onlyNotices ? sales.filter((sale) => notices.reasonFor(sale.id)) : rows;
  const page = usePagedRows(shown, `${query}|${period}|${saleFilterKey(columns)}|${onlyNotices ? 'notices' : 'all'}`);
  const visibleKey = page.visible.map((sale) => sale.id).join('|');
  useEffect(() => { notices.markVisible(page.visible.map((sale) => sale.id)); }, [visibleKey, notices.markVisible]);
  const payments = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cripto'];
  const statuses = [...new Set([...listed.map((sale) => sale.status), 'COMPLETADA', 'PENDIENTE', 'CANCELADA'])].filter(Boolean);

  const subtitle = period === 'Semana' ? 'Esta semana' : period === 'Mes' ? 'Este mes' : 'Este año';

  return (
    <div className="dscreen">
      <div className="dtop">
        <div>
          <h1>Ventas</h1>
          <div className="dsub">{subtitle}</div>
        </div>
        <div className="dright">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, equipo o número" />
          <MenuButton label={period} options={PERIODS} value={period} onChange={(value) => setPeriod(value as PeriodKey)} />
          <ImportButton onClick={() => open({ type: 'import', kind: 'sale' })} />
          <DeskCta onClick={() => open({ type: 'new-sale' })}>Registrar venta</DeskCta>
        </div>
      </div>
      {draftError ? <div className="ferr">{draftError}</div> : null}
      {ownDrafts.length > 0 ? (
        <div className="dcard op-drafts">
          <div><b>Canjes pendientes de confirmar</b><small>Podés retomarlos aunque hayas recargado la página.</small></div>
          <div className="op-draft-list">{ownDrafts.map((trade) => (
            <button key={trade.id} type="button" onClick={() => open({ type: 'edit-cj', id: trade.id, source: 'sales' })}>
              <span>{trade.clientName || 'Cliente por completar'} · {trade.deviceReceived || 'Equipo recibido'}</span><b>Retomar</b>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="dstats">
        <div className="dstat"><div className="eb">Facturación total</div><div className="big">{formatMoney(total)}</div><span className="spill lime">{periodSales.length} ventas</span></div>
        <div className="dstat"><div className="eb">Ticket promedio</div><div className="big">{formatMoney(avg)}</div></div>
        <div className="dstat">
          <div className="eb">Margen bruto est.</div>
          <div className="big">{hasCost ? formatMoney(margin) : '—'}</div>
          <small className="mut">{hasCost ? 'precio menos costo' : 'Cargá el costo en el equipo'}</small>
        </div>
        <div className="dstat">
          <div className="eb">Variación</div>
          <div className="big">{delta == null ? '—' : <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>}</div>
          <small className="mut">vs período anterior</small>
        </div>
      </div>
      <NoticesBar count={notices.count} active={onlyNotices} onToggle={() => setOnlyNotices((current) => !current)} />
      <div className="dcard flush">
        <div className="dch pad"><h3>Ventas del período</h3><span className="mut">{shown.length} de {listed.length}</span>{saleFiltersActive(columns) ? <button className="wlink" type="button" onClick={() => setColumns(EMPTY_SALE_FILTERS)}>Limpiar filtros</button> : null}</div>
        {phone ? (
          <PhoneRecords>
            {page.visible.map((sale) => {
              const reason = notices.reasonFor(sale.id);
              return (
                <PhoneRecord
                  key={sale.id}
                  reason={reason}
                  onActivate={() => { notices.markVisible([sale.id]); open({ type: 'sale', id: sale.id }); }}
                  onMenu={(point) => open({ type: 'ctx', kind: 'sale', id: sale.id, label: `${saleCode(sale)} · ${saleBuyer(sale, clients)}`, ...point })}
                >
                  <b>#{saleCode(sale)} · {saleBuyer(sale, clients)}</b>
                  <small>{saleEquipment(sale, inventory)} · {formatMoney(sale.amount)}</small>
                </PhoneRecord>
              );
            })}
          </PhoneRecords>
        ) : (
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
                    <td>{saleEquipment(sale, inventory)}</td>
                    <td>{paymentLabel(sale.paymentMethod)}</td>
                    <td className="r"><b>{formatMoney(sale.amount)}</b></td>
                    <td><Pill status={sale.status} kind="SALE_STATUS" /></td>
                  </PressTarget>
                );
              })}
            </tbody>
          </table>
        )}
        {shown.length === 0 ? <div className="wempty">{listed.length === 0 && !saleFiltersActive(columns) && !onlyNotices ? 'No encontré ventas.' : 'No hay ventas con ese filtro.'}</div> : null}
        <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
      </div>
    </div>
  );
}

function parseOk(value: string) {
  return /\d/.test(value);
}
