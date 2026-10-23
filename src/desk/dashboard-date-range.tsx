import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useModalLayer } from './modal-layer';
import { dashboardDay, dashboardMonth, dashboardMonthLabel, dashboardRangeLabel, dayDate, shiftDashboardMonth, shiftDay, type DashboardPeriod } from './dashboard-period';

const PRESETS = ['Hoy', '7 días', 'Este mes', 'Mes anterior', 'Total'] as const;
function presetRange(label: typeof PRESETS[number], today: string): DashboardPeriod {
  if (label === 'Total') return null;
  if (label === 'Hoy') return { start: today, end: today };
  if (label === '7 días') return { start: shiftDay(today, -6), end: today };
  return label === 'Este mes' ? dashboardMonth(today.slice(0, 7), today) : shiftDashboardMonth(dashboardMonth(today.slice(0, 7), today), -1, today);
}

export function DashboardDateRange({ range, onApply, phone }: { range: DashboardPeriod; onApply: (range: DashboardPeriod) => void; phone: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(range);
  const [month, setMonth] = useState((range?.start ?? dashboardDay()).slice(0, 7));
  const [pickingEnd, setPickingEnd] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const today = dashboardDay();
  const close = () => setOpen(false);
  useModalLayer({ ref: panel, onClose: close, enabled: open });

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { setOpen(false); }, [phone]);

  const show = () => {
    if (open) { close(); return; }
    setDraft(range); setMonth((range?.start ?? dashboardDay()).slice(0, 7)); setPickingEnd(false); setOpen(true);
  };
  const changeMonth = (amount: number) => {
    const date = dayDate(`${month}-01`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setMonth(date.toISOString().slice(0, 7));
  };
  const select = (value: string) => {
    if (!pickingEnd || !draft) { setDraft({ start: value, end: value }); setPickingEnd(true); }
    else { setDraft({ start: value < draft.start ? value : draft.start, end: value < draft.start ? draft.start : value }); setPickingEnd(false); }
  };
  const keyDate = (event: KeyboardEvent<HTMLButtonElement>, value: string) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    const weekday = (dayDate(value).getUTCDay() + 6) % 7;
    const next = delta !== undefined ? shiftDay(value, delta) : event.key === 'Home' ? shiftDay(value, -weekday) : event.key === 'End' ? shiftDay(value, 6 - weekday) : null;
    if (!next || next > today) return;
    event.preventDefault();
    setMonth(next.slice(0, 7));
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  };
  const first = dayDate(`${month}-01`);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const popup = open ? <div ref={panel} id={id} className={`dashboard-range-panel${phone ? ' phone' : ''}`} role="dialog" aria-modal="true" aria-label="Elegir período" tabIndex={-1}>
    <div className="dashboard-presets">{PRESETS.map(label => {
      const value = presetRange(label, today);
      const active = draft?.start === value?.start && draft?.end === value?.end;
      return <button key={label} type="button" aria-pressed={active} className={active ? 'on' : ''} onClick={() => { setDraft(value); setMonth((value?.start ?? today).slice(0, 7)); setPickingEnd(false); }}>{label}</button>;
    })}</div>
    <div className="dashboard-calendar-heading">
      <button type="button" aria-label="Mes anterior del calendario" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
      <b aria-live="polite">{dashboardMonthLabel(`${month}-01`)}</b>
      <button type="button" aria-label="Mes siguiente del calendario" disabled={month >= today.slice(0, 7)} onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
    </div>
    <div className="dashboard-weekdays" aria-hidden="true">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => <span key={i}>{day}</span>)}</div>
    <div className="dashboard-calendar-days">
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: count }, (_, i) => {
        const value = `${month}-${String(i + 1).padStart(2, '0')}`;
        const selected = !!draft && value >= draft.start && value <= draft.end;
        return <button key={value} type="button" data-day={value} disabled={value > today} aria-label={dayDate(value).toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={selected} aria-current={value === today ? 'date' : undefined} className={[selected ? 'in-range' : '', value === draft?.start ? 'range-start' : '', value === draft?.end ? 'range-end' : ''].join(' ')} onClick={() => select(value)} onKeyDown={event => keyDate(event, value)}>{i + 1}</button>;
      })}
    </div>
    <div className="dashboard-range-footer"><b aria-live="polite">{dashboardRangeLabel(draft)}</b><button type="button" className="dbtn p" onClick={() => { onApply(draft); close(); }}>Aplicar</button></div>
  </div> : null;
  const host = document.querySelector('.desk-app');
  return <>
    {phone ? <div className="dashboard-month-nav">
      <button type="button" aria-label="Mes anterior" onClick={() => onApply(shiftDashboardMonth(range ?? dashboardMonth(), -1))}><ChevronLeft size={18} /></button>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? id : undefined} onClick={show}>{range && range.start.endsWith('-01') && range.end === dashboardMonth(range.start.slice(0, 7)).end ? dashboardMonthLabel(range.start) : dashboardRangeLabel(range)}</button>
      <button type="button" aria-label="Mes siguiente" disabled={!range || range.start.slice(0, 7) >= today.slice(0, 7)} onClick={() => onApply(shiftDashboardMonth(range ?? dashboardMonth(), 1))}><ChevronRight size={18} /></button>
    </div> : <button ref={trigger} type="button" className="dashboard-calendar-fab" aria-label={`Elegir período, ${dashboardRangeLabel(range)}`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={show}><CalendarDays size={21} /></button>}
    {host ? createPortal(popup, host) : popup}
  </>;
}
