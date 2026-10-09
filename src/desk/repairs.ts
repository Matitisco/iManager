import type { RepairOrder } from '../types';
import { formatMoney, parseAppDate, statusColor, statusLabel } from './format';

export const REPAIR_RECEIVED = 'RECIBIDO';
export const REPAIR_READY = 'LISTO_PARA_RETIRAR';
export const REPAIR_DELIVERED = 'ENTREGADO';

export const DEFAULT_REPAIR_STATUSES = [
  { id: 'RECIBIDO', label: 'Recibido', color: '#9AA0AA' },
  { id: 'EN_DIAGNOSTICO', label: 'En diagnóstico', color: '#8B5CF6' },
  { id: 'ESPERANDO_REPUESTO', label: 'Esperando repuesto', color: '#E8A33D' },
  { id: 'EN_REPARACION', label: 'En reparación', color: '#5B8DEF' },
  { id: 'LISTO_PARA_RETIRAR', label: 'Listo para retirar', color: '#25A66A' },
  { id: 'ENTREGADO', label: 'Entregado', color: '#16181D' },
];

export const REPAIR_FAULTS = ['Pantalla', 'Batería', 'Pin de carga', 'Cámara', 'No enciende', 'Face ID', 'Mojado'];

export function repairFault(order: Pick<RepairOrder, 'fault' | 'faultTags'>) {
  const text = order.fault.trim();
  if (text) return text;
  if (order.faultTags.length) return order.faultTags.join(', ');
  return 'Sin detalle';
}

export function repairPrice(estimate: number | null, empty: 'quote' | 'dash', format: (value: number) => string = (value) => formatMoney(value)) {
  if (estimate == null) return empty === 'quote' ? 'A cotizar' : '—';
  return format(estimate);
}

export function dayMonth(value: string | null | undefined) {
  const date = parseAppDate(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function repairOverdue(order: Pick<RepairOrder, 'status' | 'estimatedDelivery'>, today = new Date()) {
  if (order.status === REPAIR_DELIVERED || !order.estimatedDelivery) return false;
  const due = parseAppDate(order.estimatedDelivery);
  if (!due) return false;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return target < start;
}

export function repairStatusMeta(status: string, options: { id: string; label: string; color?: string }[]) {
  const known = options.find((option) => option.id === status);
  return {
    label: known?.label ?? statusLabel(status),
    color: known?.color ?? statusColor(status),
  };
}

export function countPhrase(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
