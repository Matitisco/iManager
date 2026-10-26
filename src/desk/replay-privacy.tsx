import type { ReactNode } from 'react';

/** Inline data only: no layout box or span styles from the surrounding screen. */
export function ReplayValue({ children }: { children: ReactNode }) {
  return <data data-ph-mask style={{ display: 'contents' }}>{children}</data>;
}

/** Field labels shared by saved audit changes and detail rows. */
export function maskReplayHistoryValue(label: string, entityType: string): true | undefined {
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(imei|serie|serial|cliente|telefono|email|correo|dni|precio|costo|importe|monto|total|saldo|deuda|presupuesto|sena|anticipo|valor tomado|diferencia|comision)\b/.test(normalized)
    || (entityType === 'client' && normalized === 'nombre') ? true : undefined;
}

/** Preserve the existing text nodes for non-sensitive audit values. */
export function ReplayHistoryValue({ label, entityType, children }: { label: string; entityType: string; children: ReactNode }) {
  return maskReplayHistoryValue(label, entityType) ? <ReplayValue>{children}</ReplayValue> : <>{children}</>;
}
