import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  clientName,
  formatMoney,
  formatMoneyCompact,
  formatShortDate,
  inPeriod,
  isInProgressTrade,
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
const BUCKET_LABEL: Record<PeriodKey, string> = {
  Semana: 'por día',
  Mes: 'por semana',
  '3 meses': 'por mes',
  Año: 'por mes',
};
const DAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function ReportsScreen() {
  const { sales, inventory, tradeIns, clients } = useAppContext();
  const { open, toast } = useDesk();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ventas');
  const [period, setPeriod] = useState<PeriodKey>('Mes');
  const [selected, setSelected] = useState<number | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const bounds = periodBounds(period);

  const model = useMemo(
    () => buildReport(tab, period, bounds, { sales, inventory, tradeIns }),
    [tab, period, bounds, sales, inventory, tradeIns],
  );
  const active = selected != null && selected < model.buckets.length ? selected : model.buckets.length - 1;
  const max = Math.max(...model.buckets.map((bucket) => bucket.value), 1);

  const exportReport = () => {
    const rows: string[][] = [['detalle', 'importe', 'estado']];
    if (tab === 'Ventas') {
      sales.filter((sale) => inPeriod(sale.date, bounds.start, bounds.end)).forEach((sale) => {
        rows.push([`${saleCode(sale)} ${clientName(clients, sale.clientId)}`, String(sale.amount), statusLabel(sale.status)]);
      });
    } else if (tab === 'Stock') {
      inventory.forEach((item) => rows.push([`${item.model} ${item.capacity}`, String(item.price), statusLabel(item.status)]));
    } else {
      tradeIns.filter((item) => inPeriod(item.date, bounds.start, bounds.end)).forEach((item) => {
        rows.push([`${tradeCode(tradeIns, item.id)} ${clientName(clients, item.clientId)}`, String(item.differencePaid), statusLabel(item.status)]);
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

  const saleRows = sales.filter((sale) => inPeriod(sale.date, bounds.start, bounds.end) && (!cat || paymentLabel(sale.paymentMethod || 'Otro') === cat));
  const stockRows = inventory.filter((item) => !cat || statusLabel(item.status) === cat);
  const tradeRows = tradeIns.filter((item) => (inPeriod(item.date, bounds.start, bounds.end) || !item.date) && (!cat || statusLabel(item.status) === cat));

  return (
    <div className="dscreen">
      <div className="dtop">
        <div><h1>Reportes</h1></div>
        <button className="circ" type="button" aria-label="Exportar" onClick={exportReport}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16181D" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
        </button>
      </div>
      <div className="gfilters">
        <div>{TABS.map((item) => <button key={item} className={`gchip${tab === item ? ' on' : ''}`} type="button" onClick={() => { setTab(item); setSelected(null); setCat(null); }}>{item}</button>)}</div>
        <div>{PERIODS.map((item) => <button key={item} className={`gchip sm${period === item ? ' on' : ''}`} type="button" onClick={() => { setPeriod(item); setSelected(null); }}>{item}</button>)}</div>
      </div>
      <div className="gtotal">
        <div className="geye">{model.eye} · {PERIOD_LABEL[period]}</div>
        <div className="gamount">{model.money ? formatMoney(model.total) : model.total}</div>
        <span className="gdelta">{model.delta}</span>
      </div>
      <div className="repgrid">
        <div className="gcard">
          <div className="ghd"><h3>Evolución</h3><span>{model.bucketLabel}</span></div>
          <div className="gbars">
            {model.buckets.map((bucket, index) => {
              const height = Math.max(3, Math.round((bucket.value / max) * 96));
              return (
                <button key={`${bucket.label}-${index}`} className={`gcol${index === active ? ' sel' : ''}`} type="button" onClick={() => setSelected(index)}>
                  {index === active ? (
                    <span className={`gtip${index < 2 ? ' tl' : index > model.buckets.length - 3 ? ' tr' : ''}`} style={{ bottom: height + 8 }}>
                      <b>{model.money ? formatMoneyCompact(bucket.value) : bucket.value}</b>
                      {index === model.buckets.length - 1 ? ' · en curso' : ` · ${bucket.label}`}
                    </span>
                  ) : null}
                  <i style={{ height }} />
                </button>
              );
            })}
          </div>
          <div className="gxl">
            {model.buckets.map((bucket, index) => <span key={`${bucket.label}-${index}`} className={index === active ? 'sel' : ''}>{bucket.label}</span>)}
          </div>
        </div>
        <div className="gcard">
          <div className="ghd"><h3>{model.donutTitle}</h3><span>tocá para filtrar</span></div>
          <Donut parts={model.parts} money={model.money} total={model.total} cat={cat} onToggle={(label) => setCat((current) => current === label ? null : label)} />
        </div>
      </div>
      {tab === 'Ventas' && (
        <>
          <div className="glh"><h3>Ventas del período</h3><span>{saleRows.length} recientes</span></div>
          {saleRows.map((sale) => (
            <button key={sale.id} className="gtk" type="button" onClick={() => open({ type: 'sale', id: sale.id })}>
              <div className="gl"><div className="gdate">{formatShortDate(sale.date)} · {saleCode(sale)}</div><div className="gstore">{clientName(clients, sale.clientId)}</div><div className="gmeta">{productLabel(inventory.find((item) => item.id === sale.productId))} <Pill status={sale.status} /></div></div>
              <div className="gr"><div className="gamt">{formatMoneyCompact(sale.amount)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {tab === 'Stock' && (
        <>
          <div className="glh"><h3>Equipos</h3><span>{stockRows.length} en stock</span></div>
          {stockRows.map((item) => (
            <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'eq', id: item.id })}>
              <div className="gl"><div className="gdate">IMEI …{item.imei.slice(-4)}</div><div className="gstore">{item.model} · {item.capacity}</div><div className="gmeta">{item.condition} <Pill status={item.status} /></div></div>
              <div className="gr"><div className="gamt">{formatMoneyCompact(item.price)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
      {tab === 'Canjes' && (
        <>
          <div className="glh"><h3>Canjes</h3><span>{tradeRows.length} en total</span></div>
          {tradeRows.map((item) => (
            <button key={item.id} className="gtk" type="button" onClick={() => open({ type: 'cj', id: item.id })}>
              <div className="gl"><div className="gdate">{formatShortDate(item.date)} · {tradeCode(tradeIns, item.id)}</div><div className="gstore">{clientName(clients, item.clientId)}</div><div className="gmeta">{item.deviceReceived} <Pill status={item.status} /></div></div>
              <div className="gr"><div className="gamt">+{formatMoneyCompact(item.differencePaid)}</div></div>
              <span className="gchev">›</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function Donut({ parts, money, total, cat, onToggle }: { parts: { label: string; value: number; color: string }[]; money: boolean; total: number; cat: string | null; onToggle: (label: string) => void }) {
  const sum = parts.reduce((acc, part) => acc + part.value, 0);
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const active = parts.find((part) => part.label === cat);
  return (
    <div className="gcomp">
      <div className="gdonut">
        <svg width="132" height="132" viewBox="0 0 132 132">
          {sum === 0 ? <circle cx="66" cy="66" r={radius} fill="none" stroke="#E7E7E7" strokeWidth="20" strokeDasharray="5 5" /> : parts.map((part) => {
            const length = circ * (part.value / sum);
            const node = (
              <circle key={part.label} cx="66" cy="66" r={radius} fill="none" stroke={!cat || cat === part.label ? part.color : '#E7E7E7'} strokeWidth={cat === part.label ? 24 : 20}
                strokeDasharray={`${Math.max(length - 1.6, 0)} ${circ}`} strokeDashoffset={-offset} transform="rotate(-90 66 66)" style={{ cursor: 'pointer' }}
                onClick={() => onToggle(part.label)} />
            );
            offset += length;
            return node;
          })}
        </svg>
        <div className="gc">
          {sum === 0 ? <><b>—</b><small>sin datos</small></> : active ? <><b>{Math.round((active.value / sum) * 100)}%</b><small>{active.label}</small></> : <><b>{money ? formatMoneyCompact(total) : total}</b><small>total</small></>}
        </div>
      </div>
      <div className="gleg">
        {parts.map((part) => (
          <button key={part.label} className={`glg${cat === part.label ? ' sel' : cat ? ' off' : ''}`} type="button" onClick={() => onToggle(part.label)}>
            <i style={{ background: part.color }} /><span>{part.label}</span><b>{money && sum ? `${Math.round((part.value / sum) * 100)}%` : part.value}</b>
          </button>
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
      bucketLabel: BUCKET_LABEL[period],
      buckets,
      donutTitle: 'Por medio de pago',
      parts: fixedParts(current, (sale) => paymentLabel(sale.paymentMethod || 'Otro'), (sale) => sale.amount, [
        { label: 'Transferencia', color: '#397964' },
        { label: 'Efectivo', color: '#5B8DEF' },
        { label: 'Tarjeta', color: '#DF668B' },
        { label: 'Cripto', color: '#DDF43B' },
      ]),
    };
  }
  if (tab === 'Stock') {
    const available = data.inventory.filter((item) => item.status === 'DISPONIBLE').length;
    return {
      eye: 'Equipos en stock',
      total: data.inventory.length,
      money: false,
      delta: `${data.inventory.length} en stock · ${available} disponibles`,
      bucketLabel: 'por estado',
      buckets: [
        { label: 'Disp.', value: available },
        { label: 'Rev.', value: data.inventory.filter((item) => item.status === 'EN_REVISION').length },
        { label: 'Res.', value: data.inventory.filter((item) => item.status === 'RESERVADO').length },
        { label: 'Vend.', value: data.inventory.filter((item) => item.status === 'VENDIDO').length },
      ],
      donutTitle: 'Por estado',
      parts: fixedParts(data.inventory, (item) => statusLabel(item.status), () => 1, [
        { label: 'Disponible', color: '#DDF43B' },
        { label: 'En revisión', color: '#5B8DEF' },
        { label: 'Vendido', color: '#397964' },
        { label: 'Reservado', color: '#DF668B' },
      ]),
    };
  }
  const current = data.tradeIns.filter((item) => inPeriod(item.date, bounds.start, bounds.end));
  for (const item of current) addToBucket(buckets, item.date, 1);
  const open = data.tradeIns.filter((item) => isInProgressTrade(item.status)).length;
  return {
    eye: 'Canjes',
    total: current.length,
    money: false,
    delta: `${open} en curso`,
    bucketLabel: BUCKET_LABEL[period],
    buckets,
    donutTitle: 'Por estado',
    parts: fixedParts(current, (item) => statusLabel(item.status), () => 1, [
      { label: 'Pendiente', color: '#5B8DEF' },
      { label: 'Peritaje téc.', color: '#DF668B' },
      { label: 'En revisión', color: '#DDF43B' },
      { label: 'Aprobado', color: '#397964' },
      { label: 'Completado', color: '#16181D' },
    ]),
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
      buckets.push({ label: DAY[start.getDay()] ?? '', start, end: next, value: 0 });
    }
    return buckets;
  }
  if (period === 'Mes') {
    const origin = new Date(end);
    origin.setDate(origin.getDate() - 30);
    for (let i = 0; i < 5; i += 1) {
      const start = new Date(origin);
      start.setDate(origin.getDate() + i * 6);
      const next = new Date(origin);
      next.setDate(origin.getDate() + (i === 4 ? 30 : (i + 1) * 6));
      buckets.push({
        label: start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', ''),
        start,
        end: next,
        value: 0,
      });
    }
    return buckets;
  }
  const months = period === '3 meses' ? 3 : 12;
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const short = start.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const label = period === 'Año' ? 'EFMAMJJASOND'[start.getMonth()] ?? short : short.charAt(0).toUpperCase() + short.slice(1);
    buckets.push({ label, start, end: next, value: 0 });
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
