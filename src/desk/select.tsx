import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { usePhoneLayout } from './section-notices';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  id?: string;
  label: string;
  sheetTitle?: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  'data-testid'?: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

/** Controlled single select. The native control only handles form data/validation. */
export function DeskSelect({ id: suppliedId, label, sheetTitle = label, value, options, onChange, disabled, name, required, invalid, describedBy, placeholder = 'Seleccionar', 'data-testid': testId }: Props) {
  const autoId = useId();
  const id = suppliedId ?? autoId;
  const listId = `${id}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', time: 0 });
  const phone = usePhoneLayout();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [validationError, setValidationError] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240, maxHeight: 320 });
  const selected = options.find((option) => option.value === value);
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
  const activeIndex = enabled.includes(active) ? active : enabled[0] ?? -1;
  const activeId = open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined;
  const close = (restore = true) => {
    setOpen(false);
    search.current = { text: '', time: 0 };
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  const show = (edge?: 'first' | 'last') => {
    if (disabled || !enabled.length) return;
    const current = options.findIndex((option) => option.value === value && !option.disabled);
    setActive(edge === 'first' ? enabled[0] : edge === 'last' ? enabled.at(-1)! : current >= 0 ? current : enabled[0]);
    search.current = { text: '', time: 0 };
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setValidationError(false);
    onChange(option.value);
    close();
  };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    if (phone) { list.current?.focus({ preventScroll: true }); return; }
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
      const height = Math.min(popup.current?.scrollHeight || 320, 320);
      const below = window.innerHeight - rect.bottom - 20;
      const above = rect.top - 20;
      const down = below >= height || below >= above;
      const maxHeight = Math.max(48, Math.min(320, down ? below : above));
      setPosition({ width, maxHeight, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: down ? rect.bottom + 8 : Math.max(12, rect.top - Math.min(height, maxHeight) - 8) });
    };
    trigger.current?.focus({ preventScroll: true });
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [open, phone, options.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation(); // A selector in a Sheet closes before its parent.
      close();
    };
    const focus = (event: FocusEvent) => {
      if (phone && !popup.current?.contains(event.target as Node)) list.current?.focus({ preventScroll: true });
      else if (!phone) outside(event);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', focus);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, phone]);

  useEffect(() => {
    if (!open || !phone) return;
    const host = trigger.current?.closest('.desk-app') ?? document.body;
    const background = [...host.children].filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(popup.current));
    const previous = background.map((node) => node.inert);
    background.forEach((node) => { node.inert = true; });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      background.forEach((node, index) => { node.inert = previous[index]; });
      document.body.style.overflow = overflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open, phone]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, id]);

  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      if (phone && open) {
        event.preventDefault();
        (event.target === closeButton.current ? list.current : closeButton.current)?.focus();
      } else close(false);
      return;
    }
    if (event.target === closeButton.current) return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : undefined); return; }
      const current = enabled.indexOf(activeIndex);
      setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)! : enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]);
    } else if (event.key === 'Enter' || (event.key === ' ' && (!search.current.text || Date.now() - search.current.time >= 700))) {
      event.preventDefault();
      if (open) choose(activeIndex); else show();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const time = Date.now();
      const text = (time - search.current.time < 700 ? search.current.text : '') + normalize(event.key);
      if (!open) show();
      search.current = { text, time };
      const prefix = [...text].every((char) => char === text[0]) ? text[0] : text;
      const current = enabled.indexOf(open ? activeIndex : options.findIndex((option) => option.value === value));
      const ordered = [...enabled.slice(current + 1), ...enabled.slice(0, current + 1)];
      const found = ordered.find((index) => normalize(options[index].label).startsWith(prefix));
      if (found !== undefined) setActive(found);
    }
  };

  return (
    <div className="ds-select">
      <select className="ds-select-native" aria-hidden="true" tabIndex={-1} name={name} value={value} required={required} disabled={disabled}
        onChange={(event) => { setValidationError(false); onChange(event.target.value); }}
        onInvalid={(event) => { event.preventDefault(); setValidationError(true); trigger.current?.focus(); show(); }}>
        {!options.some((option) => option.value === '') && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
      <button ref={trigger} id={id} data-testid={testId} type="button" role="combobox" className={`ds-select-trigger${open ? ' on' : ''}`}
        disabled={disabled} aria-label={label} aria-expanded={open} aria-haspopup={phone ? 'dialog' : 'listbox'} aria-controls={open ? phone ? `${id}-popup` : listId : undefined}
        aria-activedescendant={!phone ? activeId : undefined} aria-required={required} aria-invalid={invalid || validationError || undefined} aria-describedby={describedBy}
        onClick={() => open ? close() : show()} onKeyDown={keys}>
        <span>{selected?.label ?? placeholder}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && createPortal(
        <AnimatePresence>
          <div className={phone ? 'ds-select-backdrop' : 'ds-select-layer'} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => { if (event.target === event.currentTarget && phone) { event.preventDefault(); close(); } }}>
            <motion.div ref={popup} id={`${id}-popup`} className={`ds-select-popup${phone ? ' phone' : ''}`} style={phone ? undefined : position}
              role={phone ? 'dialog' : undefined} aria-modal={phone ? true : undefined} aria-label={phone ? sheetTitle : undefined}
              initial={{ opacity: 0, y: reducedMotion ? 0 : phone ? 18 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .16 }} onKeyDown={phone ? keys : undefined}>
              {phone && <><div className="ds-select-grab" aria-hidden="true" /><div className="ds-select-heading"><h3>{sheetTitle}</h3><button ref={closeButton} type="button" aria-label="Cerrar selector" onClick={() => close()}><X size={20} /></button></div></>}
              <div ref={list} id={listId} role="listbox" aria-label={label} tabIndex={phone ? 0 : -1} aria-activedescendant={phone ? activeId : undefined} className="ds-select-list">
                {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
                  className={`ds-select-option${option.value === value ? ' selected' : ''}${index === activeIndex ? ' active' : ''}`}
                  onPointerDown={(event) => event.preventDefault()} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
                  <span>{option.label}</span>{option.value === value && <Check size={18} aria-hidden="true" />}
                </div>)}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>, trigger.current?.closest('.desk-app') ?? document.body,
      )}
    </div>
  );
}
