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
  return <span className="spill" style={{ ['--pc' as string]: statusColor(status) }}>{statusLabel(status)}</span>;
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
    <div className="dsel sm">
      <button type="button" onClick={() => setOpen((current) => !current)}>{label}</button>
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
  return (
    <div className="sgs">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
