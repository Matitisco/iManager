import type { ReactNode } from 'react';
import { novedadesLabel } from './section-notices';
import { PressTarget } from './ui';

export function NoticesBar({ count, active, onToggle }: { count: number; active: boolean; onToggle: () => void }) {
  if (count <= 0) return null;
  return (
    <button className={`novedades${active ? ' on' : ''}`} type="button" data-testid="section-notices" aria-pressed={active} onClick={onToggle}>
      <span>{novedadesLabel(count)}</span>
      <small>{active ? 'Ver todas' : 'Ver'}</small>
    </button>
  );
}

export function NoticeTag({ reason }: { reason?: string }) {
  if (!reason) return null;
  return <span className="novedad-tag" data-testid="notice-reason">{reason}</span>;
}

export function PhoneRecords({ children }: { children: ReactNode }) {
  return <div className="phone-rows" data-testid="phone-rows">{children}</div>;
}

export function PhoneRecord({
  reason,
  onActivate,
  onMenu,
  children,
}: {
  reason?: string;
  onActivate: () => void;
  onMenu: (point: { x: number; y: number }) => void;
  children: ReactNode;
}) {
  return (
    <PressTarget as="button" className={reason ? 'phone-row novedad' : 'phone-row'} onActivate={onActivate} onMenu={onMenu}>
      {children}
      <NoticeTag reason={reason} />
    </PressTarget>
  );
}
