import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useModalLayer, ModalLayerContext } from './modal-layer';
import { parseReportDate } from './report-period';
import { CALENDAR_GAP, CALENDAR_HEIGHT, placeCalendar } from './date-picker-position';

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
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  error?: string;
  panel?: 'float' | 'inline';
  boundary?: 'sheet';
}

export function DatePicker({ label, value, onChange, invalid, describedBy, required = false, disabled = false, ariaLabel, error, panel = 'float', boundary }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 296, maxHeight: 364 });
  const reducedMotion = useReducedMotion();
  const close = () => { modal.scope.trigger = field.current; setOpen(false); };
  const modal = useModalLayer({ ref: calendar, onClose: close, enabled: open && !disabled });
  const hasError = Boolean(invalid || error);
  const description = [describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined;

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    if (panel === 'inline') {
      const body = root.current?.closest<HTMLElement>('.sheet-scroll');
      const node = calendar.current;
      if (body && node) {
        const bodyRect = body.getBoundingClientRect();
        const panelRect = node.getBoundingClientRect();
        // Reveal the inline panel inside the form, above its fixed footer.
        body.scrollTop += Math.max(0, panelRect.bottom - bodyRect.bottom + CALENDAR_GAP);
      }
      return;
    }
    const body = boundary === 'sheet' ? root.current?.closest<HTMLElement>('.sheet-scroll') : null;
    const place = (reveal = false) => {
      let rect = field.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBounds = {
        left: viewportLeft + 12,
        right: viewportLeft + viewportWidth - 12,
        top: viewportTop + 12,
        bottom: viewportTop + viewportHeight - 12,
      };
      if (body) {
        const bodyRect = body.getBoundingClientRect();
        const bounds = {
          left: Math.max(viewportLeft + 12, bodyRect.left + 8),
          right: Math.min(viewportLeft + viewportWidth - 12, bodyRect.right - 8),
          top: Math.max(viewportTop + 12, bodyRect.top + 8),
          bottom: Math.min(viewportTop + viewportHeight - 12, bodyRect.bottom - 8),
        };
        // scrollHeight preserves the full panel height after maxHeight constrains it.
        const node = calendar.current;
        const height = node?.offsetHeight ? node.scrollHeight + node.offsetHeight - node.clientHeight : CALENDAR_HEIGHT;
        const below = bounds.bottom - rect.bottom - CALENDAR_GAP;
        const above = rect.top - bounds.top - CALENDAR_GAP;
        if (reveal && height > Math.max(below, above) && height <= bounds.bottom - bounds.top - rect.height - CALENDAR_GAP) {
          // Move only the form, just enough to fit the panel next to its field.
          const available = Math.max(0, bounds.bottom - bounds.top - rect.height - CALENDAR_GAP);
          body.scrollTop += below >= above
            ? Math.max(0, Math.min(height, available) - below)
            : -Math.max(0, Math.min(height, available) - above);
          rect = field.current!.getBoundingClientRect();
        }
        if (rect.bottom <= bounds.top || rect.top >= bounds.bottom) { close(); return; }
        setPosition(placeCalendar(rect, bounds, height, viewportBounds));
        return;
      }
      const width = Math.min(296, viewportWidth - 24);
      const height = Math.min(calendar.current?.offsetHeight || 364, viewportHeight - 24);
      const below = rect.bottom + 8;
      setPosition({
        width,
        maxHeight: viewportHeight - 24,
        left: Math.max(viewportLeft + 12, Math.min(rect.left, viewportLeft + viewportWidth - width - 12)),
        top: Math.max(viewportTop + 12, Math.min(below + height <= viewportTop + viewportHeight - 12 ? below : rect.top - height - 8, viewportTop + viewportHeight - height - 12)),
      });
    };
    place(true);
    const update = () => place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (calendar.current) observer?.observe(calendar.current);
    if (body) {
      observer?.observe(body);
      if (field.current) observer?.observe(field.current);
      document.addEventListener('animationend', update, true);
    }
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => { observer?.disconnect(); window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update); window.removeEventListener('resize', update); document.removeEventListener('scroll', update, true); document.removeEventListener('animationend', update, true); };
  }, [open, disabled, panel, boundary]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node) && !calendar.current?.contains(event.target as Node)) { modal.scope.trigger = event.target instanceof HTMLElement ? event.target : null; setOpen(false); } };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  const select = (date: Date | null) => { onChange(date ? dateValue(date) : ''); close(); };
  const popup = <AnimatePresence>
    {open && !disabled && <ModalLayerContext.Provider value={modal.scope}><motion.div ref={calendar} id={`${id}-calendar`} tabIndex={-1} className={`dp-calendar${panel === 'inline' ? ' dp-inline' : ''}`} style={panel === 'inline' ? undefined : position}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 4 }} transition={{ duration: reducedMotion ? 0 : .15 }}>
      <Calendar label={ariaLabel ?? label} value={value} onSelect={select} />
    </motion.div></ModalLayerContext.Provider>}
  </AnimatePresence>;
  return (
    <div ref={root} className={`fl dp-field${hasError ? ' bad' : ''}`}>
      <label className="dp-label" htmlFor={id}>{label}</label>
      <div className="dp-control">
        <input ref={field} id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" required={required} disabled={disabled} value={displayValue(value)} aria-label={ariaLabel} aria-invalid={hasError} aria-describedby={description}
          onFocus={() => { if (open) close(); }}
          onChange={(event) => {
            const text = event.target.value;
            const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
            onChange(parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : text);
          }}
          onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }} />
        <button disabled={disabled} className={`dp-trigger${open ? ' on' : ''}`} type="button" aria-label={`Abrir calendario: ${label.toLowerCase()}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => open ? close() : setOpen(true)}>
          <CalendarDays size={18} strokeWidth={1.8} />
        </button>
      </div>
      {panel === 'inline' ? popup : createPortal(popup, root.current?.closest('.desk-app') ?? document.body)}
      {error ? <div className="err" id={`${id}-error`} role="alert">{error}</div> : null}
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
