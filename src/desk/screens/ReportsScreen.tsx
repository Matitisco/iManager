import { toUserMessage } from '../../lib/user-message';
import { useOfflineRecovery } from '../../lib/offline-recovery';
import { fetchCommissionReport } from '../../services/commissions-api';
import type { CommissionReport } from '../../types/commissions';
import { commissionTotal, monthKey, monthLabel, saleCount } from '../commissions';
import { downloadCsv } from '../csv';
import { useEffect, useMemo, useState } from 'react';
import type { Client, CustomColumn, Product, RepairOrder, Sale, TradeIn } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { netProfit, returnReversal } from '../net-profit';
import { combineAmounts } from '../money';
import type { ReturnCaseView } from '../../services/returns-api';
import type { ExpenseView } from '../../services/expenses-api';
import { fitDonutText, fitDonutValue } from '../donut-label';
import {
  saleBuyer,
  conditionLabel,
  equipmentTitle,
  saleEquipment,
  isVoidRow,
  saleCode,
  statusLabel,
  tradeClientLabel,
  tradeCode,
} from '../format';
import { qualityPhrase } from '../quality';
import {
  breakdownCatalog,
  breakdownTitle,
  buildClientReport,
  clientBreakdownLabel,
  DEFAULT_DIMENSION,
  dimensionsFor,
  groupBreakdown,
  matchesBreakdown,
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
  reportRangeLabel, reportBucketRange,
  reportPresetBounds, reportDayCount, reportComparisonLabel, reportPeriodLabel, REPORT_PRESETS,
  type ReportBounds,
  type ReportPeriod,
} from '../report-period';
import { usePhoneLayout } from '../section-notices';
import { canManageCommissions, canOpenSection } from '../sections';
import { Actions, Pill, ScreenTitle, Sheet, useDesk } from '../ui';
import { ReportDatePicker } from '../report-date-picker';
import { DeskSelect } from '../select';
import { CommissionMonthPicker } from '../CommissionMonthPicker';
import { durationText, reportDelta, reportSum, serviceSummary, stockSummary, type ReportDelta } from '../report-metrics';

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
    sessionConfirmed,
    expenses = [],
    expensesLoaded = true,
    expenseError, returnsError, reloadLedger, reloadReturns,
    returns,
    recordsAvailability, retryRecords, listsLoaded, backendStatus, reloadSession,
  } = useAppContext();
  const money = useMoney();
  const phone = usePhoneLayout();
  const { open, toast, back } = useDesk();
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
  const [period, setPeriod] = useState<ReportPeriod>('30 días');
  const [customOpen, setCustomOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(defaultReportRange);
  const [customBounds, setCustomBounds] = useState<ReportBounds | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [dimensionByTab, setDimensionByTab] = useState<Partial<Record<ReportTab, string>>>({});
  const bounds = useMemo(() => period === 'Personalizado' && customBounds ? customBounds : reportPresetBounds(period === 'Personalizado' ? '30 días' : period), [period, customBounds]);
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
  const allowedSales = canOpenSection('sales', sections, role);
  const purchaseAvailable = allowedSales && (!recordsAvailability || recordsAvailability.sales.status === 'success');
  const stock = stockSummary(inventory, purchaseAvailable ? sales : null, bounds, money.number);
  const service = serviceSummary(repairOrders, bounds, money.number);
  const comparison = `los ${reportDayCount(bounds)} días anteriores`;
  const previousSales = sales.filter(sale => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
  const salesPreviousValue = reportSum(previousSales.map(sale => ({ amount: sale.amount, currency: sale.amountCurrency })), money.number);
  const clientReport = buildClientReport({
    clients,
    categories: clientCategories,
    sales: purchaseAvailable ? sales : [],
    bounds,
    project: (amount, currency) => money.number(amount, currency),
  });
  const serviceBilling = service.budget;
  const dimensions = dimensionsFor(activeTab, customColumns).filter(item => activeTab !== 'Ventas' || canOpenSection('inventory', sections, role) || !['model', 'condition', 'color'].includes(item.id));
  const dimension = dimensions.some((item) => item.id === dimensionByTab[activeTab]) ? dimensionByTab[activeTab]! : DEFAULT_DIMENSION[activeTab];
  const [commissionReport, setCommissionReport] = useState<{ key: string; data: CommissionReport } | null>(null);
  const [commissionReportError, setCommissionReportError] = useState('');
  const [commissionReportLoading, setCommissionReportLoading] = useState(false);
  const [commissionReportRetry, setCommissionReportRetry] = useState(0);
  useOfflineRecovery(commissionReportError, () => setCommissionReportRetry(value => value + 1));
  const [commissionMonth, setCommissionMonth] = useState(() => monthKey(new Date(), appSession?.store?.timezone));
  const [commissionPrevious, setCommissionPrevious] = useState<{ key: string; value: CommissionReport } | null>(null);
  const commissionFrom = commissionMonth;
  const [monthYear, monthNumber] = commissionMonth.split('-').map(Number);
  const previousMonth = `${new Date(Date.UTC(monthYear, monthNumber - 2, 15)).getUTCFullYear()}-${String(new Date(Date.UTC(monthYear, monthNumber - 2, 15)).getUTCMonth() + 1).padStart(2, '0')}`;
  const commissionReportKey = `${appSession?.store?.id}:${appSession?.user?.id}:${role}:${JSON.stringify(sections)}:${commissionMonth}`;
  const commissionRows = commissionReport?.key === commissionReportKey ? commissionReport.data.rows.filter(row => row.period === commissionMonth) : [];
  useEffect(() => {
    if (sessionConfirmed === false || activeTab !== 'Comisiones' || !user) return;
    let active = true;
    setCommissionReportLoading(true); setCommissionReportError('');
    void fetchCommissionReport(user, commissionFrom, commissionFrom).then(data => {
      if (!Array.isArray(data.rows)) throw new Error('Respuesta inválida del reporte de comisiones');
      if (active) setCommissionReport({ key: commissionReportKey, data });
    }).catch((cause: unknown) => {
      if (active) setCommissionReportError(toUserMessage(cause, 'No se pudo cargar el reporte de comisiones'));
    }).finally(() => { if (active) setCommissionReportLoading(false); });
    void fetchCommissionReport(user, previousMonth, previousMonth).then(data => {
      if (active && Array.isArray(data.rows)) setCommissionPrevious({ key: commissionReportKey, value: data });
    }).catch(() => { if (active) setCommissionPrevious(null); });
    return () => { active = false; };
  }, [activeTab, commissionReportKey, user, commissionReportRetry, sessionConfirmed]);
  const baseModel = buildReport(activeTab, period, bounds, dimension, dimensions, {
    sales: projectedSales,
    inventory: periodData.inventory,
    inventoryLookup: inventory,
    tradeIns: periodData.tradeIns,
    clients,
    repairs: periodData.repairs.map((order) => ({
      ...order,
      chartValue: 1,
    })),
    clientRows: clientReport.rows,
    altas: clientReport.altas,
    recurrentes: clientReport.recurrentes,
    serviceBilling,
    salesValue,
    customColumns,
  });
  const commissionTotalValue = commissionRows.reduce((sum, row) => sum + row.converted.earned[money.active], 0);
  const commissionMonths = [...new Set(commissionRows.map(row => row.period))].sort();
  const model = activeTab === 'Comisiones' ? {
    ...baseModel, eye: 'Comisiones generadas', total: commissionTotalValue, headline: commissionTotalValue,
    barMoney: true, donutMoney: true, donutTotal: commissionTotalValue, unavailable: commissionReportLoading || Boolean(commissionReportError),
    note: 'Devengado del equipo, incluidos los ajustes con signo. Liquidación mensual. Conversión con la cotización guardada en cada venta; ventas históricas sin cotización guardada usan la vigente.',
    bucketLabel: 'Por mes', buckets: commissionMonths.map(period => ({ label: period, value: commissionRows.filter(row => row.period === period).reduce((sum, row) => sum + row.converted.earned[money.active], 0) })),
    donutTitle: 'Por vendedor', ...groupBreakdown(commissionRows.map(row => ({ label: row.name, value: row.converted.earned[money.active] }))),
  } : baseModel;
  const currentCount = activeTab === 'Stock' ? stock.entries : activeTab === 'Canjes' ? periodData.tradeIns.length : clientReport.altas;
  const previousCount = activeTab === 'Stock' ? stock.previous : activeTab === 'Canjes'
    ? tradeIns.filter(item => inReportPeriod(item.date, bounds.prevStart, bounds.prevEnd)).length
    : clients.filter(item => inReportPeriod(item.createdAt ?? undefined, bounds.prevStart, bounds.prevEnd)).length;
  const variation = activeTab === 'Comisiones'
    ? reportDelta(commissionReport?.key === commissionReportKey ? commissionTotalValue : null,
      commissionPrevious?.key === commissionReportKey ? commissionPrevious.value.rows.filter(row => row.period === previousMonth).reduce((sum, row) => sum + row.converted.earned[money.active], 0) : null,
      monthLabel(previousMonth))
    : activeTab === 'Ventas' ? reportDelta(reportSum(periodData.sales.map(sale => ({ amount: sale.amount, currency: sale.amountCurrency })), money.number), salesPreviousValue, comparison)
    : activeTab === 'Servicio' ? reportDelta(service.budget, service.previousBudget, comparison)
    : reportDelta(currentCount, previousCount, comparison, 'count');
  const moduleKey = activeTab === 'Ventas' ? 'sales' : activeTab === 'Stock' ? 'inventory' : activeTab === 'Canjes' ? 'tradeIns' : activeTab === 'Clientes' ? 'clients' : 'repairs';
  const primaryState = recordsAvailability?.[moduleKey];
  const classificationState = activeTab === 'Ventas' && ['model', 'condition', 'color'].includes(dimension) ? recordsAvailability?.inventory : undefined;
  const moduleState = primaryState && primaryState.status !== 'success' ? primaryState : classificationState && classificationState.status !== 'success' ? classificationState : primaryState;
  const filterScope = `${appSession?.store?.id}:${appSession?.user?.id}:${role}:${JSON.stringify(sections)}:${activeTab}:${dimension}`;
  useEffect(() => { setCat(null); setSelected(null); }, [filterScope]);
  const reportError = activeTab === 'Comisiones' ? commissionReportError : moduleState?.status === 'error' ? moduleState.error || 'No se pudieron cargar los datos del reporte.' : '';
  const reportLoading = activeTab === 'Comisiones' ? commissionReportLoading || (!reportError && commissionReport?.key !== commissionReportKey)
    : sessionConfirmed === false || moduleState?.status === 'loading' || (!moduleState && listsLoaded === false);
  const reportDenied = activeTab !== 'Comisiones' && moduleState?.status === 'denied';
  const reportReady = !reportLoading && !reportError && !reportDenied;
  const headlineMoney = activeTab === 'Ventas' || activeTab === 'Servicio' || activeTab === 'Comisiones';
  const emptyTrades = activeTab === 'Canjes' && periodData.tradeIns.length === 0;
  const monetaryUnavailable = model.unavailable && activeTab === 'Ventas';
  const visibleCommissionRows = commissionRows.filter(row => matchesBreakdown(row.name, cat, model.otherLabels));
  const draftPreview = customReportBounds(draftRange.startDate, draftRange.endDate);
  const preview = draftPreview.bounds ? `${reportDayCount(draftPreview.bounds)} días · se compara con los ${reportDayCount(draftPreview.bounds)} días anteriores (${reportComparisonLabel(draftPreview.bounds)}).` : 'Elegí un rango válido para ver la comparación.';
  const active = selected != null && selected < model.buckets.length ? selected : model.buckets.length - 1;
  const max = Math.max(...model.buckets.map((bucket) => bucket.value), 1);
  const saleLabel = (sale: Sale) => saleBreakdownLabel(sale, activeTab === 'Ventas' ? dimension : 'payment', inventory, customColumns);
  const stockLabel = (item: Product) => stockBreakdownLabel(item, activeTab === 'Stock' ? dimension : 'status');
  const tradeLabel = (item: TradeIn) => tradeBreakdownLabel(item, activeTab === 'Canjes' ? dimension : 'status', tradeClientLabel(item, clients));
  const periodSalesListed = sales.filter((sale) => inReportPeriod(sale.date, bounds.start, bounds.end));
  const saleRows = (activeTab === 'Ventas' ? periodSalesListed : periodData.sales).filter((sale) => activeTab !== 'Ventas' || matchesBreakdown(saleLabel(sale), cat, model.otherLabels));
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
    if (!reportReady) return;
    const rows: string[][] = [['detalle', 'importe', 'Moneda', 'estado']];
    const moneyCells = (amount: number, currency?: string | null): [string, string] => {
      const shown = money.shown(amount, currency);
      return [shown.text, shown.currency];
    };
    if (activeTab === 'Comisiones') {
      const rows = [['Período', 'Vendedor', 'Ventas', 'Comisión ARS', 'Comisión USD', 'Pagado ARS', 'Pagado USD', 'Pendiente ARS', 'Pendiente USD', 'Ajustes ARS', 'Ajustes USD']];
      visibleCommissionRows.forEach(row => rows.push([row.period, row.name, String(row.salesCount), String(row.earned.ARS), String(row.earned.USD), String(row.paid.ARS), String(row.paid.USD), String(row.pending.ARS), String(row.pending.USD), String(row.adjustmentsTotal.ARS), String(row.adjustmentsTotal.USD)]));
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
      clientRows.forEach((row) => rows.push([row.name, ...(row.blocked || !purchaseAvailable ? ['', ''] as [string, string] : [money.showActive(row.revenue), money.active]), row.kind]));
    } else {
      repairRows.forEach((order) => {
        rows.push([`${order.code} ${order.clientName}`, ...(order.estimate == null ? ['', ''] as [string, string] : moneyCells(order.estimate, order.currency)), statusLabel(order.status)]);
      });
    }
    downloadCsv(rows, `reporte-${activeTab.toLowerCase()}.csv`);
    toast(`Reporte de ${activeTab.toLowerCase()} exportado`);
  };

  const customPressed = period === 'Personalizado' || customOpen;
  const activeBucket = active >= 0 ? model.buckets[active] : undefined;
  const figure = (value: number) => (model.barMoney ? (model.unavailable ? '—' : money.compactActive(value)) : activeTab === 'Servicio' ? `${value} ${value === 1 ? 'orden' : 'órdenes'}` : activeTab === 'Stock' ? `${value} ${value === 1 ? 'equipo' : 'equipos'}` : value);
  const figureFull = (value: number) => (model.barMoney ? (model.unavailable ? 'sin cotización' : money.showActive(value)) : value);
  const exportButton = (
    <button className="circ" type="button" aria-label="Exportar" disabled={!reportReady} onClick={exportReport}>
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

  if (!tabs.length) return <div className="dscreen"><ScreenTitle title="Reportes" back={back} desktop={null} /><div className="card team-empty"><h2>No hay secciones habilitadas para tus reportes</h2><p>Cuando tengas acceso a una sección, vas a poder consultar sus reportes acá.</p></div></div>;

  return (
    <div className={`dscreen reports-screen${activeTab === 'Comisiones' ? ' commission-report' : ''}`}>
      <ScreenTitle title="Reportes" subtitle={phone ? undefined : `Análisis de ${appSession?.store?.name || 'tu tienda'}`} back={back} tools={exportButton} desktop={<div className="report-export"><span>El CSV usa la misma pestaña y período</span>{exportButton}</div>} />
      <div className="gfilters">
        <div role="group" aria-label="Tipo de reporte">{tabs.map((item) => <button key={item} className={`gchip${activeTab === item ? ' on' : ''}`} aria-pressed={activeTab === item} type="button" onClick={() => chooseTab(item)}>{item}</button>)}</div>
        {activeTab === 'Comisiones' ? <CommissionMonthPicker value={commissionMonth} onChange={value => { setCommissionMonth(value); setCat(null); setSelected(null); }} /> : <div className="gperiods" role="group" aria-label="Período">
          {REPORT_PRESETS.map((item) => <button key={item} className={`gchip sm${period === item && !customOpen ? ' on' : ''}`} aria-pressed={period === item && !customOpen} type="button" onClick={() => { setPeriod(item); setCustomOpen(false); setRangeError(null); setSelected(null); setCat(null); }}>{item}</button>)}
          <button className={`gchip sm${customPressed ? ' on' : ''}`} aria-pressed={customPressed} aria-expanded={customOpen} aria-controls="report-custom-range" type="button" onClick={() => setCustomOpen(true)}>Personalizado</button>
        </div>}
      </div>
      {customOpen && activeTab !== 'Comisiones' && !phone && (
        <form id="report-custom-range" className="grange" noValidate onSubmit={applyCustomRange}>
          {rangePickers}
          <button className="gapply" type="submit">Aplicar período</button>
          <button className="gcancel" type="button" onClick={closeCustom}>Cancelar</button>
          <p className="report-preview">{preview}</p>
          {rangeError && <p id="report-range-error" className="ferr" role="alert">{rangeError}</p>}
        </form>
      )}
      {customOpen && activeTab !== 'Comisiones' && phone && (
        <Sheet title="Período personalizado" subtitle="Elegí el inicio y el fin del reporte." onClose={closeCustom} className="report-range">
          <div id="report-custom-range">
            {rangePickers}
            <p className="report-preview">{preview}</p>
            {rangeError && <p id="report-range-error" className="ferr" role="alert">{rangeError}</p>}
          </div>
          <Actions primary="Aplicar período" onPrimary={commitRange} onSecondary={closeCustom} />
        </Sheet>
      )}
      <div className="report-applied" aria-label="Período aplicado">
        <span aria-hidden="true">▦</span> {activeTab === 'Comisiones' ? <><strong>{monthLabel(commissionMonth)}</strong><span>Mes calendario · compara con {monthLabel(previousMonth)}</span></> : <><strong>{reportPeriodLabel(period)}</strong><span>· del {reportRangeLabel(bounds)}</span><span> | compara con {reportComparisonLabel(bounds)}</span></>}
      </div>
      {reportError ? <div className="report-state" role="alert"><h3>No se pudo cargar el reporte</h3><p>{reportError}</p><button className="gchip" type="button" onClick={() => activeTab === 'Comisiones' ? setCommissionReportRetry(value => value + 1) : backendStatus === 'offline' ? void reloadSession?.() : void retryRecords?.()}>Reintentar</button></div> : null}
      {reportLoading && !reportError ? <div className="report-state" role="status">Cargando reporte…</div> : null}
      {reportDenied ? <p role="status">No tenés permiso para consultar estos datos.</p> : null}
      {reportReady ? <>
      <div className="gtotal">
        <div className="geye">{model.eye}</div>
        <div className="gamount">{model.unavailable ? '—' : headlineMoney ? money.showActive(model.headline) : activeTab === 'Stock' ? `${model.total} ${model.total === 1 ? 'equipo' : 'equipos'}` : activeTab === 'Canjes' ? `${model.total} ${model.total === 1 ? 'canje' : 'canjes'}` : model.total}</div>
        <ReportVariation delta={variation} />
      </div>
      {model.note ? <p className="gnote">{model.note}</p> : null}
      <div className="report-notes">
        {activeTab === 'Ventas' ? <><span>Moneda: {money.active === 'ARS' ? 'pesos (ARS)' : 'dólares (USD)'}</span><span>{saleCount(periodData.sales.length)} computables</span><span>Conversión a la cotización vigente de la tienda</span></> : null}
        {activeTab === 'Stock' ? <><span>Solo equipos con fecha de ingreso</span><span>{undatedStock} sin fecha válida no se cuentan</span></> : null}
        {activeTab === 'Canjes' ? <span>Equipos tomados en parte de pago</span> : null}
        {activeTab === 'Servicio' ? <><span>Suma de presupuestos, no son cobros</span><span>Moneda: {money.active}</span><span>{service.unquoted} órdenes «A cotizar» no suman</span></> : null}
        {activeTab === 'Clientes' ? <span>El indicador cuenta registros nuevos. El desglose y Top por compras también consideran actividad de compra.{purchaseAvailable ? ` ${clientReport.recurrentes} ${clientReport.recurrentes === 1 ? 'recurrente' : 'recurrentes'}.` : ' Compras no disponibles: requieren permiso de Ventas y una carga exitosa.'}</span> : null}
        {activeTab === 'Comisiones' ? <span>Moneda: {money.active} · mes calendario de la tienda</span> : null}
      </div>
      {activeTab === 'Stock' ? <div className="report-kpis">
        <ReportKpi label="Disponibles hoy" value={stock.available} note="Foto actual, no depende del período" />
        <ReportKpi label="Valor a precio de venta" value={stock.saleValue == null ? 'No disponible' : money.showActive(stock.saleValue)} note={`De los ${stock.available} disponibles · ${money.active}${stock.saleValue == null ? ' · falta cotización' : ''}`} />
        <ReportKpi label="Días promedio en stock" value={durationText(stock.averageDays)} note={purchaseAvailable ? `${stock.measured} de ${stock.sold} vendidos medibles en el período; requiere fecha y vínculo de venta` : 'Requiere permiso y datos de Ventas'} />
      </div> : null}
      {activeTab === 'Servicio' ? <div className="report-kpis">
        <ReportKpi label="Órdenes ingresadas" value={service.received} note={`${service.quoted} con presupuesto`} />
        <ReportKpi label="Entregadas" value={service.delivered} note={`Presupuesto de entregadas: ${service.deliveredBudget == null ? 'No disponible: falta cotización' : money.showActive(service.deliveredBudget)}`} />
        <ReportKpi label="Tiempo medio" value={durationText(service.averageDays)} note={`Del ingreso a Entregado · ${service.measured} de ${service.delivered} entregas medibles`} />
      </div> : null}
      {cat ? <p className="report-filter-scope">Filtro «{cat}»: solo detalles y CSV. Totales y evolución muestran el período completo.</p> : null}
      {emptyTrades ? <div className="report-empty"><h3>No hubo canjes en este período</h3><p>Probá con 30 o 90 días. Cuando registres un canje va a aparecer acá con su diferencia cobrada.</p><button className="gchip" type="button" onClick={() => { setPeriod('30 días'); setCustomOpen(false); setCat(null); setSelected(null); }}>Ver últimos 30 días</button></div> : monetaryUnavailable ? <p className="report-state" role="status">No se puede sumar la facturación: falta una cotización válida.</p> : <div className="repgrid">
        <div className="gcard">
          <div className="ghd"><h3>Evolución</h3><span>{activeTab === 'Servicio' ? 'Órdenes · ' : activeTab === 'Stock' ? 'Ingresos · ' : ''}{model.bucketLabel}</span></div>
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
                <button title={reportBucketRange(bucket)} aria-description={reportBucketRange(bucket)} key={`${bucket.label}-${index}`} className={`gcol${index === active ? ' sel' : ''}`} aria-label={`${bucket.label}: ${figureFull(bucket.value)}`} type="button" onClick={() => setSelected(index)}>
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
            {model.buckets.map((bucket, index) => <span key={`${bucket.label}-${index}`} className={index === active ? 'sel' : ''}>{activeTab === 'Comisiones' ? bucket.label : reportDayCount(bounds) <= 366 ? bucket.label.slice(0, 5) : axisDate(bucket.label)}</span>)}
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
          <Donut centerLabel={activeTab === 'Stock' ? 'ingresados' : activeTab === 'Servicio' ? 'órdenes' : activeTab === 'Ventas' ? 'facturado' : 'total'} parts={model.parts.filter(part => part.value !== 0)} money={model.donutMoney} total={model.donutTotal} cat={cat} phone={phone} onToggle={(label) => setCat((current) => current === label ? null : label)} />
        </div>
      </div>}
      {activeTab === 'Ventas' && role === 'OWNER' ? (
        <section className="report-business"><div className="report-business-head"><h3>Resultado del negocio</h3><span>Ventas, gastos y devoluciones · mismo período · {money.active}</span></div>
        {expenseError || returnsError || recordsAvailability?.inventory.status === 'error' ? <div role="alert"><p>Resultado no disponible: no se pudieron cargar ventas, costos, gastos o devoluciones.</p><button className="gchip" type="button" onClick={() => { void retryRecords?.(); void reloadLedger?.(); void reloadReturns?.(); }}>Reintentar resultado</button></div> : <NetProfitCard
          loading={expensesLoaded === false || returns === null || Boolean(recordsAvailability && (recordsAvailability.inventory.status !== 'success'))}
          sales={sales}
          inventory={inventory}
          expenses={expenses}
          returns={returns ?? []}
          start={bounds.start}
          end={bounds.end}
          currency={money.active}
          rate={money.rate}
          show={money.showActive}
          warning={money.warning}
        />}</section>
      ) : null}
      {activeTab === 'Comisiones' ? <><div className="glh"><h3>Por persona</h3><span>{commissionRows.length} en el período</span></div>{visibleCommissionRows.map(row => <div className="gtk" key={`${row.memberId}:${row.period}`}><div className="gl"><div className="gdate">{row.period} · {saleCount(row.salesCount)}</div><div className="gstore">{row.name}</div><div className="gmeta">Pagado {commissionTotal(row.paid)} · pendiente {commissionTotal(row.pending)}</div></div><div className="gr"><div className="gamt">{money.showActive(row.converted.earned[money.active])}</div></div></div>)}{!commissionRows.length && !commissionReportLoading && !commissionReportError ? <p className="gnote">No hay comisiones en este período.</p> : null}</> : null}
      {activeTab === 'Ventas' && (
        <>
          <div className="glh"><h3>Ventas del período</h3><span>{saleRows.length} listadas · {periodData.sales.length} computables</span></div>
          {!saleRows.length && <p className="gnote">No hay ventas para este período y filtro.</p>}
          {saleRows.map((sale) => (
            <button key={sale.id} className={`gtk${isVoidRow(sale) ? ' is-void' : ''}`} type="button" onClick={() => open({ type: 'sale', id: sale.id })}>
              <div className="gl"><div className="gdate">{formatReportDate(sale.date)} · {saleCode(sale)}</div><div className="gstore">{saleBuyer(sale, clients)}</div><div className="gmeta">{saleEquipment(sale, inventory)} {sale.status === 'CANCELADA' ? '· Excluida de totales · ' : ''}<Pill status={sale.status} kind="SALE_STATUS" /></div></div>
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
      {activeTab === 'Canjes' && !emptyTrades && (
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
          <div className="glh"><h3>{purchaseAvailable ? 'Top por compras' : 'Clientes registrados'}</h3><span>{clientRows.length} en el período</span></div>
          {!clientRows.length && <p className="gnote">No hay clientes para este período y filtro.</p>}
          {clientRows.map((row) => (
            <button key={row.id ?? row.name} className="gtk" type="button" onClick={() => { if (row.id) open({ type: 'cl', id: row.id }); }}>
              <div className="gl"><div className="gdate">{row.kind}</div><div className="gstore">{row.name}</div><div className="gmeta">{purchaseAvailable ? `${row.purchases} ${row.purchases === 1 ? 'compra' : 'compras'}` : 'Compras no disponibles'}{row.tag ? ` · ${row.tag}` : ''}</div></div>
              <div className="gr"><div className="gamt">{row.blocked || !purchaseAvailable ? '—' : money.showActive(row.revenue)}</div></div>
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
      </> : null}
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

function Donut({ centerLabel: defaultCenterLabel, parts, money: showMoney, total, cat, phone, onToggle }: { centerLabel: string; parts: { label: string; value: number; color: string }[]; money: boolean; total: number; cat: string | null; phone: boolean; onToggle: (label: string) => void }) {
  const money = useMoney();
  const sum = parts.reduce((acc, part) => acc + part.value, 0);
  const visible = parts.filter((part) => part.value > 0);
  const gap = visible.length > 1 ? Math.min(0.12, (Math.PI * 2) / visible.length / 4) : 0;
  let cursor = -Math.PI / 2;
  const active = parts.find((part) => part.label === cat);
  const totalLabel = fitDonutValue(total, showMoney ? money.active : undefined, phone);
  const center = sum === 0 ? fitDonutText('—', phone) : active ? fitDonutText(`${Math.round((active.value / sum) * 100)}%`, phone) : totalLabel;
  const centerLabel = sum === 0 ? 'sin datos' : active?.label ?? defaultCenterLabel;
  const description = `${active ? `${center.text} · ${active.label}; ` : ''}total: ${totalLabel.fullText}`;
  if (parts.some(part => part.value < 0)) return <div className="report-signed"><p>Importes con signo · incluye ajustes</p>{parts.map(part => <button className="glg" type="button" key={part.label} onClick={() => onToggle(part.label)} aria-pressed={cat === part.label}><i style={{ background: part.color }} /><span>{part.label}</span><b>{money.showActive(part.value)}</b></button>)}</div>;
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
          const desktopFigure = sum ? pct : part.value;
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
    inventoryLookup: Product[];
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
) {
  const { buckets, bucketLabel } = makeReportBuckets(period, bounds);
  const catalog = breakdownCatalog(tab, dimension);
  const title = breakdownTitle(tab, dimension, dimensions);
  if (tab === 'Ventas') {
    const current = data.sales;
    const total = current.reduce((sum, sale) => sum + sale.amount, 0);
    for (const sale of current) addToReportBucket(buckets, sale.date, sale.amount);
    const grouped = groupBreakdown(current.map((sale) => ({
      label: saleBreakdownLabel(sale, dimension, data.inventoryLookup, data.customColumns),
      value: sale.amount,
    })), catalog);
    return {
      eye: 'Facturación · ventas registradas',
      total,
      headline: data.salesValue ?? 0,
      barMoney: true,
      unavailable: data.salesValue == null,
      donutMoney: data.salesValue != null,
      donutTotal: data.salesValue ?? 0,
      note: '',
      bucketLabel,
      buckets,
      donutTitle: title,
      parts: grouped.parts,
      otherLabels: grouped.otherLabels,
    };
  }
  if (tab === 'Stock') {
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
    const grouped = groupBreakdown(current.map((item) => ({
      label: tradeBreakdownLabel(item, dimension, tradeClientLabel(item, data.clients)),
      value: 1,
    })), catalog);
    return {
      eye: 'Canjes recibidos',
      total: current.length,
      headline: current.length,
      barMoney: false,
      unavailable: false,
      donutMoney: false,
      donutTotal: current.length,
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
      eye: 'Clientes nuevos · registros',
      total: data.altas,
      headline: data.altas,
      barMoney: false,
      unavailable: false,
      donutMoney: false,
      donutTotal: data.clientRows.length,
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
  const grouped = groupBreakdown(orders.map((order) => ({
    label: serviceBreakdownLabel(order, dimension),
    value: 1,
  })), catalog);
  return {
    eye: 'Presupuestado · órdenes ingresadas',
    total: orders.length,
    headline: data.serviceBilling ?? 0,
    barMoney: false,
    unavailable,
    donutMoney: false,
    donutTotal: orders.length,
    note: unavailable ? 'Presupuestado no disponible: falta cotización.' : '',
    bucketLabel,
    buckets,
    donutTitle: title,
    parts: grouped.parts,
    otherLabels: grouped.otherLabels,
  };
}

export function ReportVariation({ delta }: { delta: ReportDelta }) {
  return <span className={`gdelta report-delta-${delta.tone}`} data-direction={delta.direction}>{delta.text}</span>;
}
function ReportKpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return <div className="report-kpi"><div className="geye">{label}</div><strong>{value}</strong><p>{note}</p></div>;
}

function NetProfitCard({
  loading, sales, inventory, expenses, returns = [], start, end, currency, rate, show, warning,
}: {
  loading: boolean;
  sales: Sale[];
  inventory: Product[];
  expenses: ExpenseView[] | null;
  returns?: ReturnCaseView[];
  start: Date;
  end: Date;
  currency: 'ARS' | 'USD';
  rate: number | null;
  show: (amount: number) => string;
  warning: string | null;
}) {
  if (loading) {
    return (
      <div className="dstats net-stats" data-testid="net-profit-loading" role="status" aria-label="Cargando ganancia neta">
        <div className="dstat"><span className="list-skel-bar w40" /></div>
        <div className="dstat"><span className="list-skel-bar w40" /></div>
        <div className="dstat"><span className="list-skel-bar w40" /></div>
      </div>
    );
  }
  const periodSales = sales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, start, end));
  const periodExpenses = (expenses ?? []).filter((row) => !row.deletedAt && inReportPeriod(row.date, start, end));
  const periodReturns = returns.filter((row) => !row.deletedAt && (row.resolution === 'CAMBIO' || row.resolution === 'REINTEGRO') && inReportPeriod(row.resolvedOn ?? undefined, start, end));
  const reversals = periodReturns.map((row) => returnReversal(row));
  const returned = combineAmounts(reversals.map((row) => ({ amount: row.amount, currency: row.currency })), currency, rate);
  const figures = netProfit({
    currency,
    sellRate: rate,
    sales: periodSales.map((sale) => {
      const item = inventory.find((row) => row.id === sale.productId);
      return {
        amount: sale.amount,
        currency: sale.amountCurrency,
        cost: item?.cost ?? 0,
        costCurrency: item?.currency ?? sale.amountCurrency,
      };
    }),
    expenses: periodExpenses.map((row) => ({ amount: row.amount, currency: row.currency })),
    returns: reversals,
  });
  const text = (value: number | null | undefined) => (figures && value != null ? show(value) : '—');
  return (
    <div data-testid="net-profit">
      <div className="dstats net-stats">
        {returned ? <div className="dstat" data-testid="net-profit-returns"><div className="eb">Devoluciones</div><div className="big">{show(returned)}</div></div> : null}
        <div className="dstat"><div className="eb">Ganancia bruta</div><div className="big">{text(figures?.grossProfit)}</div></div>
        <div className="dstat"><div className="eb">Gastos</div><div className="big">{text(figures?.expenses)}</div></div>
        <div className="dstat"><div className="eb">Ganancia neta</div><div className="big">{text(figures?.netProfit)}</div></div>
      </div>
      {figures ? null : <p className="fx-warn" role="status">{warning || FX_WARNING}</p>}
    </div>
  );
}
