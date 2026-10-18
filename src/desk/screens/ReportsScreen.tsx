import { toUserMessage } from '../../lib/user-message';
import { useOfflineRecovery } from '../../lib/offline-recovery';
import { fetchCommissionReport } from '../../services/commissions-api';
import type { CommissionReport } from '../../types/commissions';
import { commissionTotal, monthKey, saleCount } from '../commissions';
import { downloadCsv } from '../csv';
import { useEffect, useMemo, useState } from 'react';
import type { Client, CustomColumn, Product, RepairOrder, Sale, TradeIn } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useMoney } from '../exchange';
import { fitDonutText, fitDonutValue } from '../donut-label';
import {
  saleBuyer,
  conditionLabel,
  equipmentTitle,
  isInStock,
  isInProgressTrade,
  periodBounds,
  saleEquipment,
  saleCode,
  statusLabel,
  tradeClientLabel,
  tradeCode,
  type PeriodKey,
} from '../format';
import { qualityPhrase } from '../quality';
import {
  averageLeadDays,
  breakdownCatalog,
  breakdownTitle,
  buildClientReport,
  clientBreakdownLabel,
  DEFAULT_DIMENSION,
  dimensionsFor,
  groupBreakdown,
  leadTimeLabel,
  matchesBreakdown,
  repairLeadDays,
  REPORT_TABS,
  saleBreakdownLabel,
  serviceBreakdownLabel,
  stockBreakdownLabel,
  tradeBreakdownLabel,
  type ReportTab,
} from '../report-breakdown';
import {
  addToReportBucket,
  customReportBounds,
  defaultReportRange,
  formatReportDate,
  inReportPeriod,
  makeReportBuckets,
  parseReportDate,
  reportRangeLabel,
  type ReportBounds,
  type ReportPeriod,
} from '../report-period';
import { usePhoneLayout } from '../section-notices';
import { canManageCommissions, canOpenSection } from '../sections';
import { Actions, Pill, ScreenTitle, Sheet, useDesk } from '../ui';
import { ReportDatePicker } from '../report-date-picker';
import { DeskSelect } from '../select';

const PERIODS: PeriodKey[] = ['Semana', 'Mes', '3 meses', 'Año'];
const PERIOD_LABEL: Record<PeriodKey, string> = {
  Semana: 'últimos 7 días',
  Mes: 'últimos 30 días',
  '3 meses': 'últimos 3 meses',
  Año: 'últimos 12 meses',
};

export function ReportsScreen() {
  const {
    sales,
    inventory,
    tradeIns,
    clients,
    repairOrders = [],
    clientCategories = [],
    customColumns = [],
    appSession,
    user,
  } = useAppContext();
  const money = useMoney();
  const phone = usePhoneLayout();
  const { open, toast } = useDesk();
  const sections = appSession?.membership?.sections;
  const role = appSession?.membership?.role;
  const tabs = useMemo(() => REPORT_TABS.filter((item) => {
    if (item === 'Comisiones') return canManageCommissions(sections, role);
    if (item === 'Ventas') return canOpenSection('sales', sections, role);
    if (item === 'Stock') return canOpenSection('inventory', sections, role);
    if (item === 'Canjes') return canOpenSection('tradeins', sections, role);
    if (item === 'Clientes') return canOpenSection('clients', sections, role);
    if (item === 'Servicio') return canOpenSection('service', sections, role);
    return true;
  }), [sections, role]);
  const [tab, setTab] = useState<ReportTab>('Ventas');
  const activeTab = tabs.includes(tab) ? tab : tabs[0] ?? 'Ventas';
  const [period, setPeriod] = useState<ReportPeriod>('Mes');
  const [customOpen, setCustomOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(defaultReportRange);
  const [customBounds, setCustomBounds] = useState<ReportBounds | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [dimensionByTab, setDimensionByTab] = useState<Partial<Record<ReportTab, string>>>({});
  const bounds = useMemo(() => period === 'Personalizado' && customBounds ? customBounds : periodBounds(period === 'Personalizado' ? 'Mes' : period), [period, customBounds]);
  const periodData = useMemo(() => ({
    sales: sales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.start, bounds.end)),
    inventory: inventory.filter((item) => inReportPeriod(item.createdAt, bounds.start, bounds.end)),
    tradeIns: tradeIns.filter((item) => inReportPeriod(item.date, bounds.start, bounds.end)),
    repairs: repairOrders.filter((order) => inReportPeriod(order.receivedAt, bounds.start, bounds.end)),
  }), [sales, inventory, tradeIns, repairOrders, bounds]);

  const salesValue = money.sum(periodData.sales.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const projectedSales = periodData.sales.map((sale) => ({
    ...sale,
    amount: salesValue == null ? 0 : (money.number(sale.amount, sale.amountCurrency) ?? 0),
  }));
  const projectedHistory = sales.map((sale) => ({
    ...sale,
    amount: money.number(sale.amount, sale.amountCurrency) ?? 0,
  }));
  const clientReport = buildClientReport({
    clients,
    categories: clientCategories,
    sales,
    bounds,
    project: (amount, currency) => money.number(amount, currency),
  });
  const serviceBilling = money.sum(periodData.repairs.filter((order) => order.estimate != null).map((order) => ({ amount: order.estimate ?? 0, currency: order.currency })));
  const dimensions = dimensionsFor(activeTab, customColumns);
  const dimension = dimensions.some((item) => item.id === dimensionByTab[activeTab]) ? dimensionByTab[activeTab]! : DEFAULT_DIMENSION[activeTab];
  const [commissionReport, setCommissionReport] = useState<{ key: string; data: CommissionReport } | null>(null);
  const [commissionReportError, setCommissionReportError] = useState('');
  const [commissionReportLoading, setCommissionReportLoading] = useState(false);
  const [commissionReportRetry, setCommissionReportRetry] = useState(0);
  useOfflineRecovery(commissionReportError, () => setCommissionReportRetry(value => value + 1));
  const commissionFrom = monthKey(bounds.start, appSession?.store?.timezone);
  const commissionTo = monthKey(bounds.end, appSession?.store?.timezone);
  const commissionReportKey = `${appSession?.store?.id}:${appSession?.user?.id}:${role}:${JSON.stringify(sections)}:${commissionFrom}:${commissionTo}`;
  const commissionRows = commissionReport?.key === commissionReportKey ? commissionReport.data.rows : [];
  useEffect(() => {
    if (activeTab !== 'Comisiones' || !user) return;
    let active = true; setCommissionReportLoading(true); setCommissionReportError('');
    void fetchCommissionReport(user, commissionFrom, commissionTo).then(data => { if (!Array.isArray(data.rows)) throw new Error('Respuesta inválida del reporte de comisiones'); if (active) setCommissionReport({ key: commissionReportKey, data }); }).catch((cause: unknown) => { if (active) setCommissionReportError(toUserMessage(cause, 'No se pudo cargar el reporte de comisiones')); }).finally(() => { if (active) setCommissionReportLoading(false); });
    return () => { active = false; };
  }, [activeTab, commissionReportKey, user, commissionReportRetry]);
  const baseModel = buildReport(activeTab, period, bounds, dimension, dimensions, {
    sales: projectedSales,
    inventory: periodData.inventory,
    tradeIns: periodData.tradeIns,
    clients,
    repairs: periodData.repairs.map((order) => ({
      ...order,
      chartValue: serviceBilling == null ? 1 : (order.estimate == null ? 0 : (money.number(order.estimate, order.currency) ?? 0)),
    })),
    clientRows: clientReport.rows,
    altas: clientReport.altas,
    recurrentes: clientReport.recurrentes,
    serviceBilling,
    salesValue,
    customColumns,
  }, projectedHistory);
  const commissionTotalValue = commissionRows.reduce((sum, row) => sum + row.converted.earned[money.active], 0);
  const commissionMonths = [...new Set(commissionRows.map(row => row.period))].sort();
  const model = activeTab === 'Comisiones' ? {
    ...baseModel, eye: 'Comisiones generadas', total: commissionTotalValue, headline: commissionTotalValue,
    barMoney: true, donutMoney: true, donutTotal: commissionTotalValue, unavailable: commissionReportLoading || Boolean(commissionReportError),
    delta: 'Liquidación mensual', note: 'Los montos se convierten con la cotización guardada en cada venta; las ventas viejas, con la de hoy. Este resumen incluye los meses del período. Exportás este resumen con el botón de arriba.',
    bucketLabel: 'Por mes', buckets: commissionMonths.map(period => ({ label: period, value: commissionRows.filter(row => row.period === period).reduce((sum, row) => sum + row.converted.earned[money.active], 0) })),
    donutTitle: 'Por vendedor', ...groupBreakdown(commissionRows.map(row => ({ label: row.name, value: row.converted.earned[money.active] }))),
  } : baseModel;
  const active = selected != null && selected < model.buckets.length ? selected : model.buckets.length - 1;
  const max = Math.max(...model.buckets.map((bucket) => bucket.value), 1);
  const saleLabel = (sale: Sale) => saleBreakdownLabel(sale, activeTab === 'Ventas' ? dimension : 'payment', inventory, customColumns);
  const stockLabel = (item: Product) => stockBreakdownLabel(item, activeTab === 'Stock' ? dimension : 'status');
  const tradeLabel = (item: TradeIn) => tradeBreakdownLabel(item, activeTab === 'Canjes' ? dimension : 'status', tradeClientLabel(item, clients));
  const saleRows = periodData.sales.filter((sale) => activeTab !== 'Ventas' || matchesBreakdown(saleLabel(sale), cat, model.otherLabels));
  const stockRows = periodData.inventory.filter((item) => activeTab !== 'Stock' || matchesBreakdown(stockLabel(item), cat, model.otherLabels));
  const tradeRows = periodData.tradeIns.filter((item) => activeTab !== 'Canjes' || matchesBreakdown(tradeLabel(item), cat, model.otherLabels));
  const clientRows = clientReport.rows.filter((row) => activeTab !== 'Clientes' || matchesBreakdown(clientBreakdownLabel(row, dimension), cat, model.otherLabels));
  const repairRows = periodData.repairs.filter((order) => activeTab !== 'Servicio' || matchesBreakdown(serviceBreakdownLabel(order, dimension), cat, model.otherLabels));
  const undatedStock = inventory.filter((item) => !parseReportDate(item.createdAt)).length;

  const commitRange = () => {
    const result = customReportBounds(draftRange.startDate, draftRange.endDate);
    if (!result.bounds) {
      setRangeError(result.error);
      return;
    }
    setCustomBounds(result.bounds);
    setPeriod('Personalizado');
    setRangeError(null);
    setSelected(null);
    setCat(null);
    if (phone) setCustomOpen(false);
  };

  const applyCustomRange = (event: React.FormEvent) => {
    event.preventDefault();
    commitRange();
  };

  const closeCustom = () => {
    setCustomOpen(false);
    setRangeError(null);
  };

  const exportReport = () => {
    const rows: string[][] = [['detalle', 'importe', 'Moneda', 'estado']];
    const moneyCells = (amount: number, currency?: string | null): [string, string] => {
      const shown = money.shown(amount, currency);
      return [shown.text, shown.currency];
    };
    if (activeTab === 'Comisiones') {
      const rows = [['Período', 'Vendedor', 'Ventas', 'Comisión ARS', 'Comisión USD', 'Pagado ARS', 'Pagado USD', 'Pendiente ARS', 'Pendiente USD', 'Ajustes ARS', 'Ajustes USD']];
      commissionRows.forEach(row => rows.push([row.period, row.name, String(row.salesCount), String(row.earned.ARS), String(row.earned.USD), String(row.paid.ARS), String(row.paid.USD), String(row.pending.ARS), String(row.pending.USD), String(row.adjustmentsTotal.ARS), String(row.adjustmentsTotal.USD)]));
      downloadCsv(rows, 'reporte-comisiones.csv'); toast('Reporte de comisiones exportado'); return;
    }
    if (activeTab === 'Ventas') {
      saleRows.forEach((sale) => {
        rows.push([`${saleCode(sale)} ${saleBuyer(sale, clients)}`, ...moneyCells(sale.amount, sale.amountCurrency), statusLabel(sale.status)]);
      });
    } else if (activeTab === 'Stock') {
      stockRows.forEach((item) => rows.push([`${item.model} ${item.capacity}`, ...moneyCells(item.price, item.currency), statusLabel(item.status)]));
    } else if (activeTab === 'Canjes') {
      tradeRows.forEach((item) => {
        rows.push([`${tradeCode(tradeIns, item.id)} ${tradeClientLabel(item, clients)}`, ...moneyCells(item.differencePaid, item.currency), statusLabel(item.status)]);
      });
    } else if (activeTab === 'Clientes') {
      clientRows.forEach((row) => rows.push([row.name, ...(row.blocked ? ['', ''] as [string, string] : [money.showActive(row.revenue), money.active]), row.kind]));
    } else {
      repairRows.forEach((order) => {
        rows.push([`${order.code} ${order.clientName}`, ...(order.estimate == null ? ['', ''] as [string, string] : moneyCells(order.estimate, order.currency)), statusLabel(order.status)]);
      });
    }
    downloadCsv(rows, `reporte-${activeTab.toLowerCase()}.csv`);
    toast(`Reporte de ${activeTab.toLowerCase()} exportado`);
  };

  const customPressed = phone ? period === 'Personalizado' || customOpen : customOpen;
  const activeBucket = active >= 0 ? model.buckets[active] : undefined;
  const figure = (value: number) => (model.barMoney ? (model.unavailable ? '—' : money.compactActive(value)) : value);
  const figureFull = (value: number) => (model.barMoney ? (model.unavailable ? 'sin cotización' : money.showActive(value)) : value);
  const exportButton = (
    <button className="circ" type="button" aria-label="Exportar" disabled={activeTab === 'Comisiones' && (commissionReportLoading || Boolean(commissionReportError) || commissionReport?.key !== commissionReportKey)} onClick={exportReport}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16181D" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
    </button>
  );
  const rangePickers = (
    <>
      <ReportDatePicker label="Fecha de inicio" value={draftRange.startDate} invalid={!!rangeError} describedBy={rangeError ? 'report-range-error' : undefined} panel={phone ? 'inline' : 'float'} onChange={(value) => { setDraftRange((current) => ({ ...current, startDate: value })); setRangeError(null); }} />
      <ReportDatePicker label="Fecha de fin" value={draftRange.endDate} invalid={!!rangeError} describedBy={rangeError ? 'report-range-error' : undefined} panel={phone ? 'inline' : 'float'} onChange={(value) => { setDraftRange((current) => ({ ...current, endDate: value })); setRangeError(null); }} />
    </>
  );
  const chooseTab = (item: ReportTab) => {
    setTab(item);
    setSelected(null);
    setCat(null);
  };

  if (!tabs.length) return <div className="dscreen"><ScreenTitle title="Reportes" desktop={null} /><div className="card team-empty"><h2>No hay secciones habilitadas para tus reportes</h2><p>Cuando tengas acceso a una sección, vas a poder consultar sus reportes acá.</p></div></div>;

  return (
    <div className={`dscreen reports-screen${activeTab === 'Comisiones' ? ' commission-report' : ''}`}>
      <ScreenTitle title="Reportes" tools={exportButton} desktop={exportButton} />
      <div className="gfilters">
        <div role="group" aria-label="Tipo de reporte">{tabs.map((item) => <button key={item} className={`gchip${activeTab === item ? ' on' : ''}`} aria-pressed={activeTab === item} type="button" onClick={() => chooseTab(item)}>{item}</button>)}</div>
        <div className="gperiods" role="group" aria-label="Período">
          {PERIODS.map((item) => <button key={item} className={`gchip sm${period === item && !customOpen ? ' on' : ''}`} aria-pressed={period === item && !customOpen} type="button" onClick={() => { setPeriod(item); setCustomOpen(false); setRangeError(null); setSelected(null); setCat(null); }}>{item}</button>)}
          <button className={`gchip sm${customPressed ? ' on' : ''}`} aria-pressed={customPressed} aria-expanded={customOpen} aria-controls="report-custom-range" type="button" onClick={() => setCustomOpen(true)}>Personalizado</button>
        </div>
      </div>
      {customOpen && !phone && (
        <form id="report-custom-range" className="grange" noValidate onSubmit={applyCustomRange}>
          {rangePickers}
          <button className="gapply" type="submit">Aplicar período</button>
          {rangeError && <p id="report-range-error" className="ferr" role="alert">{rangeError}</p>}
        </form>
      )}
      {customOpen && phone && (
        <Sheet title="Período personalizado" subtitle="Elegí el inicio y el fin del reporte." onClose={closeCustom} className="report-range">
          <div id="report-custom-range">
            {rangePickers}
            {rangeError && <p id="report-range-error" className="ferr" role="alert">{rangeError}</p>}
          </div>
          <Actions primary="Aplicar período" onPrimary={commitRange} onSecondary={closeCustom} />
        </Sheet>
      )}
      {activeTab === 'Comisiones' && commissionReportError ? <p className="ferr" role="alert">{commissionReportError}</p> : null}
      {activeTab === 'Comisiones' && commissionReportLoading ? <p role="status">Cargando reporte…</p> : null}
      <div className="gtotal">
        <div className="geye">{model.eye} · {period === 'Personalizado' ? reportRangeLabel(bounds) : PERIOD_LABEL[period]}</div>
        <div className="gamount">{model.unavailable ? '—' : model.barMoney ? money.showActive(model.headline) : model.total}</div>
        <span className="gdelta">{model.delta}</span>
      </div>
      {model.note ? <p className="gnote">{model.note}</p> : null}
      <div className="repgrid">
        <div className="gcard">
          <div className="ghd"><h3>Evolución</h3><span>{model.bucketLabel}</span></div>
          {phone && activeBucket ? (
            <div className="gnow">
              <span>
                <b>{figure(activeBucket.value)}</b>
                {` · ${activeBucket.label}`}
              </span>
            </div>
          ) : null}
          <div className="gbars">
            {model.buckets.map((bucket, index) => {
              const height = Math.max(3, Math.round((bucket.value / max) * 96));
              return (
                <button key={`${bucket.label}-${index}`} className={`gcol${index === active ? ' sel' : ''}`} aria-label={`${bucket.label}: ${figureFull(bucket.value)}`} type="button" onClick={() => setSelected(index)}>
                  {index === active ? (
                    <span className={`gtip${index < 2 ? ' tl' : index > model.buckets.length - 3 ? ' tr' : ''}`}>
                      <b>{figure(bucket.value)}</b>
                      {` · ${bucket.label}`}
                    </span>
                  ) : null}
                  <i style={{ height }} />
                </button>
              );
            })}
          </div>
          <div className="gxl">
            {model.buckets.map((bucket, index) => <span key={`${bucket.label}-${index}`} className={index === active ? 'sel' : ''}>{activeTab === 'Comisiones' ? bucket.label : axisDate(bucket.label)}</span>)}
          </div>
        </div>
        <div className="gcard">
          <div className="ghd">
            <h3>{model.donutTitle}</h3>
            <div className="gdim">
              <span>Desglose</span>
              <DeskSelect
                label="Columna de desglose"
                sheetTitle="Desglose"
                options={dimensions.map((item) => ({ value: item.id, label: item.label }))}
                value={dimension}
                onChange={(value) => {
                  setDimensionByTab((current) => ({ ...current, [activeTab]: value }));
                  setCat(null);
                }}
              />
            </div>
          </div>
          <Donut parts={model.parts} money={model.donutMoney} total={model.donutTotal} cat={cat} phone={phone} onToggle={(label) => setCat((current) => current === label ? null : label)} />
        </div>
      </div>
      {activeTab === 'Comisiones' ? <><div className="glh"><h3>Por persona</h3><span>{commissionRows.length} en el período</span></div>{commissionRows.filter(row => !cat || row.name === cat || (cat === 'Otros' && model.otherLabels.includes(row.name))).map(row => <div className="gtk" key={`${row.memberId}:${row.period}`}><div className="gl"><div className="gdate">{row.period} · {saleCount(row.salesCount)}</div><div className="gstore">{row.name}</div><div className="gmeta">Pagado {commissionTotal(row.paid)} · pendiente {commissionTotal(row.pending)}</div></div><div className="gr"><div className="gamt">{money.showActive(row.converted.earned[money.active])}</div></div></div>)}{!commissionRows.length && !commissionReportLoading && !commissionReportError ? <p className="gnote">No hay comisiones en este período.</p> : null}</> : null}
      {activeTab === 'Ventas' && (
        <>
          <div className="glh"><h3>Ventas del período</h3><span>{saleRows.length} en el período</span></div>
          {!saleRows.length && <p className="gnote">No hay ventas para este período y filtro.</p>}
          {saleRows.map((sale) => (
            <button key={sale.id} className="gtk" type="button" onClick={() => open({ type: 'sale', id: sale.id })}>
              <div className="gl"><div className="gdate">{formatReportDate(sale.date)} · {saleCode(sale)}</div><div className="gstore">{saleBuyer(sale, clients)}</div><div className="gmeta">{saleEquipment(sale, inventory)} <Pill status={sale.status} kind="SALE_STATUS" /></div></div>
              <div className="gr"><div className="gamt">{money.compact(sale.amount, sale.amountCurrency)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {activeTab === 'Stock' && (
        <>
          <div className="glh"><h3>Equipos ingresados</h3><span>{stockRows.length} en el período</span></div>
          <p className="gnote">Equipos ingresados en el período, con su estado actual.{undatedStock > 0 ? ` ${undatedStock} ${undatedStock === 1 ? 'equipo sin fecha de ingreso no se incluye' : 'equipos sin fecha de ingreso no se incluyen'}.` : ''}</p>
          {!stockRows.length && <p className="gnote">No hay equipos para este período y filtro.</p>}
          {stockRows.map((item) => (
            <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
              <div className="gl"><div className="gdate">{equipmentTitle(item.model, item.capacity)}</div><div className="gstore">{[item.color, item.condition ? conditionLabel(item.condition) : '', qualityPhrase(item.condition, item.grade)].filter(Boolean).join(' · ') || 'Sin detalle'}</div><div className="gmeta">{item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : 'Sin estado'}</div></div>
              <div className="gr"><div className="gamt">{money.compact(item.price, item.currency)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {activeTab === 'Canjes' && (
        <>
          <div className="glh"><h3>Canjes</h3><span>{tradeRows.length} en total</span></div>
          {!tradeRows.length && <p className="gnote">No hay canjes para este período y filtro.</p>}
          {tradeRows.map((item) => (
            <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'cj', id: item.id })}>
              <div className="gl"><div className="gdate">{formatReportDate(item.date)} · {tradeCode(tradeIns, item.id)}</div><div className="gstore">{tradeClientLabel(item, clients)}</div><div className="gmeta">{item.deviceReceived} <Pill status={item.status} kind="TRADE_IN_STATUS" /></div></div>
              <div className="gr"><div className="gamt">+{money.compact(item.differencePaid, item.currency)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {activeTab === 'Clientes' && (
        <>
          <div className="glh"><h3>Top por compras</h3><span>{clientRows.length} en el período</span></div>
          {!clientRows.length && <p className="gnote">No hay clientes para este período y filtro.</p>}
          {clientRows.map((row) => (
            <button key={row.id ?? row.name} className="gtk" type="button" onClick={() => { if (row.id) open({ type: 'cl', id: row.id }); }}>
              <div className="gl"><div className="gdate">{row.kind}</div><div className="gstore">{row.name}</div><div className="gmeta">{row.purchases} {row.purchases === 1 ? 'compra' : 'compras'}{row.tag ? ` · ${row.tag}` : ''}</div></div>
              <div className="gr"><div className="gamt">{row.blocked ? '—' : money.showActive(row.revenue)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {activeTab === 'Servicio' && (
        <>
          <div className="glh"><h3>Órdenes del período</h3><span>{repairRows.length} en el período</span></div>
          {!repairRows.length && <p className="gnote">No hay órdenes para este período y filtro.</p>}
          {repairRows.map((order) => (
            <button key={order.id} className="gtk" type="button" onClick={() => open({ type: 'ot', id: order.id })}>
              <div className="gl"><div className="gdate">{formatReportDate(order.receivedAt)} · {order.code}</div><div className="gstore">{order.clientName}</div><div className="gmeta">{order.device} <Pill status={order.status} kind="REPAIR_STATUS" /></div></div>
              <div className="gr"><div className="gamt">{order.estimate == null ? 'A cotizar' : money.compact(order.estimate, order.currency)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function axisDate(label: string) {
  const parts = /^(\d{2}\/\d{2})\/(\d{4})$/.exec(label);
  if (!parts) return label;
  return <>{parts[1]}<br />{parts[2]}</>;
}

const DONUT_CENTER = 66;
const DONUT_RADIUS = 46;

function donutSlicePath(start: number, end: number) {
  const sweep = end - start;
  if (sweep <= 0 || sweep >= Math.PI * 2 - 1e-4) return '';
  const point = (angle: number) => `${DONUT_CENTER + DONUT_RADIUS * Math.cos(angle)} ${DONUT_CENTER + DONUT_RADIUS * Math.sin(angle)}`;
  return `M ${point(start)} A ${DONUT_RADIUS} ${DONUT_RADIUS} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(end)}`;
}

function Donut({ parts, money: showMoney, total, cat, phone, onToggle }: { parts: { label: string; value: number; color: string }[]; money: boolean; total: number; cat: string | null; phone: boolean; onToggle: (label: string) => void }) {
  const money = useMoney();
  const sum = parts.reduce((acc, part) => acc + part.value, 0);
  const visible = parts.filter((part) => part.value > 0);
  const gap = visible.length > 1 ? Math.min(0.12, (Math.PI * 2) / visible.length / 4) : 0;
  let cursor = -Math.PI / 2;
  const active = parts.find((part) => part.label === cat);
  const totalLabel = fitDonutValue(total, showMoney ? money.active : undefined, phone);
  const center = sum === 0 ? fitDonutText('—', phone) : active ? fitDonutText(`${Math.round((active.value / sum) * 100)}%`, phone) : totalLabel;
  const centerLabel = sum === 0 ? 'sin datos' : active?.label ?? 'total';
  const description = `${active ? `${center.text} · ${active.label}; ` : ''}total: ${totalLabel.fullText}`;
  return (
    <div className="gcomp">
      <div className="gdonut">
        <svg width="132" height="132" viewBox="0 0 132 132">
          {sum === 0 ? <circle cx="66" cy="66" r={DONUT_RADIUS} fill="none" stroke="#E7E7E7" strokeWidth="20" strokeDasharray="5 5" /> : visible.map((part) => {
            const sweep = (Math.PI * 2) * (part.value / sum);
            const pad = Math.min(gap, sweep * 0.25);
            const start = cursor + pad / 2;
            const end = cursor + sweep - pad / 2;
            cursor += sweep;
            const path = donutSlicePath(start, end);
            const props = {
              fill: 'none' as const,
              stroke: !cat || cat === part.label ? part.color : '#E7E7E7',
              strokeWidth: 20,
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': `Porción ${part.label}`,
              'aria-pressed': cat === part.label,
              onClick: () => onToggle(part.label),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggle(part.label);
                }
              },
            };
            return path
              ? <path key={part.label} d={path} {...props} />
              : <circle key={part.label} cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_RADIUS} {...props} />;
          })}
        </svg>
        <div className="gc" role="img" aria-label={sum === 0 ? `sin datos; ${description}` : description} title={description}>
          <b style={{ fontSize: center.fontSize }}>{center.text}</b><small title={centerLabel}>{centerLabel}</small>
        </div>
      </div>
      <div className="gleg">
        {parts.map((part) => {
          const pct = `${sum ? Math.round((part.value / sum) * 100) : 0}%`;
          const desktopFigure = showMoney && sum ? pct : part.value;
          return (
            <button key={part.label} className={`glg${cat === part.label ? ' sel' : cat ? ' off' : ''}`} aria-pressed={cat === part.label} aria-label={`${part.label}: ${showMoney && sum ? pct : part.value}`} type="button" onClick={() => onToggle(part.label)}>
              <i style={{ background: part.color }} />
              <span>{part.label}</span>
              {phone && sum > 0 ? <em>{showMoney ? money.showActive(part.value) : part.value}</em> : null}
              <b>{phone && sum > 0 ? pct : desktopFigure}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildReport(
  tab: ReportTab,
  period: ReportPeriod,
  bounds: ReportBounds,
  dimension: string,
  dimensions: Array<{ id: string; label: string }>,
  data: {
    sales: Sale[];
    inventory: Product[];
    tradeIns: TradeIn[];
    clients: Client[];
    repairs: Array<RepairOrder & { chartValue: number }>;
    clientRows: Array<{ kind: 'Alta' | 'Recurrente' | 'Primera compra'; tag: string; category: string; customFields?: Record<string, unknown>; createdAt: string | null }>;
    altas: number;
    recurrentes: number;
    serviceBilling: number | null;
    salesValue: number | null;
    customColumns: CustomColumn[];
  },
  allSales: { date: string; amount: number; status: string }[],
) {
  const { buckets, bucketLabel } = makeReportBuckets(period, bounds);
  const catalog = breakdownCatalog(tab, dimension);
  const title = breakdownTitle(tab, dimension, dimensions);
  if (tab === 'Ventas') {
    const current = data.sales;
    const previous = allSales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
    const total = current.reduce((sum, sale) => sum + sale.amount, 0);
    const prev = previous.reduce((sum, sale) => sum + sale.amount, 0);
    for (const sale of current) addToReportBucket(buckets, sale.date, sale.amount);
    const grouped = groupBreakdown(current.map((sale) => ({
      label: saleBreakdownLabel(sale, dimension, data.inventory, data.customColumns),
      value: sale.amount,
    })), catalog);
    return {
      eye: 'Facturación',
      total,
      headline: data.salesValue ?? 0,
      barMoney: true,
      unavailable: data.salesValue == null,
      donutMoney: data.salesValue != null,
      donutTotal: data.salesValue ?? 0,
      delta: deltaLabel(total, prev),
      note: '',
      bucketLabel,
      buckets,
      donutTitle: title,
      parts: grouped.parts,
      otherLabels: grouped.otherLabels,
    };
  }
  if (tab === 'Stock') {
    const available = data.inventory.filter((item) => isInStock(item.status)).length;
    for (const item of data.inventory) addToReportBucket(buckets, item.createdAt, 1);
    const grouped = groupBreakdown(data.inventory.map((item) => ({
      label: stockBreakdownLabel(item, dimension),
      value: 1,
    })), catalog);
    return {
      eye: 'Equipos ingresados',
      total: data.inventory.length,
      headline: data.inventory.length,
      barMoney: false,
      unavailable: false,
      donutMoney: false,
      donutTotal: data.inventory.length,
      delta: `${available} disponibles en este grupo`,
      note: '',
      bucketLabel,
      buckets,
      donutTitle: title,
      parts: grouped.parts,
      otherLabels: grouped.otherLabels,
    };
  }
  if (tab === 'Canjes') {
    const current = data.tradeIns;
    for (const item of current) addToReportBucket(buckets, item.date, 1);
    const open = current.filter((item) => isInProgressTrade(item.status)).length;
    const grouped = groupBreakdown(current.map((item) => ({
      label: tradeBreakdownLabel(item, dimension, tradeClientLabel(item, data.clients)),
      value: 1,
    })), catalog);
    return {
      eye: 'Canjes',
      total: current.length,
      headline: current.length,
      barMoney: false,
      unavailable: false,
      donutMoney: false,
      donutTotal: current.length,
      delta: `${open} en curso`,
      note: '',
      bucketLabel,
      buckets,
      donutTitle: title,
      parts: grouped.parts,
      otherLabels: grouped.otherLabels,
    };
  }
  if (tab === 'Clientes') {
    for (const row of data.clientRows) {
      if (row.kind === 'Alta') addToReportBucket(buckets, row.createdAt ?? undefined, 1);
    }
    const grouped = groupBreakdown(data.clientRows.map((row) => ({
      label: clientBreakdownLabel(row, dimension),
      value: 1,
    })), catalog);
    return {
      eye: 'Altas',
      total: data.altas,
      headline: data.altas,
      barMoney: false,
      unavailable: false,
      donutMoney: false,
      donutTotal: data.clientRows.length,
      delta: `${data.recurrentes} ${data.recurrentes === 1 ? 'recurrente' : 'recurrentes'}`,
      note: 'Alta: se creó en el período. Recurrente: ya era cliente y volvió a comprar.',
      bucketLabel,
      buckets,
      donutTitle: title,
      parts: grouped.parts,
      otherLabels: grouped.otherLabels,
    };
  }
  const orders = data.repairs;
  const unavailable = data.serviceBilling == null;
  for (const order of orders) addToReportBucket(buckets, order.receivedAt, order.chartValue);
  const average = averageLeadDays(orders.map((order) => repairLeadDays(order)));
  const grouped = groupBreakdown(orders.map((order) => ({
    label: serviceBreakdownLabel(order, dimension),
    value: 1,
  })), catalog);
  return {
    eye: 'Facturación',
    total: orders.length,
    headline: data.serviceBilling ?? 0,
    barMoney: !unavailable,
    unavailable,
    donutMoney: false,
    donutTotal: orders.length,
    delta: `${orders.length} ${orders.length === 1 ? 'orden' : 'órdenes'} · ${leadTimeLabel(average)}`,
    note: unavailable ? 'No se puede sumar la facturación en la moneda de la tienda.' : 'La facturación suma los presupuestos. El tiempo medio va del ingreso hasta Entregado.',
    bucketLabel,
    buckets,
    donutTitle: title,
    parts: grouped.parts,
    otherLabels: grouped.otherLabels,
  };
}

function deltaLabel(current: number, previous: number) {
  if (!previous) return current ? 'sin base anterior' : 'sin movimiento';
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs período anterior`;
}
