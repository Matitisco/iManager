import type { Client, Product, Sale, TradeIn } from '../types';

const MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

export function parseAppDate(value: string | null | undefined): Date | null {
  if (!value || value === 'N/A' || value === '—') return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const named = trimmed.toLowerCase().match(/^(\d{1,2})\s+([a-zñáéíóú]+)\.?\s+(\d{4})$/i);
  if (named) {
    const key = named[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3);
    const month = MONTHS[key];
    if (month != null) return new Date(Number(named[3]), month, Number(named[1]));
  }
  const numeric = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numeric) return new Date(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
  return null;
}

export function formatMoney(value: number): string {
  const amount = Number.isFinite(value) ? Math.round(value) : 0;
  return `$ ${new Intl.NumberFormat('es-AR').format(amount)}`;
}

export function formatShortDate(value: string | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDayMonth(value: string | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return '';
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function relTime(value: string | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 2) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 h' : `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function formatMoneyCompact(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  if (Math.abs(amount) >= 1_000_000) {
    const compact = (amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    return `$ ${compact}M`;
  }
  return formatMoney(amount);
}

export function formatInputMoney(value: number): string {
  if (!value) return '';
  return new Intl.NumberFormat('es-AR').format(Math.round(value));
}

export function parseMoney(value: string): number {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  return digits ? Number(digits) : 0;
}

export function batteryPercent(value: string | null | undefined): number {
  const match = String(value ?? '').match(/(\d{1,3})/);
  if (!match) return 0;
  return Math.max(0, Math.min(100, Number(match[1])));
}

export function formatImei(value: string): string {
  const digits = value.replace(/\s/g, '');
  if (digits.length < 15) return value || '—';
  return `${digits.slice(0, 2)} ${digits.slice(2, 8)} ${digits.slice(8, 14)} ${digits.slice(14)}`;
}

const STATUS_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  EN_REVISION: 'En revisión',
  VENDIDO: 'Vendido',
  RESERVADO: 'Reservado',
  COMPLETADA: 'Completada',
  PENDIENTE: 'Pendiente',
  CANCELADA: 'Cancelada',
  LISTO: 'Completado',
  'PERITAJE TÉC.': 'Peritaje téc.',
  'EN REVISIÓN': 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

const STATUS_COLOR: Record<string, string> = {
  DISPONIBLE: '#25A66A',
  Disponible: '#25A66A',
  EN_REVISION: '#E8A33D',
  'En revisión': '#E8A33D',
  'EN REVISIÓN': '#3B82F6',
  VENDIDO: '#737984',
  Vendido: '#737984',
  RESERVADO: '#3B82F6',
  Reservado: '#3B82F6',
  COMPLETADA: '#25A66A',
  Completada: '#25A66A',
  PENDIENTE: '#E8A33D',
  Pendiente: '#E8A33D',
  CANCELADA: '#DC4C4C',
  Cancelada: '#DC4C4C',
  'PERITAJE TÉC.': '#8B5CF6',
  'Peritaje téc.': '#8B5CF6',
  APROBADO: '#25A66A',
  Aprobado: '#25A66A',
  LISTO: '#0F9D8A',
  Completado: '#0F9D8A',
  RECHAZADO: '#DC4C4C',
  Rechazado: '#DC4C4C',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? STATUS_COLOR[statusLabel(status)] ?? '#737984';
}

export function conditionLabel(condition: string, grade?: string): string {
  const label = ({ NUEVO: 'Nuevo', USADO: 'Usado', 'PRE-OWNED': 'Pre-owned' } as Record<string, string>)[condition] ?? condition;
  if (!grade || grade === 'N/A' || grade === '—' || condition === 'NUEVO') return label;
  return `${label} · Grado ${grade}`;
}

export function paymentLabel(method: string): string {
  return ({
    TRANSFERENCIA: 'Transferencia',
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    CRIPTO: 'Cripto',
  } as Record<string, string>)[method] ?? method;
}

export function clientName(clients: Client[], id: string): string {
  if (!id) return 'Consumidor final';
  return clients.find((client) => client.id === id)?.name ?? 'Sin cliente';
}

export function productLabel(product: Product | undefined): string {
  if (!product) return 'Equipo';
  return `${product.model}${product.capacity ? ` ${product.capacity}` : ''}`;
}

export function saleCode(sale: Sale): string {
  const number = sale.saleNumber ?? 0;
  return `V-${String(number || 0).padStart(4, '0')}`;
}

export function tradeCode(tradeIns: TradeIn[], id: string): string {
  const current = tradeIns.find((item) => item.id === id);
  if (current?.tradeNumber) return `C-${String(current.tradeNumber).padStart(4, '0')}`;
  const ordered = [...tradeIns].sort((a, b) => {
    const left = parseAppDate(a.date)?.getTime() ?? 0;
    const right = parseAppDate(b.date)?.getTime() ?? 0;
    return left - right;
  });
  const index = Math.max(0, ordered.findIndex((item) => item.id === id));
  return `C-${String(index + 1).padStart(4, '0')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function avatarTone(seed: string): string {
  const tones = ['b', 'p', 'g'];
  let hash = 0;
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % tones.length;
  return tones[hash] ?? 'b';
}

export const IN_PROGRESS_TRADE_STATUSES = new Set(['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN']);

export function isInProgressTrade(status: string): boolean {
  return IN_PROGRESS_TRADE_STATUSES.has(status);
}

export const OPEN_TRADE_STATUSES = new Set(['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN', 'APROBADO']);

export function isOpenTrade(status: string): boolean {
  return OPEN_TRADE_STATUSES.has(status);
}

export type PeriodKey = 'Semana' | 'Mes' | '3 meses' | 'Año';

export function periodBounds(period: PeriodKey, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(end);
  if (period === 'Semana') start.setDate(start.getDate() - 7);
  else if (period === 'Mes') start.setDate(start.getDate() - 30);
  else if (period === '3 meses') start.setMonth(start.getMonth() - 3);
  else start.setFullYear(start.getFullYear() - 1);
  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  const prevStart = new Date(start.getTime() - span);
  return { start, end, prevStart, prevEnd };
}

export function inPeriod(value: string, start: Date, end: Date): boolean {
  const date = parseAppDate(value);
  if (!date) return false;
  return date >= start && date < end;
}
