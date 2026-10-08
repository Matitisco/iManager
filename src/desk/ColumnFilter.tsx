import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ImanagerIcon } from './icons';

export function ColumnFilter({ label, open, onToggle, active, align = 'left', onClear, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  align?: 'left' | 'right';
  onClear: () => void;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 248;
      const left = align === 'right'
        ? Math.max(8, rect.right - width)
        : Math.min(rect.left, window.innerWidth - width - 8);
      setPoint({ top: rect.bottom + 8, left });
    };
    const down = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.current?.contains(target) || popover.current?.contains(target)) return;
      onToggle();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggle();
    };
    place();
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [align, onToggle, open]);

  const host = document.querySelector('.desk-app') ?? document.body;
  return (
    <span className="thfil">
      <button ref={anchor} type="button" className={active ? 'on' : ''} aria-label={`Filtrar ${label}`} aria-expanded={open} aria-pressed={active} onClick={onToggle}>
        <ImanagerIcon name="filtrar" size={16} active={active} />
      </button>
      {open ? createPortal(
        <div ref={popover} className="thpop" role="dialog" aria-label={`Filtrar ${label}`} style={{ top: point.top, left: point.left }}>
          {children}
          {active ? <button className="clear" type="button" onClick={() => { onClear(); onToggle(); }}>Limpiar</button> : null}
        </div>,
        host,
      ) : null}
    </span>
  );
}
