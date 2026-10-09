import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useMoney } from '../exchange';
import {
  saleBuyer,
  conditionLabel,
  equipmentTitle,
  isInStock,
  isInProgressTrade,
  paymentLabel,
  periodBounds,
  saleEquipment,
  saleCode,
  statusLabel,
  tradeClientLabel,
  tradeCode,
  type PeriodKey,
} from '../format';
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
import { Actions, Pill, ScreenTitle, Sheet, useDesk } from '../ui';
import { ReportDatePicker } from '../report-date-picker';

const TABS = ['Ventas', 'Stock', 'Canjes'] as const;
const PERIODS: PeriodKey[] = ['Semana', 'Mes', '3 meses', 'Año'];
const PERIOD_LABEL: Record<PeriodKey, string> = {
  Semana: 'últimos 7 días',
  Mes: 'últimos 30 días',
  '3 meses': 'últimos 3 meses',
  Año: 'últimos 12 meses',
};

export function ReportsScreen() {
  const { sales, inventory, tradeIns, clients } = useAppContext();
  const money = useMoney();
  const phone = usePhoneLayout();
  const { open, toast } = useDesk();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ventas');
  const [period, setPeriod] = useState<ReportPeriod>('Mes');
  const [customOpen, setCustomOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(defaultReportRange);
  const [customBounds, setCustomBounds] = useState<ReportBounds | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const bounds = useMemo(() => period === 'Personalizado' && customBounds ? customBounds : periodBounds(period === 'Personalizado' ? 'Mes' : period), [period, customBounds]);
  const periodData = useMemo(() => ({
    sales: sales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.start, bounds.end)),
    inventory: inventory.filter((item) => inReportPeriod(item.createdAt, bounds.start, bounds.end)),
    tradeIns: tradeIns.filter((item) => inReportPeriod(item.date, bounds.start, bounds.end)),
  }), [sales, inventory, tradeIns, bounds]);

  const salesValue = money.sum(periodData.sales.map((sale) => ({ amount: sale.amount, currency: sale.amountCurrency })));
  const projectedSales = periodData.sales.map((sale) => ({
    ...sale,
    amount: salesValue == null ? 0 : (money.number(sale.amount, sale.amountCurrency) ?? 0),
  }));
  const projectedHistory = sales.map((sale) => ({
    ...sale,
    amount: money.number(sale.amount, sale.amountCurrency) ?? 0,
  }));
  const model = useMemo(
    () => buildReport(tab, period, bounds, { ...periodData, sales: projectedSales }, projectedHistory),
    [tab, period, bounds, periodData, projectedSales, projectedHistory],
  );
  const active = selected != null && selected < model.buckets.length ? selected : model.buckets.length - 1;
  const max = Math.max(...model.buckets.map((bucket) => bucket.value), 1);
  const saleRows = periodData.sales.filter((sale) => !cat || paymentLabel(sale.paymentMethod || 'Otro') === cat);
  const stockRows = periodData.inventory.filter((item) => !cat || statusLabel(item.status) === cat);
  const tradeRows = periodData.tradeIns.filter((item) => !cat || statusLabel(item.status) === cat);
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
    const rows: string[][] = [['detalle', 'importe', 'estado']];
    if (tab === 'Ventas') {
      saleRows.forEach((sale) => {
        rows.push([`${saleCode(sale)} ${saleBuyer(sale, clients)}`, String(money.number(sale.amount, sale.amountCurrency) ?? sale.amount), statusLabel(sale.status)]);
      });
    } else if (tab === 'Stock') {
      stockRows.forEach((item) => rows.push([`${item.model} ${item.capacity}`, String(money.number(item.price, item.currency) ?? item.price), statusLabel(item.status)]));
    } else {
      tradeRows.forEach((item) => {
        rows.push([`${tradeCode(tradeIns, item.id)} ${tradeClientLabel(item, clients)}`, String(money.number(item.differencePaid, item.currency) ?? item.differencePaid), statusLabel(item.status)]);
      });
    }
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-${tab.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Reporte de ${tab.toLowerCase()} exportado`);
  };

  const customPressed = phone ? period === 'Personalizado' || customOpen : customOpen;
  const activeBucket = active >= 0 ? model.buckets[active] : undefined;
  const exportButton = (
    <button className="circ" type="button" aria-label="Exportar" onClick={exportReport}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16181D" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
    </button>
  );
  const rangePickers = (
    <>
      <ReportDatePicker label="Fecha de inicio" value={draftRange.startDate} invalid={!!rangeError} describedBy={rangeError ? 'report-range-error' : undefined} panel={phone ? 'inline' : 'float'} onChange={(value) => { setDraftRange((current) => ({ ...current, startDate: value })); setRangeError(null); }} />
      <ReportDatePicker label="Fecha de fin" value={draftRange.endDate} invalid={!!rangeError} describedBy={rangeError ? 'report-range-error' : undefined} panel={phone ? 'inline' : 'float'} onChange={(value) => { setDraftRange((current) => ({ ...current, endDate: value })); setRangeError(null); }} />
    </>
  );

  return (
    <div className="dscreen">
      <ScreenTitle title="Reportes" tools={exportButton} desktop={exportButton} />
      <div className="gfilters">
        <div role="group" aria-label="Tipo de reporte">{TABS.map((item) => <button key={item} className={`gchip${tab === item ? ' on' : ''}`} aria-pressed={tab === item} type="button" onClick={() => { setTab(item); setSelected(null); setCat(null); }}>{item}</button>)}</div>
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
      <div className="gtotal">
        <div className="geye">{model.eye} · {period === 'Personalizado' ? reportRangeLabel(bounds) : PERIOD_LABEL[period]}</div>
        <div className="gamount">{model.money ? (salesValue == null ? '—' : money.showActive(salesValue)) : model.total}</div>
        <span className="gdelta">{model.delta}</span>
      </div>
      <div className="repgrid">
        <div className="gcard">
          <div className="ghd"><h3>Evolución</h3><span>{model.bucketLabel}</span></div>
          {phone && activeBucket ? (
            <div className="gnow">
              <span>
                <b>{model.money ? (salesValue == null ? '—' : money.compactActive(activeBucket.value)) : activeBucket.value}</b>
                {` · ${activeBucket.label}`}
              </span>
            </div>
          ) : null}
          <div className="gbars">
            {model.buckets.map((bucket, index) => {
              const height = Math.max(3, Math.round((bucket.value / max) * 96));
              return (
                <button key={`${bucket.label}-${index}`} className={`gcol${index === active ? ' sel' : ''}`} aria-label={`${bucket.label}: ${model.money ? (salesValue == null ? 'sin cotización' : money.showActive(bucket.value)) : bucket.value}`} type="button" onClick={() => setSelected(index)}>
                  {index === active ? (
                    <span className={`gtip${index < 2 ? ' tl' : index > model.buckets.length - 3 ? ' tr' : ''}`}>
                      <b>{model.money ? (salesValue == null ? '—' : money.compactActive(bucket.value)) : bucket.value}</b>
                      {` · ${bucket.label}`}
                    </span>
                  ) : null}
                  <i style={{ height }} />
                </button>
              );
            })}
          </div>
          <div className="gxl">
            {model.buckets.map((bucket, index) => <span key={`${bucket.label}-${index}`} className={index === active ? 'sel' : ''}>{axisDate(bucket.label)}</span>)}
          </div>
        </div>
        <div className="gcard">
          <div className="ghd"><h3>{model.donutTitle}</h3><span>tocá para filtrar</span></div>
          <Donut parts={model.parts} money={model.money && salesValue != null} total={model.money ? (salesValue ?? 0) : model.total} cat={cat} phone={phone} onToggle={(label) => setCat((current) => current === label ? null : label)} />
        </div>
      </div>
      {tab === 'Ventas' && (
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
      {tab === 'Stock' && (
        <>
          <div className="glh"><h3>Equipos ingresados</h3><span>{stockRows.length} en el período</span></div>
          <p className="gnote">Equipos ingresados en el período, con su estado actual.{undatedStock > 0 ? ` ${undatedStock} ${undatedStock === 1 ? 'equipo sin fecha de ingreso no se incluye' : 'equipos sin fecha de ingreso no se incluyen'}.` : ''}</p>
          {!stockRows.length && <p className="gnote">No hay equipos para este período y filtro.</p>}
          {stockRows.map((item) => (
            <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
              <div className="gl"><div className="gdate">{equipmentTitle(item.model, item.capacity)}</div><div className="gstore">{[item.color, item.condition ? conditionLabel(item.condition, item.grade) : ''].filter(Boolean).join(' · ') || 'Sin detalle'}</div><div className="gmeta">{item.status ? <Pill status={item.status} kind="INVENTORY_STATUS" /> : 'Sin estado'}</div></div>
              <div className="gr"><div className="gamt">{money.compact(item.price, item.currency)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {tab === 'Canjes' && (
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
        <div className="gc">
          {sum === 0 ? <><b>—</b><small>sin datos</small></> : active ? <><b>{Math.round((active.value / sum) * 100)}%</b><small>{active.label}</small></> : <><b>{showMoney ? money.compactActive(total) : total}</b><small>total</small></>}
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
  tab: (typeof TABS)[number],
  period: ReportPeriod,
  bounds: ReportBounds,
  data: { sales: { date: string; amount: number; status: string; paymentMethod: string }[]; inventory: { status: string; createdAt?: string }[]; tradeIns: { date: string; status: string }[] },
  allSales: { date: string; amount: number; status: string }[],
) {
  const { buckets, bucketLabel } = makeReportBuckets(period, bounds);
  if (tab === 'Ventas') {
    const current = data.sales;
    const previous = allSales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
    const total = current.reduce((sum, sale) => sum + sale.amount, 0);
    const prev = previous.reduce((sum, sale) => sum + sale.amount, 0);
    for (const sale of current) addToReportBucket(buckets, sale.date, sale.amount);
    return {
      eye: 'Facturación',
      total,
      money: true,
      delta: deltaLabel(total, prev),
      bucketLabel,
      buckets,
      donutTitle: 'Por medio de pago',
      parts: fixedParts(current, (sale) => paymentLabel(sale.paymentMethod || 'Otro'), (sale) => sale.amount, [
        { label: 'Transferencia', color: '#397964' },
        { label: 'Efectivo', color: '#5B8DEF' },
        { label: 'Tarjeta', color: '#DF668B' },
        { label: 'Cripto', color: 'var(--c-lime)' },
      ]),
    };
  }
  if (tab === 'Stock') {
    const available = data.inventory.filter((item) => isInStock(item.status)).length;
    for (const item of data.inventory) addToReportBucket(buckets, item.createdAt, 1);
    return {
      eye: 'Equipos ingresados',
      total: data.inventory.length,
      money: false,
      delta: `${available} disponibles en este grupo`,
      bucketLabel,
      buckets,
      donutTitle: 'Estado actual',
      parts: fixedParts(data.inventory, (item) => statusLabel(item.status), () => 1, [
        { label: 'Disponible', color: 'var(--c-lime)' },
        { label: 'En revisión', color: '#5B8DEF' },
        { label: 'Vendido', color: '#397964' },
        { label: 'Reservado', color: '#DF668B' },
      ]),
    };
  }
  const current = data.tradeIns;
  for (const item of current) addToReportBucket(buckets, item.date, 1);
  const open = current.filter((item) => isInProgressTrade(item.status)).length;
  return {
    eye: 'Canjes',
    total: current.length,
    money: false,
    delta: `${open} en curso`,
    bucketLabel,
    buckets,
    donutTitle: 'Por estado',
    parts: fixedParts(current, (item) => statusLabel(item.status), () => 1, [
      { label: 'Pendiente', color: '#5B8DEF' },
      { label: 'Peritaje téc.', color: '#DF668B' },
      { label: 'En revisión', color: 'var(--c-lime)' },
      { label: 'Aprobado', color: '#397964' },
      { label: 'Completado', color: '#16181D' },
    ]),
  };
}

function deltaLabel(current: number, previous: number) {
  if (!previous) return current ? 'sin base anterior' : 'sin movimiento';
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs período anterior`;
}

function fixedParts<T>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => number, catalog: { label: string; color: string }[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(keyOf(row), (map.get(keyOf(row)) ?? 0) + valueOf(row));
  const known = new Set(catalog.map((item) => item.label));
  const parts = catalog.map((item) => ({ ...item, value: map.get(item.label) ?? 0 }));
  for (const [label, value] of map) {
    if (!known.has(label)) parts.push({ label, value, color: '#737984' });
  }
  return parts;
}
