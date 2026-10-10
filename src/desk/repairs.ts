import type { RepairOrder } from '../types';
import { formatMoney, parseAppDate, statusColor, statusLabel } from './format';

export const REPAIR_RECEIVED = 'RECIBIDO';
export const REPAIR_READY = 'LISTO_PARA_RETIRAR';
export const REPAIR_DELIVERED = 'ENTREGADO';

// Keep this list aligned with backend/src/modules/repairs/retire-repair-statuses.ts.
const RETIRED_REPAIR_STATUS_VALUES = ['EN_DIAGNOSTICO', 'ESPERANDO_REPUESTO', 'ESPERANDO_RESPUESTA'] as const;
const RETIRED_REPAIR_STATUS_LABELS = ['en diagnostico', 'esperando repuesto', 'esperando respuesta'];
const KEPT_REPAIR_STATUSES = new Set(['RECIBIDO', 'EN_REPARACION', 'LISTO_PARA_RETIRAR', 'ENTREGADO']);

export const DEFAULT_REPAIR_STATUSES = [
  { id: 'RECIBIDO', label: 'Recibido', color: '#9AA0AA' },
  { id: 'EN_REPARACION', label: 'En reparación', color: '#5B8DEF' },
  { id: 'LISTO_PARA_RETIRAR', label: 'Listo para retirar', color: '#25A66A' },
  { id: 'ENTREGADO', label: 'Entregado', color: '#16181D' },
];

export function normalizeRepairStatusLabel(label: string) {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isRetiredRepairStatus(value: string, label?: string | null) {
  if (KEPT_REPAIR_STATUSES.has(value)) return false;
  if ((RETIRED_REPAIR_STATUS_VALUES as readonly string[]).includes(value)) return true;
  if (label && RETIRED_REPAIR_STATUS_LABELS.includes(normalizeRepairStatusLabel(label))) return true;
  return false;
}

export function repairColumnStatus(status: string) {
  return isRetiredRepairStatus(status) ? REPAIR_RECEIVED : status;
}

type RepairStatusChoice = { id: string; label: string; color?: string };

export function visibleRepairStatuses(known: RepairStatusChoice[], orders: { status: string }[] = []) {
  const active = known.filter((status) => !isRetiredRepairStatus(status.id, status.label));
  const extra = [...new Set(orders.map((order) => order.status))].filter(
    (status) => !isRetiredRepairStatus(status) && !active.some((item) => item.id === status),
  );
  return [
    ...active,
    ...extra.map((id) => ({ id, label: repairStatusMeta(id, []).label, color: repairStatusMeta(id, []).color })),
  ];
}

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

export function repairStatusChangeNotice(
  previousStatus: string,
  saved: { status: string; whatsappUrl: string | null; notifyWhatsapp: boolean },
  statuses: RepairStatusChoice[],
) {
  const becameReady = previousStatus !== REPAIR_READY && saved.status === REPAIR_READY;
  return {
    message: `Pasó a ${repairStatusMeta(saved.status, statuses).label}`,
    whatsappUrl: becameReady ? saved.whatsappUrl : null,
    missingPhone: Boolean(becameReady && saved.notifyWhatsapp && !saved.whatsappUrl),
  };
}

export function presentRepairStatusChange(
  notice: ReturnType<typeof repairStatusChangeNotice>,
  toast: (message: string) => void,
) {
  if (notice.whatsappUrl) window.open(notice.whatsappUrl, '_blank', 'noopener,noreferrer');
  else if (notice.missingPhone) toast('La orden está lista, pero el cliente no tiene teléfono para WhatsApp.');
  toast(notice.message);
}

export function countPhrase(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
