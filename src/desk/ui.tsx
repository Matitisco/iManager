import React, { Children, cloneElement, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useCatalogs } from './catalog';
import { isVoidRow, statusColor, statusLabel } from './format';
import type { CatalogKind } from '../services/catalogs-api';
import { batteryColor, extractMinBattery, formatBatteryDisplay } from '../utils/inventory';
import { ModalCloseButton } from './close-button';
import { ImanagerIcon, nearestIconSize, statusIcon, type ImanagerIconName } from './icons';
import { GroupTabs } from './group-tabs';
import { usePhoneLayout } from './section-notices';
import { SelectionCheckbox, type RowSelection } from './bulk-selection';
import { ModalLayerContext, useModalLayer } from './modal-layer';
import './sheet-detail.css';

import type { DeskUi } from './desk-context';
import { DeskContext } from './desk-context';

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
  const row = kind && !isVoidRow({ status }) ? catalogs?.options.find((option) => option.kind === kind && option.value === status) : undefined;
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
      <input value={value} placeholder={placeholder} autoComplete="off" autoCorrect="off" spellCheck={false} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function ChipRow({ options, value, onChange, pressed, onToggle }: {
  options: { id: string; label: string; color?: string }[];
  value?: string;
  onChange?: (id: string) => void;
  pressed?: (id: string) => boolean;
  onToggle?: (id: string) => void;
}) {
  return (
    <div className="wchips">
      {options.map((option) => {
        const icon = statusIcon(option.id) ?? statusIcon(option.label);
        const on = pressed ? pressed(option.id) : option.id === value;
        return (
          <button
            key={option.id}
            className={`wchip${option.color ? ' semantic' : ''}${on ? ' on' : ''}`}
            style={option.color ? { ['--chip-color' as string]: option.color } : undefined}
            aria-pressed={on}
            onClick={() => (onToggle ? onToggle(option.id) : onChange?.(option.id))}
            type="button"
          >
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
  const menu = useRef<HTMLDivElement>(null);
  const [menuLeft, setMenuLeft] = useState<number>();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!box.current || !menu.current) return;
      const anchor = box.current.getBoundingClientRect();
      const width = menu.current.getBoundingClientRect().width;
      const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - 12 - width));
      setMenuLeft(left - anchor.left);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
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
        <div ref={menu} className="menu" style={menuLeft === undefined ? undefined : { left: menuLeft, right: 'auto' }}>
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

export function PageHead({ title, action, back }: { title: string; action?: React.ReactNode; back?: () => void }) {
  return (
    <>
      <div className="whead">
        {back ? <BackButton onClick={back} /> : null}
        <div className="whead-copy">
          <h1>{title}</h1>
        </div>
        {action}
      </div>
      <GroupTabs />
    </>
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

export function ScreenTitle({ title, back, tools, desktop, navigation }: {
  title: React.ReactNode;
  back?: () => void;
  tools?: React.ReactNode;
  desktop: React.ReactNode;
  navigation?: React.ReactNode;
}) {
  const phone = usePhoneLayout();
  return (
    <>
      <div className="dtop">
        {phone && back ? <BackButton onClick={back} /> : null}
        <div className="dtitle">
          {typeof title === 'string' ? <h1>{title}</h1> : title}
        </div>
        {phone ? <div className="mtools">{tools}</div> : desktop}
      </div>
      {navigation === undefined ? <GroupTabs /> : navigation}
    </>
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

export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export function menuPosition(clientX: number, clientY: number, button?: DOMRect) {
  return {
    x: clientX,
    y: clientY,
    ...(button ? { anchorTop: button.top, anchorBottom: button.bottom, anchorRight: button.right } : {}),
  };
}

function usePress(onMenu: ((point: { x: number; y: number }) => void) | undefined, onActivate: () => void) {
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
    return () => { stop(); window.removeEventListener('scroll', onScroll, true); };
  }, []);
  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (!onMenu) return;
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
        onMenu?.(menuPosition(x, y));
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
      if (!onMenu) return;
      firedAt.current = Date.now();
      onMenu(menuPosition(event.clientX, event.clientY));
    },
    onDragStart() { stop(); },
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

export function PressTarget({ as, className, testId, onActivate, onMenu, draggable, grabbed, onDragStart, onDragEnd, selection, children }: {
  as: 'tr' | 'button';
  className?: string;
  testId?: string;
  onActivate: () => void;
  onMenu?: (point: { x: number; y: number }) => void;
  draggable?: boolean;
  grabbed?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
  selection?: RowSelection;
  children: React.ReactNode;
}) {
  const bind = usePress(onMenu, () => as === 'button' && selection?.active ? selection.toggle() : onActivate());
  const visible = selection && selection.visible !== false;
  const checkbox = visible ? <SelectionCheckbox checked={selection.checked} disabled={selection.disabled} label={selection.label} onToggle={selection.toggle} /> : null;
  const rowClass = `${className ?? ''}${selection?.checked ? ' bulk-selected' : ''}`.trim() || undefined;
  const drag = draggable ? {
    draggable: true as const,
    'aria-grabbed': Boolean(grabbed),
    onDragStart: (event: React.DragEvent<HTMLElement>) => {
      bind.onDragStart();
      onDragStart?.(event);
    },
    onDragEnd,
  } : {};
  if (as === 'button') {
    return (
      <div className={`press-host${visible ? ' bulk-row' : ''}${selection?.checked ? ' bulk-selected' : ''}`}>
        {checkbox}
        <button className={rowClass} type="button" data-testid={testId} disabled={selection?.disabled} {...bind} {...drag}>{children}</button>
        {selection?.active || !onMenu ? null : <RowMenu onMenu={onMenu} />}
      </div>
    );
  }
  // Keep the checkbox's record-specific label out of the cell's accessible name.
  return <tr className={rowClass} data-testid={testId} {...bind} {...drag}>{selection ? <td className="bulk-cell" aria-label="Selección">{checkbox}</td> : null}{children}</tr>;
}

export function Dialog({ title, text, ok, onOk, onClose, danger, busy, error, cancel = 'Cancelar', className, extra }: {
  title: string;
  text: string;
  ok: string;
  onOk: () => void;
  onClose: () => void;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  cancel?: string;
  className?: string;
  extra?: { label: string; onClick: () => void } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const modal = useModalLayer({ ref, onClose, busy, initialFocus: cancelRef });
  return (
    <ModalLayerContext.Provider value={modal.scope}>
    <div className="ov center" onMouseDown={modal.requestClose}>
      <div ref={ref} tabIndex={-1} className={`dialog${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        {error ? <div className="ferr">{error}</div> : null}
        <div className="row">
          <button ref={cancelRef} type="button" className="cancel" onClick={modal.requestClose} disabled={busy}>{cancel}</button>
          {extra ? <button type="button" className="ok" onClick={extra.onClick} disabled={busy}>{extra.label}</button> : null}
          <button type="button" className={`ok${danger ? ' danger' : ''}`} onClick={onOk} disabled={busy}>{ok}</button>
        </div>
      </div>
    </div>
    </ModalLayerContext.Provider>
  );
}

function isSheetFooter(node: React.ReactNode) {
  if (!isValidElement(node)) return false;
  if (node.type === Actions) return true;
  const className = (node.props as { className?: unknown }).className;
  return typeof className === 'string' && className.split(/\s+/).includes('sacts');
}

export function Sheet({ title, titleAccessory, subtitle, children, onClose, busy = false, wide, className, footer, variant = 'default', overlayClassName, mobileBack = false }: { title: string; titleAccessory?: React.ReactNode; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void; busy?: boolean; wide?: boolean; className?: string; variant?: 'default' | 'detail'; overlayClassName?: string; mobileBack?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const modal = useModalLayer({ ref, onClose, busy });
  const phone = usePhoneLayout();
  const nodes = Children.toArray(children);
  const foot = footer !== undefined ? Children.toArray(footer) : nodes.filter(isSheetFooter);
  const body = footer !== undefined ? nodes : nodes.filter((node) => !isSheetFooter(node));

  return (
    <ModalLayerContext.Provider value={modal.scope}>
    <div className={`ov${overlayClassName ? ` ${overlayClassName}` : ''}`} onMouseDown={modal.requestClose}>
      <div ref={ref} tabIndex={-1} className={`sheet sheet-frame${variant === 'detail' ? ' sheet-detail' : ''}${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        {phone && !mobileBack ? <div className="sheet-grab" aria-hidden="true" /> : null}
        <div className="sheet-h">
          {phone && mobileBack ? <BackButton onClick={modal.requestClose} /> : null}
          <div className="sheet-title">
            <h3>{title}</h3>
            {titleAccessory}
            {subtitle ? <p className="sub">{subtitle}</p> : null}
          </div>
          {!phone || !mobileBack ? <ModalCloseButton onClick={modal.requestClose} disabled={busy} /> : null}
        </div>
        <div className="sheet-scroll">
          {body}
        </div>
        {foot.length > 0 ? <div className="sheet-foot">{foot}</div> : null}
      </div>
    </div>
    </ModalLayerContext.Provider>
  );
}

export function Field({ label, error, mark, children }: { label: string; error?: string; mark?: string; children?: React.ReactNode }) {
  const autoId = useId();
  const child = isValidElement<{ id?: string }>(children) ? children : null;
  const controlId = child?.props.id || autoId;
  const errorId = `${autoId}-error`;
  const input = child && typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type);
  const control = child ? cloneElement(child, {
    id: child.props.id || controlId,
    ...(input && error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}),
  }) : children;
  return (
    <div className={`fl${error ? ' bad' : ''}`}>
      <span>
        <label htmlFor={controlId}>{label}</label>
        {mark ? <em className="fl-mark" aria-hidden="true"> · {mark}</em> : null}
      </span>
      {control}
      {error ? <div id={errorId} className="err">{error}</div> : null}
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

export function Actions({ primary, onPrimary, secondary = 'Cancelar', onSecondary, busy, danger, more, busyLabel = 'Guardando…' }: {
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary: () => void;
  busy?: boolean;
  danger?: boolean;
  more?: React.ReactNode;
  busyLabel?: string;
}) {
  return (
    <div className="sacts sheet-actions">
      <button type="button" className="btn2 s sheet-secondary" onClick={onSecondary} disabled={busy}>{secondary}</button>
      {more ? <SheetActionMenu>{more}</SheetActionMenu> : null}
      <button type="button" className={`btn2 ${danger ? 'danger' : 'p'} sheet-primary`} onClick={onPrimary} disabled={busy}>{busy ? busyLabel : primary}</button>
    </div>
  );
}

/** Native disclosure for actions that are valid but secondary to the current state. */
export function SheetActionMenu({ children, label = 'Más acciones' }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const close = (returnFocus: boolean) => {
    if (!ref.current?.open) return;
    ref.current.open = false;
    if (returnFocus) summaryRef.current?.focus();
  };
  return (
    <details
      className="sheet-action-menu"
      ref={ref}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape' || !ref.current?.open) return;
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) close(true);
      }}
    >
      <summary ref={summaryRef}>{label}</summary>
      <div className="sheet-action-menu-list" role="group" aria-label={label}>{children}</div>
    </details>
  );
}

export function SheetActions({ children }: { children: React.ReactNode }) {
  return <div className="sacts sheet-actions">{children}</div>;
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

type DeskIconName = 'comisiones' | 'logo' | 'grid' | 'list' | 'cart' | 'swap' | 'user' | 'bars' | 'bell' | 'note' | 'gear' | 'edit' | 'trash' | 'store' | 'lock' | 'card' | 'wrench' | 'board' | 'alert' | 'cal' | 'clock' | 'register';

export function DeskIcon({ name, size = 18, strokeWidth = 2.1 }: { name: DeskIconName; size?: number; strokeWidth?: number }) {
  if (name === 'comisiones') return <ImanagerIcon name="comisiones" size={nearestIconSize(size)} />;
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
      {name === 'clock' && <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>}
      {name === 'note' && <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />}
      {name === 'store' && <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />}
      {name === 'register' && <><rect x="6" y="3.5" width="12" height="5" rx="1.4" /><path d="M9 6h4M8 8.5V12M16 8.5V12" /><rect x="3.5" y="12" width="17" height="8" rx="1.8" /><path d="M3.5 16h17" /></>}
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
