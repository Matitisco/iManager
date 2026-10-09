import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseReportDate } from './report-period';

const dateValue = (date: Date) => `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const displayValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
const fullDate = (date: Date) => date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const shiftMonth = (date: Date, amount: number) => {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  return new Date(next.getFullYear(), next.getMonth(), Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
};

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  panel?: 'float' | 'inline';
}

export function ReportDatePicker({ label, value, onChange, invalid, describedBy, panel = 'float' }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 296 });
  const reducedMotion = useReducedMotion();
  const close = () => { setOpen(false); field.current?.focus({ preventScroll: true }); };

  useLayoutEffect(() => {
    if (!open || panel === 'inline') return;
    const place = () => {
      const rect = field.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(296, window.innerWidth - 24);
      const height = calendar.current?.offsetHeight || 364;
      const below = rect.bottom + 8;
      setPosition({
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.max(12, below + height <= window.innerHeight - 12 ? below : rect.top - height - 8),
      });
    };
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [open, panel]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); field.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const select = (date: Date | null) => { onChange(date ? dateValue(date) : ''); close(); };
  return (
    <div ref={root} className={`fl dp-field${invalid ? ' bad' : ''}`}>
      <label className="dp-label" htmlFor={id}>{label}</label>
      <div className="dp-control">
        <input ref={field} id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" required value={displayValue(value)} aria-invalid={!!invalid} aria-describedby={describedBy}
          onChange={(event) => {
            const text = event.target.value;
            const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
            onChange(parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : text);
          }}
          onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }} />
        <button className={`dp-trigger${open ? ' on' : ''}`} type="button" aria-label={`Abrir calendario: ${label.toLowerCase()}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => open ? close() : setOpen(true)}>
          <CalendarDays size={18} strokeWidth={1.8} />
        </button>
      </div>
      <AnimatePresence>
        {open && <motion.div ref={calendar} id={`${id}-calendar`} className={`dp-calendar${panel === 'inline' ? ' inline' : ''}`} style={panel === 'inline' ? undefined : position}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 4 }} transition={{ duration: reducedMotion ? 0 : .15 }}>
          <Calendar label={label} value={value} onSelect={select} />
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}

function Calendar({ label, value, onSelect }: { label: string; value: string; onSelect: (date: Date | null) => void }) {
  const present = useIsPresent();
  const initialDate = parseReportDate(value) ?? new Date();
  const [month, setMonth] = useState(() => monthStart(initialDate));
  const [focused, setFocused] = useState(() => initialDate);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const days = useRef(new Map<string, HTMLButtonElement>());
  const today = dateValue(new Date());
  const selected = parseReportDate(value);
  const selectedValue = selected ? dateValue(selected) : null;
  const title = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const first = new Date(month);
  first.setDate(1 - ((first.getDay() + 6) % 7));
  const dates = Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
  const yearStart = Math.floor(month.getFullYear() / 12) * 12;

  useEffect(() => { if (view === 'days') days.current.get(dateValue(focused))?.focus({ preventScroll: true }); }, [focused, view]);

  const navigate = (amount: number) => {
    const next = shiftMonth(focused, amount * (view === 'days' ? 1 : view === 'months' ? 12 : 144));
    setFocused(next);
    setMonth(monthStart(next));
  };
  const dayKey = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let next: Date;
    const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
    if (offset !== undefined) next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    else if (event.key === 'Home' || event.key === 'End') next = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7) + (event.key === 'End' ? 6 : 0));
    else if (event.key === 'PageUp' || event.key === 'PageDown') next = shiftMonth(date, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
    else return;
    event.preventDefault();
    setFocused(next);
    setMonth(monthStart(next));
  };

  return (
    <div role="dialog" aria-label={`Elegir ${label.toLowerCase()}`} aria-hidden={!present} inert={!present}>
      <div className="dp-head">
        <button className="dp-nav" type="button" aria-label={view === 'days' ? 'Mes anterior' : view === 'months' ? 'Año anterior' : 'Años anteriores'} onClick={() => navigate(-1)}><ChevronLeft size={17} /></button>
        {view === 'years' ? <span className="dp-caption">{yearStart}–{yearStart + 11}</span> : <button className="dp-caption" type="button" aria-label={view === 'days' ? 'Elegir mes' : 'Elegir año'} onClick={() => setView(view === 'days' ? 'months' : 'years')}>{view === 'days' ? title.charAt(0).toUpperCase() + title.slice(1) : month.getFullYear()}</button>}
        <button className="dp-nav" type="button" aria-label={view === 'days' ? 'Mes siguiente' : view === 'months' ? 'Año siguiente' : 'Años siguientes'} onClick={() => navigate(1)}><ChevronRight size={17} /></button>
      </div>
      <div className="dp-body">
        {view === 'days' ? <>
          <div className="dp-week" aria-hidden="true">{['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="dp-grid" role="grid" aria-label={title}>
            {Array.from({ length: 6 }, (_, week) => <div className="dp-week-row" role="row" key={week}>
              {dates.slice(week * 7, week * 7 + 7).map((date) => {
                const key = dateValue(date);
                return <div role="gridcell" aria-selected={key === selectedValue} key={key}>
                  <button ref={(node) => { if (node) days.current.set(key, node); else days.current.delete(key); }} className={`dp-day${date.getMonth() !== month.getMonth() ? ' other' : ''}${key === selectedValue ? ' selected' : ''}${key === today ? ' today' : ''}`} type="button" aria-label={fullDate(date)} aria-current={key === today ? 'date' : undefined} tabIndex={key === dateValue(focused) ? 0 : -1} onKeyDown={(event) => dayKey(event, date)} onClick={() => onSelect(date)}>{date.getDate()}</button>
                </div>;
              })}
            </div>)}
          </div>
        </> : <div className="dp-choices">
          {Array.from({ length: 12 }, (_, index) => {
            const year = view === 'years' ? yearStart + index : month.getFullYear();
            const monthIndex = view === 'years' ? month.getMonth() : index;
            const date = new Date(year, monthIndex, 1);
            const label = view === 'years' ? String(year) : date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
            const active = selected?.getFullYear() === year && (view === 'years' || selected.getMonth() === monthIndex);
            return <button className={`dp-choice${active ? ' selected' : ''}`} key={index} type="button" onClick={() => {
              setMonth(date);
              setFocused(date);
              setView(view === 'years' ? 'months' : 'days');
            }}>{label}</button>;
          })}
        </div>}
      </div>
      <div className="dp-footer">
        <button className="dp-clear" type="button" onClick={() => onSelect(null)}>Borrar</button>
        <button className="dp-today" type="button" onClick={() => onSelect(new Date())}>Hoy</button>
      </div>
    </div>
  );
}
