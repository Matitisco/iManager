import type { Client, Product, Sale, TradeIn } from '../types';
import { formatArDate, formatArDateTime, parseArDate } from '../lib/ar-date';

export { formatArDate, formatArDateTime };

export function parseAppDate(value: string | null | undefined): Date | null {
  return parseArDate(value);
}

export function formatMoney(value: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  const amount = Number.isFinite(value) ? Math.round(value) : 0;
  const formatted = new Intl.NumberFormat('es-AR').format(amount);
  return currency === 'USD' ? `US$ ${formatted}` : `$ ${formatted}`;
}

export function formatShortDate(value: string | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return '—';
  return formatArDate(date);
}

export function formatDayMonth(value: string | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return '';
  return formatArDate(date);
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
  return formatArDate(date);
}

export function formatMoneyCompact(value: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  const amount = Number.isFinite(value) ? value : 0;
  const prefix = currency === 'USD' ? 'US$' : '$';
  if (Math.abs(amount) >= 1_000_000) {
    const compact = (amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    return `${prefix} ${compact}M`;
  }
  return formatMoney(amount, currency);
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
  RECIBIDO: 'Recibido',
  EN_DIAGNOSTICO: 'En diagnóstico',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  EN_REPARACION: 'En reparación',
  LISTO_PARA_RETIRAR: 'Listo para retirar',
  ENTREGADO: 'Entregado',
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
  RECIBIDO: '#9AA0AA',
  Recibido: '#9AA0AA',
  EN_DIAGNOSTICO: '#8B5CF6',
  'En diagnóstico': '#8B5CF6',
  ESPERANDO_REPUESTO: '#E8A33D',
  'Esperando repuesto': '#E8A33D',
  EN_REPARACION: '#5B8DEF',
  'En reparación': '#5B8DEF',
  LISTO_PARA_RETIRAR: '#25A66A',
  'Listo para retirar': '#25A66A',
  ENTREGADO: '#16181D',
  Entregado: '#16181D',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? STATUS_COLOR[statusLabel(status)] ?? '#737984';
}

export function isInStock(status: string) {
  return !status || status === 'DISPONIBLE';
}

export function equipmentTitle(model: string, capacity?: string) {
  return [model, capacity].filter(Boolean).join(' · ');
}

export function conditionLabel(condition: string, grade?: string): string {
  if (!condition) return '—';
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

export function tradeClientLabel(trade: { clientId?: string; clientName?: string | null }, clients: Client[]): string {
  if (trade.clientId) {
    const linked = clients.find((client) => client.id === trade.clientId);
    if (linked?.name.trim()) return linked.name;
  }
  const typed = trade.clientName?.trim();
  if (typed) return typed;
  return clientName(clients, trade.clientId ?? '');
}

export function saleBuyer(sale: { clientName?: string; clientId?: string }, clients: Client[]): string {
  const typed = sale.clientName?.trim();
  if (typed) return typed;
  if (sale.clientId) return clientName(clients, sale.clientId);
  return 'Consumidor final';
}

export function productLabel(product: Product | undefined): string {
  if (!product) return 'Equipo';
  return `${product.model}${product.capacity ? ` ${product.capacity}` : ''}`;
}

export function saleEquipment(sale: { productId?: string; deviceLabel?: string | null }, inventory: Product[]): string {
  const product = sale.productId ? inventory.find((item) => item.id === sale.productId) : undefined;
  if (product) return productLabel(product);
  return sale.deviceLabel?.trim() || 'Equipo';
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
