import React, { createContext, useContext, useEffect, useState } from 'react';
import type { DeskTab, Overlay } from './types';
import { statusColor, statusLabel } from './format';

type DeskUi = {
  tab: DeskTab;
  go: (tab: DeskTab) => void;
  open: (overlay: Overlay) => void;
  close: () => void;
  toast: (message: string) => void;
  isStaff: boolean;
};

const DeskContext = createContext<DeskUi | null>(null);

export function DeskProvider({ value, children }: { value: DeskUi; children: React.ReactNode }) {
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const value = useContext(DeskContext);
  if (!value) throw new Error('Desk UI fuera de contexto');
  return value;
}

export function Pill({ status }: { status: string }) {
  return <span className="spill cst" style={{ ['--pc' as string]: statusColor(status) }}>{statusLabel(status)}</span>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="xsearch">
      <SearchIcon />
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function ChipRow({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="wchips">
      {options.map((option) => (
        <button key={option.id} className={`wchip${option.id === value ? ' on' : ''}`} onClick={() => onChange(option.id)} type="button">
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MenuButton({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dsel">
      <button type="button" onClick={() => setOpen((current) => !current)}>
        {label}
        <ChevronIcon />
      </button>
      {open && (
        <div className="menu">
          {options.map((option) => (
            <button key={option} type="button" className={option === value ? 'on' : ''} onClick={() => { onChange(option); setOpen(false); }}>
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="whead">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="wsub">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function DeskCta({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="dbtn p" type="button" onClick={onClick}>
      <PlusIcon />
      {children}
    </button>
  );
}

export function Sheet({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ov" onMouseDown={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        {subtitle ? <p className="sub">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="fl"><span>{label}</span>{children}</label>;
}

export function Segs({ options, value, onChange }: { options: { id: string; label: string; color?: string }[]; value: string; onChange: (id: string) => void }) {
  const withColor = options.some((option) => option.color);
  return (
    <div className={`sgs${withColor ? ' stg' : ''}`}>
      {options.map((option) => (
        <button key={option.id} type="button" className={`sg${option.id === value ? ' on' : ''}`} onClick={() => onChange(option.id)}>
          {option.color ? <i style={{ background: option.color }} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Actions({ primary, onPrimary, secondary = 'Cancelar', onSecondary, busy, danger }: {
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="sacts">
      <button type="button" className="btn2 s" onClick={onSecondary} disabled={busy}>{secondary}</button>
      <button type="button" className={`btn2 ${danger ? 'danger' : 'p'}`} onClick={onPrimary} disabled={busy}>{busy ? 'Guardando…' : primary}</button>
    </div>
  );
}

export function Battery({ value }: { value: number }) {
  return <span><span className="dbat"><i style={{ width: `${value}%` }} /></span>{value}%</span>;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

type DeskIconName = 'logo' | 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'bars' | 'bell' | 'gear' | 'edit' | 'trash';

export function DeskIcon({ name, size = 18, strokeWidth = 2.1 }: { name: DeskIconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {name === 'logo' && <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>}
      {name === 'grid' && <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>}
      {name === 'list' && <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 10h17M8 14.5h8" /></>}
      {name === 'cart' && <><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9.5" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>}
      {name === 'swap' && <path d="M7 7h12l-3-3M17 17H5l3 3" />}
      {name === 'user' && <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>}
      {name === 'bars' && <path d="M5 20V10M10 20V5M15 20v-7M20 20V8" />}
      {name === 'bell' && <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>}
      {name === 'gear' && <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>}
      {name === 'edit' && <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>}
      {name === 'trash' && <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />}
    </svg>
  );
}
