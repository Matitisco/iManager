import { ReplayValue } from '../replay-privacy';
import type { Dispatch, SetStateAction } from 'react';
import { formatArDateTime } from '../format';
import { useMoney } from '../exchange';
import { ReasonSheet } from '../ReasonSheet';

export function clearBad(setBad: Dispatch<SetStateAction<Record<string, string>>>, key: string) {
  setBad((current) => {
    if (!current[key]) return current;
    const next = { ...current };
    delete next[key];
    return next;
  });
}

export const PAYMENTS = [
  { id: 'TRANSFERENCIA', label: 'Transferencia' },
  { id: 'EFECTIVO', label: 'Efectivo' },
  { id: 'TARJETA', label: 'Tarjeta' },
  { id: 'CRIPTO', label: 'Cripto' },
];

export const BASE_CAPS = ['64GB', '128GB', '256GB', '512GB'];

export const BASE_CONDITIONS = [
  { id: 'NUEVO', label: 'Nuevo' },
  { id: 'USADO', label: 'Usado' },
];

export const BASE_TAGS = [
  { id: 'Frecuente', label: 'Frecuente', color: '#8B5CF6' },
  { id: 'Mayorista', label: 'Mayorista', color: '#3B82F6' },
  { id: 'Nuevo', label: 'Nuevo', color: '#E8A33D' },
];

export { INVENTORY_MODELS as MODELS } from '../../../backend/src/lib/inventory-models';

export const EQ_STATUS = [
  { id: 'DISPONIBLE', label: 'Disponible', color: '#25A66A' },
  { id: 'EN_REVISION', label: 'En revisión', color: '#E8A33D' },
  { id: 'RESERVADO', label: 'Reservado', color: '#737984' },
  { id: 'VENDIDO', label: 'Vendido', color: '#737984' },
];

export const CJ_STATUS = [
  { id: 'PENDIENTE', label: 'Pendiente', color: '#E8A33D' },
  { id: 'PERITAJE TÉC.', label: 'Peritaje téc.', color: '#8B5CF6' },
  { id: 'EN REVISIÓN', label: 'En revisión', color: '#3B82F6' },
  { id: 'APROBADO', label: 'Aprobado', color: '#25A66A' },
  { id: 'LISTO', label: 'Completado', color: '#0F9D8A' },
  { id: 'RECHAZADO', label: 'Rechazado', color: '#DC4C4C' },
];

export function stampedCurrency(value: string | null | undefined): 'ARS' | 'USD' | undefined {
  return value === 'ARS' || value === 'USD' ? value : undefined;
}

export function ConfirmOperationDialog({ title, label, refund, depositCredit, coveredCredit, currency, busy, error, onClose, onOk }: {
  title: string;
  label: string;
  refund: number;
  depositCredit?: number;
  coveredCredit?: number;
  currency?: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onOk: (reason: string) => void;
}) {
  const money = useMoney();
  const text = <>{label} se anulará y quedará en el historial.
    {refund > 0 ? <> Se devolverán <ReplayValue>{money.show(refund, currency)}</ReplayValue>.</> : null}
    {coveredCredit ? <> El pago general que cubría esta venta queda como saldo a favor (<ReplayValue>{money.show(coveredCredit, currency)}</ReplayValue>).</> : null}
    {depositCredit ? " Las señas aplicadas vuelven como saldo a favor, sin devolución de ese anticipo." : ""}
  </>;
  return (
    <ReasonSheet
      title={title}
      note={text}
      ok="Anular"
      cancel="Volver"
      danger
      busy={busy}
      error={error}
      onClose={onClose}
      onOk={onOk}
    />
  );
}

// Falls back to copying when the browser cannot share; closing the share sheet does nothing.
export function shareOrCopy(data: ShareData, copy: () => Promise<unknown>) {
  if (!navigator.share) { void copy(); return; }
  navigator.share(data).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    void copy();
  });
}

export function AuditLine({ action, by, at }: { action: string; by?: string | null; at?: string | null }) {
  if (!by || !at) return null;
  return <p className="eqs-note">{action} por {by} el {formatArDateTime(at)}</p>;
}

export type FormProps = { run: (action: () => Promise<unknown>, ok: string, options?: { keepOpen?: boolean; afterSuccess?: () => void }) => Promise<void>; busy: boolean; error: string | null };
