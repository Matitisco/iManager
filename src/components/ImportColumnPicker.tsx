import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Search, X } from 'lucide-react';
import { useModalLayer } from '../desk/modal-layer';
import { usePhoneLayout } from '../desk/section-notices';
import { ReplayValue } from '../desk/replay-privacy';

export const normalizeFieldSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function ImportColumnPicker({ anchor, title, value, options, initialSearch, children, onChoose, onClose }: {
  anchor: HTMLElement;
  title: string;
  value: string;
  options: { value: string; label: string; letter?: string }[];
  initialSearch: string;
  children?: React.ReactNode;
  onChoose: (value: string) => void;
  onClose: () => void;
}) {
  const phone = usePhoneLayout();
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialSearch);
  const [position, setPosition] = useState({ left: 12, top: 12, maxHeight: 420 });
  useModalLayer({ ref: popup, onClose, initialFocus: search });
  useLayoutEffect(() => {
    if (phone) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const height = Math.min(460, popup.current?.scrollHeight || 420);
      const below = window.innerHeight - rect.bottom - 20;
      const down = below >= height || below >= rect.top - 20;
      const maxHeight = Math.min(460, Math.max(120, down ? below : rect.top - 20));
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 312)), top: down ? rect.bottom + 8 : Math.max(12, rect.top - Math.min(height, maxHeight) - 8), maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [anchor, phone, children]);
  const filtered = options.filter(option => normalizeFieldSearch(option.label).includes(normalizeFieldSearch(query)));
  return createPortal(<div className={`imp-picker-layer${phone ? ' imp-picker-mobile' : ''}`} onMouseDown={event => {
    event.stopPropagation();
  }} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <div ref={popup} className="imp-picker" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={phone ? undefined : position}>
      {phone && <div className="sheet-grab" aria-hidden="true" />}
      <div className="imp-picker-heading"><b><ReplayValue>{title}</ReplayValue></b><button type="button" className="modal-x" aria-label="Cerrar selector" onClick={onClose}><X size={20} /></button></div>
      {children || <>
        <label className="imp-picker-search"><Search size={18} aria-hidden="true" /><input ref={search} aria-label="Buscar campo" placeholder="Buscar campo" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); popup.current?.querySelector<HTMLButtonElement>('[data-field-option]')?.focus(); }
        }} /></label>
        <div className="imp-picker-options" role="group" aria-label="Campos existentes" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
          const index = controls.indexOf(event.target as HTMLButtonElement);
          controls[event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length]?.focus();
        }}>
          {filtered.map(option => <button type="button" key={option.value} data-field-option aria-label={option.label} aria-description={option.letter ? `Usado en columna ${option.letter}` : undefined} aria-pressed={option.value === value} onClick={() => onChoose(option.value)}>
            <span><ReplayValue>{option.label}</ReplayValue></span><span className="imp-picker-used">{option.value === value && <Check size={16} aria-hidden="true" />}{option.letter && <span className="imp-letter" aria-label={`Usado en columna ${option.letter}`}>{option.letter}</span>}</span>
          </button>)}
          {!filtered.length && <div className="wempty">Sin coincidencias</div>}
        </div>
        <div className="imp-picker-actions"><button type="button" className="imp-picker-new" onClick={() => onChoose('__new')}><Plus size={20} aria-hidden="true" />Nuevo campo…</button><button type="button" onClick={() => onChoose('ignore')}>Descartar</button></div>
      </>}
    </div>
  </div>, anchor.closest('.desk-app') ?? document.body);
}
