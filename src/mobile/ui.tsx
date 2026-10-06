import type { ReactNode } from 'react';
import { IconBack, IconDown, IconEdit, IconSearch, IconTrash } from './icons';
import { useLongPress } from './use-long-press';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="whead">
      {onBack ? (
        <button type="button" className="wback" onClick={onBack} aria-label="Volver">
          <IconBack />
        </button>
      ) : null}
      <div className="wt">
        <h1>{title}</h1>
        {subtitle ? <div className="wsub">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Chips({
  items,
  current,
  onChange,
}: {
  items: string[];
  current: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="wchips">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={item === current ? 'wchip on' : 'wchip'}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="wsearch">
      <IconSearch />
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function LoadMore({
  loaded,
  total,
  loading,
  onClick,
}: {
  loaded: number;
  total: number;
  loading: boolean;
  onClick: () => void;
}) {
  if (loaded >= total) return null;
  return (
    <button type="button" className="loadmore" onClick={onClick} disabled={loading}>
      {loading ? 'Cargando…' : `Cargar más · ${loaded} de ${total}`}
    </button>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ov" onClick={onClose}>
      <div className="sheet-ov" onClick={(event) => event.stopPropagation()}>
        <div className="handle" />
        <h3>{title}</h3>
        {subtitle ? <div className="sub">{subtitle}</div> : null}
        {children}
      </div>
    </div>
  );
}

export function Dialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="ov center" onClick={onCancel}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="row">
          <button type="button" className="cancel" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className={danger ? 'ok danger' : 'ok'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContextMenu({
  title,
  top,
  onClose,
  onEdit,
  onDelete,
}: {
  title: string;
  top: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="ov ctxov" onClick={onClose}>
      <div className="popmenu ctxm" style={{ top }} onClick={(event) => event.stopPropagation()}>
        <div className="ctxh">{title}</div>
        <button type="button" onClick={onEdit}><IconEdit />Editar</button>
        <button type="button" className="danger" onClick={onDelete}><IconTrash />Eliminar</button>
      </div>
    </div>
  );
}

export function PopMenu({
  items,
  current,
  onClose,
  onPick,
}: {
  items: string[];
  current: string;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  return (
    <div className="ov menu" onClick={onClose}>
      <div className="popmenu" onClick={(event) => event.stopPropagation()}>
        {items.map((item) => (
          <button key={item} type="button" className={item === current ? 'on' : ''} onClick={() => onPick(item)}>
            {item} {item === current ? '' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel' | 'decimal';
}) {
  return (
    <label className="fl">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="fl">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Segments({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const choices = options.includes(value) || !value ? options : [value, ...options];
  return (
    <>
      {label ? <label className="fl"><span>{label}</span></label> : null}
      <div className="sgs">
        {choices.map((option) => (
          <button key={option} type="button" className={option === value ? 'sg on' : 'sg'} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </>
  );
}

export function SheetActions({
  cancelLabel = 'Cancelar',
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sacts">
      <button type="button" className="btn2 s" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
      <button type="button" className="btn2 p" onClick={onConfirm} disabled={busy}>{busy ? 'Guardando…' : confirmLabel}</button>
    </div>
  );
}

export function Pill({ status, label }: { status: string; label: string }) {
  const tone = ['Disponible', 'Completada', 'Aprobado', 'Listo'].includes(label)
    ? 'ok'
    : label === 'Rechazado'
      ? 'no'
      : label === 'Vendido'
        ? 'off'
        : status === 'ok' || status === 'no' || status === 'off' || status === 'mid'
          ? status
          : 'mid';
  return <span className={`spill ${tone}`}>{label}</span>;
}

export function Pressable({
  className,
  onOpen,
  onMenu,
  children,
}: {
  className: string;
  onOpen: () => void;
  onMenu: (point: { x: number; y: number }) => void;
  children: ReactNode;
}) {
  const { holding, ...press } = useLongPress(onMenu, onOpen);
  return (
    <div className={`${className}${holding ? ' holding' : ''}`} {...press}>
      {children}
    </div>
  );
}

export function PeriodPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="wpill" onClick={onClick}>
      {label} <IconDown />
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="sheet-error">{children}</div>;
}
