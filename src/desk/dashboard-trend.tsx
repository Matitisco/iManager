import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReportsOverview } from '../services/reports-api';
import { dashboardTrend, type DashboardPeriod } from './dashboard-period';

export function DashboardTrend({ series, range, phone, format }: { series: ReportsOverview['salesSeries']; range: DashboardPeriod; phone: boolean; format: (amount: number) => string }) {
  const id = useId();
  const { buckets } = dashboardTrend(series, range);
  const svg = useRef<SVGSVGElement>(null);
  const [desktopWidth, setDesktopWidth] = useState(600);
  useLayoutEffect(() => {
    if (phone || !svg.current || typeof ResizeObserver === 'undefined') return;
    const element = svg.current;
    const measure = () => setDesktopWidth(element.getBoundingClientRect().width || 600);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [phone]);
  const width = phone ? 320 : desktopWidth;
  const height = phone ? 170 : 250;
  const left = phone ? 48 : 52;
  const right = width - 28;
  const top = 30;
  const bottom = height - 30;
  const peak = Math.max(1, ...buckets.map(point => point.revenue));
  const magnitude = 10 ** Math.floor(Math.log10(peak / 2));
  const step = [1, 2, 5, 10].reduce((best, value) => Math.abs(value - peak / 2 / magnitude) < Math.abs(best - peak / 2 / magnitude) ? value : best) * magnitude;
  const tickMax = step * 2;
  const max = Math.max(tickMax, peak * 1.05);
  const min = Math.min(0, ...buckets.map(point => point.revenue));
  const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const points = buckets.map((point, i) => ({ ...point, x: buckets.length === 1 ? (left + right) / 2 : left + i / (buckets.length - 1) * (right - left), y: y(point.revenue) }));
  const path = points.map((point, i) => {
    if (!i) return `M${point.x},${point.y}`;
    const prev = points[i - 1];
    const mid = (point.x + prev.x) / 2;
    return `C${mid},${prev.y} ${mid},${point.y} ${point.x},${point.y}`;
  }).join(' ');
  return <svg ref={svg} className="dashboard-trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ventas del período" preserveAspectRatio="none">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lime)" stopOpacity=".34" /><stop offset="100%" stopColor="var(--lime)" stopOpacity=".02" /></linearGradient></defs>
    {[min, (tickMax + min) / 2, tickMax].map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="var(--row)" /><text data-ph-mask x={left - 8} y={y(value) + 4} textAnchor="end">{format(value)}</text></g>)}
    {points.length ? <><path d={`${path} L${points.at(-1)!.x},${y(0)} L${points[0].x},${y(0)} Z`} fill={`url(#${id})`} /><path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" /></> : null}
    {points.map((point, i) => <g key={point.start}><circle cx={point.x} cy={point.y} r={phone ? 3.5 : 4} fill="var(--card)" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke"><title data-ph-mask>{point.label}: {format(point.revenue)}</title></circle>{i % Math.max(1, Math.ceil(points.length / 6)) === 0 || i === points.length - 1 ? <text x={point.x} y={height - 8} textAnchor="middle">{point.label}</text> : null}</g>)}
  </svg>;
}
