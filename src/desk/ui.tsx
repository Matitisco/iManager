import React, { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { DeskTab, Overlay } from './types';
import { useCatalogs } from './catalog';
import { statusColor, statusLabel } from './format';
import type { CatalogKind } from '../services/catalogs-api';
import { batteryColor, extractMinBattery, formatBatteryDisplay } from '../utils/inventory';
import { ImanagerIcon, nearestIconSize, statusIcon, type ImanagerIconName } from './icons';
import { usePhoneLayout } from './section-notices';

type DeskUi = {
  tab: DeskTab;
  go: (tab: DeskTab) => void;
  open: (overlay: Overlay) => void;
  openRecord: (section: string, recordId: string, kind?: string) => void;
  close: () => void;
  toast: (message: string) => void;
  isStaff: boolean;
  canManageSensitive?: boolean;
  /** En celular, vuelve a Más cuando la sección no está en la barra. */
  back?: () => void;
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

export function Pill({ status, kind }: { status: string; kind?: CatalogKind }) {
  const catalogs = useCatalogs();
  const row = kind ? catalogs?.options.find((option) => option.kind === kind && option.value === status) : undefined;
  const label = row?.label ?? statusLabel(status);
  const icon = statusIcon(status) ?? statusIcon(label);
  return (
    <span className="spill cst" style={{ ['--pc' as string]: row?.color || statusColor(status) }}>
      {icon ? <ImanagerIcon name={icon} size={16} /> : null}
      {label}
    </span>
  );
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
      {options.map((option) => {
        const icon = statusIcon(option.id) ?? statusIcon(option.label);
        return (
          <button key={option.id} className={`wchip${option.id === value ? ' on' : ''}`} onClick={() => onChange(option.id)} type="button">
            {icon ? <ImanagerIcon name={icon} size={16} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function signalDesk(name: 'desk-check' | 'desk-eq-saved', detail?: string) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function MenuButton({ label, options, value, onChange, testId, active }: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div className={`dsel${active ? ' on' : ''}`} ref={box} data-testid={testId}>
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

export function PageHead({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: React.ReactNode; back?: () => void }) {
  return (
    <div className="whead">
      {back ? <BackButton onClick={back} /> : null}
      <div className="whead-copy">
        <h1>{title}</h1>
        {subtitle ? <div className="wsub">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="wback" data-testid="page-back" aria-label="Volver" onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

export function IconButton({ label, name, pressed, disabled, onClick }: {
  label: string;
  name: ImanagerIconName;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`rbtn${pressed ? ' on' : ''}`} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <ImanagerIcon name={name} size={20} />
    </button>
  );
}

export function ScreenTitle({ title, subtitle, back, tools, desktop }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: () => void;
  tools?: React.ReactNode;
  desktop: React.ReactNode;
}) {
  const phone = usePhoneLayout();
  return (
    <div className="dtop">
      {phone && back ? <BackButton onClick={back} /> : null}
      <div className="dtitle">
        {typeof title === 'string' ? <h1>{title}</h1> : title}
        {subtitle == null ? null : typeof subtitle === 'string' ? <div className="dsub">{subtitle}</div> : subtitle}
      </div>
      {phone ? <div className="mtools">{tools}</div> : desktop}
    </div>
  );
}

export function MobileDock({ primary, onPrimary, secondary, onSecondary }: {
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="mdock" data-testid="mobile-dock">
      <button className="dbtn p" type="button" onClick={onPrimary}>
        <PlusIcon />
        {primary}
      </button>
      {secondary && onSecondary ? <button className="dbtn s" type="button" onClick={onSecondary}>{secondary}</button> : null}
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

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export function menuPosition(clientX: number, clientY: number, rect: DOMRect) {
  const top = rect.bottom + 160 < window.innerHeight ? rect.bottom + 4 : Math.max(12, rect.top - 150);
  const left = Math.min(window.innerWidth - 236, Math.max(12, clientX - 20));
  return { x: left, y: top };
}

function usePress(onMenu: (point: { x: number; y: number }) => void, onActivate: () => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const firedAt = useRef(0);
  const target = useRef<HTMLElement | null>(null);
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    target.current?.classList.remove('holding');
  };
  useEffect(() => {
    const onScroll = () => stop();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);
  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      origin.current = { x: event.clientX, y: event.clientY };
      target.current = event.currentTarget;
      event.currentTarget.classList.add('holding');
      const node = event.currentTarget;
      const x = event.clientX;
      const y = event.clientY;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        node.classList.remove('holding');
        firedAt.current = Date.now();
        onMenu(menuPosition(x, y, node.getBoundingClientRect()));
      }, 480);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (!timer.current) return;
      const dx = event.clientX - origin.current.x;
      const dy = event.clientY - origin.current.y;
      if (dx * dx + dy * dy > 64) stop();
    },
    onPointerUp() { stop(); },
    onPointerCancel() { stop(); },
    onContextMenu(event: React.MouseEvent<HTMLElement>) {
      event.preventDefault();
      stop();
      firedAt.current = Date.now();
      onMenu(menuPosition(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()));
    },
    onClick(event: React.MouseEvent) {
      if (Date.now() - firedAt.current < 700) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onActivate();
    },
  };
}

export function RowMenu({ onMenu }: { onMenu: (point: { x: number; y: number }) => void }) {
  return (
    <button
      type="button"
      className="row-more"
      data-testid="row-menu"
      aria-label="Más acciones"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onMenu(menuPosition(rect.left, rect.bottom, rect));
      }}
    >
      <span aria-hidden="true">⋯</span>
    </button>
  );
}

export function PressTarget({ as, className, testId, onActivate, onMenu, children }: {
  as: 'tr' | 'button';
  className?: string;
  testId?: string;
  onActivate: () => void;
  onMenu: (point: { x: number; y: number }) => void;
  children: React.ReactNode;
}) {
  const bind = usePress(onMenu, onActivate);
  if (as === 'button') {
    return (
      <div className="press-host">
        <button className={className} type="button" data-testid={testId} {...bind}>{children}</button>
        <RowMenu onMenu={onMenu} />
      </div>
    );
  }
  return <tr className={className} data-testid={testId} {...bind}>{children}</tr>;
}

export function Dialog({ title, text, ok, onOk, onClose, danger, busy, error, cancel = 'Cancelar' }: {
  title: string;
  text: string;
  ok: string;
  onOk: () => void;
  onClose: () => void;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  cancel?: string;
}) {
  useEscape(onClose);
  return (
    <div className="ov center" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        {error ? <div className="ferr">{error}</div> : null}
        <div className="row">
          <button type="button" className="cancel" onClick={onClose} disabled={busy}>{cancel}</button>
          <button type="button" className={`ok${danger ? ' danger' : ''}`} onClick={onOk} disabled={busy}>{ok}</button>
        </div>
      </div>
    </div>
  );
}

function isSheetFooter(node: React.ReactNode) {
  if (!isValidElement(node)) return false;
  if (node.type === Actions) return true;
  const className = (node.props as { className?: unknown }).className;
  return typeof className === 'string' && className.split(/\s+/).includes('sacts');
}

export function Sheet({ title, subtitle, children, onClose, wide, className }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  useEscape(onClose);
  const phone = usePhoneLayout();
  const nodes = Children.toArray(children);
  const foot = nodes.filter(isSheetFooter);
  const body = nodes.filter((node) => !isSheetFooter(node));

  return (
    <div className="ov" onMouseDown={onClose}>
      <div className={`sheet${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        {phone ? <div className="sheet-grab" aria-hidden="true" /> : null}
        <div className="sheet-scroll">
          <div className="sheet-h">
            <h3>{title}</h3>
            {phone ? <button type="button" className="sheet-x" aria-label="Cerrar" onClick={onClose}><ImanagerIcon name="cerrar" size={16} /></button> : null}
          </div>
          {subtitle ? <p className="sub">{subtitle}</p> : null}
          {body}
        </div>
        {foot.length > 0 ? <div className="sheet-foot">{foot}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, error, mark, children }: { label: string; error?: string; mark?: string; children?: React.ReactNode }) {
  const autoId = useId();
  const child = isValidElement<{ id?: string }>(children) ? children : null;
  const controlId = child?.props.id || autoId;
  const control = child ? cloneElement(child, { id: child.props.id || controlId }) : children;
  return (
    <div className={`fl${error ? ' bad' : ''}`}>
      <span>
        <label htmlFor={controlId}>{label}</label>
        {mark ? <em className="fl-mark" aria-hidden="true"> · {mark}</em> : null}
      </span>
      {control}
      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}

export function Segs({ options, value, onChange, onEdit, allowClear }: { options: { id: string; label: string; color?: string }[]; value: string; onChange: (id: string) => void; onEdit?: () => void; allowClear?: boolean }) {
  const withColor = options.some((option) => option.color);
  return (
    <div className={`sgs${withColor ? ' stg' : ''}`}>
      {options.map((option) => (
        <button key={option.id} type="button" className={`sg${option.id === value ? ' on' : ''}`} onClick={() => onChange(allowClear && option.id === value ? '' : option.id)}>
          {option.color ? <i style={{ background: option.color }} /> : null}
          {option.label}
        </button>
      ))}
      {onEdit ? <button type="button" className="sg-edit" aria-label="Editar opciones" onClick={onEdit}><DeskIcon name="edit" size={15} /></button> : null}
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

export function Battery({ value }: { value: string | number }) {
  const percent = Math.max(0, Math.min(100, extractMinBattery(value)));
  const color = batteryColor(percent);

  return (
    <span className="dbattery">
      <span className="dbat" aria-hidden="true">
        <motion.i initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={color.bg} />
      </span>
      <span className={`font-bold ${color.text}`}>{formatBatteryDisplay(value)}</span>
    </span>
  );
}

function SearchIcon() {
  return <ImanagerIcon name="buscar" size={16} />;
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return <ImanagerIcon name="agregar" size={16} />;
}

export function ImportButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="dbtn s" type="button" onClick={onClick}>
      <ImanagerIcon name="importar" size={16} />
      Importar
    </button>
  );
}

type DeskIconName = 'logo' | 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'bars' | 'bell' | 'note' | 'gear' | 'edit' | 'trash' | 'store' | 'lock' | 'card' | 'wrench' | 'board' | 'alert' | 'cal';

export function DeskIcon({ name, size = 18, strokeWidth = 2.1 }: { name: DeskIconName; size?: number; strokeWidth?: number }) {
  if (name === 'logo') return <ImanagerIcon name="equipo" size={nearestIconSize(size)} />;
  if (name === 'edit') return <ImanagerIcon name="editar" size={nearestIconSize(size)} />;
  if (name === 'trash') return <ImanagerIcon name="borrar" size={nearestIconSize(size)} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" data-desk-icon={name}>
      {name === 'grid' && <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>}
      {name === 'list' && <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 10h17M8 14.5h8" /></>}
      {name === 'cart' && <><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9.5" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>}
      {name === 'swap' && <path d="M7 7h12l-3-3M17 17H5l3 3" />}
      {name === 'user' && <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>}
      {name === 'bars' && <path d="M5 20V10M10 20V5M15 20v-7M20 20V8" />}
      {name === 'bell' && <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>}
      {name === 'note' && <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />}
      {name === 'store' && <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />}
      {name === 'lock' && <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}
      {name === 'card' && <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></>}
      {name === 'gear' && <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>}
      {name === 'wrench' && <path d="M14.7 6.3a4.5 4.5 0 0 0-6.2 6.1L3.5 17.4a1.6 1.6 0 0 0 2.2 2.2l5-5a4.5 4.5 0 0 0 6.1-6.2L14 11l-2-2z" />}
      {name === 'board' && <><rect x="3" y="4" width="5" height="16" rx="1.4" /><rect x="10" y="4" width="5" height="11" rx="1.4" /><rect x="17" y="4" width="4" height="7" rx="1.4" /></>}
      {name === 'alert' && <path d="M12 4l8 14H4zM12 10v4M12 16.5h.01" />}
      {name === 'cal' && <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3.5V7M16 3.5V7M4 10h16" /></>}
    </svg>
  );
}
