import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  clientName,
  formatMoney,
  formatMoneyCompact,
  inPeriod,
  parseAppDate,
  paymentLabel,
  periodBounds,
  productLabel,
  saleCode,
  statusLabel,
  tradeCode,
  type PeriodKey,
} from '../format';
import { Pill, useDesk } from '../ui';

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
  const { open, toast } = useDesk();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ventas');
  const [period, setPeriod] = useState<PeriodKey>('Mes');
  const [selected, setSelected] = useState<number | null>(null);
  const bounds = periodBounds(period);

  const model = useMemo(() => buildReport(tab, period, bounds, { sales, inventory, tradeIns }), [tab, period, bounds, sales, inventory, tradeIns]);
  const active = selected != null && selected < model.buckets.length ? selected : model.buckets.length - 1;
  const max = Math.max(...model.buckets.map((bucket) => bucket.value), 1);

  return (
    <div className="dscreen">
      <div className="dtop">
        <div><h1>Reportes</h1></div>
        <button className="dbtn s" type="button" onClick={() => toast('El PDF se arma desde los datos de esta pantalla. Exportación de archivo sigue en la versión de escritorio.')}>Descargar</button>
      </div>
      <div className="gfilters">
        <div>{TABS.map((item) => <button key={item} className={`gchip${tab === item ? ' on' : ''}`} type="button" onClick={() => { setTab(item); setSelected(null); }}>{item}</button>)}</div>
        <div>{PERIODS.map((item) => <button key={item} className={`gchip sm${period === item ? ' on' : ''}`} type="button" onClick={() => { setPeriod(item); setSelected(null); }}>{item}</button>)}</div>
      </div>
      <div className="gtotal">
        <div className="geye">{model.eye} · {PERIOD_LABEL[period]}</div>
        <div className="gamount">{model.money ? formatMoney(model.total) : model.total}</div>
        <span className="gdelta">{model.delta}</span>
      </div>
      <div className="repgrid">
        <div className="dcard">
          <div className="dch"><h3>Evolución</h3><span className="mut">{model.bucketLabel}</span></div>
          <div className="gbars">
            {model.buckets.map((bucket, index) => (
              <button key={bucket.label} className={`gcol${index === active ? ' sel' : ''}`} type="button" onClick={() => setSelected(index)}>
                <i style={{ height: `${Math.max(4, Math.round((bucket.value / max) * 180))}px` }} />
              </button>
            ))}
          </div>
          <div className="gxl">
            {model.buckets.map((bucket, index) => <span key={bucket.label} className={index === active ? 'sel' : ''}>{bucket.label}</span>)}
          </div>
        </div>
        <div className="dcard">
          <div className="dch"><h3>{model.donutTitle}</h3><span className="mut">datos reales</span></div>
          <Donut parts={model.parts} money={model.money} total={model.total} />
        </div>
      </div>
      <div className="dcard glist">
        {tab === 'Ventas' && sales.filter((sale) => inPeriod(sale.date, bounds.start, bounds.end)).map((sale) => (
          <button key={sale.id} className="gtk" type="button" onClick={() => open({ type: 'sale', id: sale.id })}>
            <div><div className="mut">{sale.date} · {saleCode(sale)}</div><b>{clientName(clients, sale.clientId)}</b><div className="mut">{productLabel(inventory.find((item) => item.id === sale.productId))} <Pill status={sale.status} /></div></div>
            <b>{formatMoneyCompact(sale.amount)}</b>
          </button>
        ))}
        {tab === 'Stock' && inventory.map((item) => (
          <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
            <div><div className="mut">IMEI {item.imei.slice(-4)}</div><b>{item.model} · {item.capacity}</b><div className="mut">{item.condition} <Pill status={item.status} /></div></div>
            <b>{formatMoneyCompact(item.price)}</b>
          </button>
        ))}
        {tab === 'Canjes' && tradeIns.filter((item) => inPeriod(item.date, bounds.start, bounds.end) || !item.date).map((item) => (
          <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'cj', id: item.id })}>
            <div><div className="mut">{item.date} · {tradeCode(tradeIns, item.id)}</div><b>{clientName(clients, item.clientId)}</b><div className="mut">{item.deviceReceived} <Pill status={item.status} /></div></div>
            <b>{formatMoneyCompact(item.differencePaid)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function Donut({ parts, money, total }: { parts: { label: string; value: number; color: string }[]; money: boolean; total: number }) {
  const sum = parts.reduce((acc, part) => acc + part.value, 0) || 1;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="gcomp">
      <div className="gdonut">
        <svg width="148" height="148" viewBox="0 0 132 132">
          {parts.map((part) => {
            const length = circ * (part.value / sum);
            const node = (
              <circle key={part.label} cx="66" cy="66" r={radius} fill="none" stroke={part.color} strokeWidth="18"
                strokeDasharray={`${Math.max(length - 2, 0)} ${circ}`} strokeDashoffset={-offset} transform="rotate(-90 66 66)" />
            );
            offset += length;
            return node;
          })}
        </svg>
        <div className="gc"><b>{money ? formatMoneyCompact(total) : total}</b><small>total</small></div>
      </div>
      <div className="gleg">
        {parts.map((part) => (
          <div className="glg" key={part.label}><i style={{ background: part.color }} /><span>{part.label}</span><b>{money ? `${Math.round((part.value / sum) * 100)}%` : part.value}</b></div>
        ))}
      </div>
    </div>
  );
}

function buildReport(
  tab: (typeof TABS)[number],
  period: PeriodKey,
  bounds: ReturnType<typeof periodBounds>,
  data: { sales: { date: string; amount: number; status: string; paymentMethod: string }[]; inventory: { status: string }[]; tradeIns: { date: string; status: string }[] },
) {
  const buckets = makeBuckets(period, bounds.end);
  if (tab === 'Ventas') {
    const current = data.sales.filter((sale) => sale.status !== 'CANCELADA' && inPeriod(sale.date, bounds.start, bounds.end));
    const previous = data.sales.filter((sale) => sale.status !== 'CANCELADA' && inPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
    const total = current.reduce((sum, sale) => sum + sale.amount, 0);
    const prev = previous.reduce((sum, sale) => sum + sale.amount, 0);
    for (const sale of current) addToBucket(buckets, sale.date, sale.amount);
    return {
      eye: 'Facturación',
      total,
      money: true,
      delta: deltaLabel(total, prev),
      bucketLabel: period === 'Año' || period === '3 meses' ? 'por mes' : period === 'Mes' ? 'por semana' : 'por día',
      buckets,
      donutTitle: 'Por medio de pago',
      parts: group(current, (sale) => paymentLabel(sale.paymentMethod || 'Otro'), (sale) => sale.amount, ['#25A66A', '#3B82F6', '#F85582', '#DDF43B', '#8B5CF6']),
    };
  }
  if (tab === 'Stock') {
    const parts = group(data.inventory, (item) => statusLabel(item.status), () => 1, ['#DDF43B', '#3B82F6', '#25A66A', '#737984', '#E8A33D']);
    return {
      eye: 'Equipos en stock',
      total: data.inventory.length,
      money: false,
      delta: `${data.inventory.filter((item) => item.status === 'DISPONIBLE').length} disponibles`,
      bucketLabel: 'snapshot actual',
      buckets: parts.map((part) => ({ label: part.label.slice(0, 3), value: part.value })),
      donutTitle: 'Por estado',
      parts,
    };
  }
  const current = data.tradeIns.filter((item) => inPeriod(item.date, bounds.start, bounds.end));
  const previous = data.tradeIns.filter((item) => inPeriod(item.date, bounds.prevStart, bounds.prevEnd));
  for (const item of current) addToBucket(buckets, item.date, 1);
  return {
    eye: 'Canjes',
    total: current.length,
    money: false,
    delta: deltaLabel(current.length, previous.length),
    bucketLabel: period === 'Semana' ? 'por día' : 'por mes',
    buckets,
    donutTitle: 'Por estado',
    parts: group(current, (item) => statusLabel(item.status), () => 1, ['#E8A33D', '#8B5CF6', '#3B82F6', '#25A66A', '#0F9D8A', '#DC4C4C']),
  };
}

function makeBuckets(period: PeriodKey, end: Date) {
  const buckets: { label: string; start: Date; end: Date; value: number }[] = [];
  if (period === 'Semana') {
    for (let i = 6; i >= 0; i -= 1) {
      const start = new Date(end);
      start.setDate(start.getDate() - i - 1);
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      buckets.push({ label: start.toLocaleDateString('es-AR', { weekday: 'narrow' }), start, end: next, value: 0 });
    }
    return buckets;
  }
  const months = period === 'Mes' ? 4 : period === '3 meses' ? 3 : 12;
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    buckets.push({ label: start.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''), start, end: next, value: 0 });
  }
  return buckets;
}

function addToBucket(buckets: { start: Date; end: Date; value: number }[], date: string, amount: number) {
  const value = parseAppDate(date);
  if (!value) return;
  const bucket = buckets.find((item) => value >= item.start && value < item.end);
  if (bucket) bucket.value += amount;
}

function deltaLabel(current: number, previous: number) {
  if (!previous) return current ? 'sin base anterior' : 'sin movimiento';
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs período anterior`;
}

function group<T>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => number, colors: string[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(keyOf(row), (map.get(keyOf(row)) ?? 0) + valueOf(row));
  return [...map.entries()].map(([label, value], index) => ({ label, value, color: colors[index % colors.length] }));
}
