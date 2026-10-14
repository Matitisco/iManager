import type { Product, RepairOrder, Sale } from '../types';
import { formatArDate, parseArDate } from './ar-date';

export const MAX_WARRANTY_DAYS = 3650;
export const DEFAULT_USED_WARRANTY_DAYS = 30;
export const DEFAULT_SEALED_WARRANTY_DAYS = 90;
export const DEFAULT_REPAIR_WARRANTY_DAYS = 30;

export type WarrantyState = 'sin' | 'pendiente' | 'vigente' | 'vencida';

export interface CoverageLine {
  id: string;
  title: string;
  detail: string;
  state: WarrantyState;
}

export function isSealedCondition(condition: string | null | undefined) {
  const key = (condition ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return key === 'nuevo' || key === 'sellado' || key === 'sealed' || key === 'new';
}

export function defaultSaleWarrantyDays(condition: string | null | undefined, settings: { usedWarrantyDays: number; sealedWarrantyDays: number }) {
  return isSealedCondition(condition) ? settings.sealedWarrantyDays : settings.usedWarrantyDays;
}

export function addCalendarDays(start: Date, days: number) {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days, 12, 0, 0, 0);
}

export function warrantyUntil(start: Date | null, days: number | null | undefined) {
  if (!start || days == null || days <= 0) return null;
  return addCalendarDays(start, days);
}

export function coverageState(until: Date | null, now = new Date(), pending = false): WarrantyState {
  if (pending) return 'pendiente';
  if (!until) return 'sin';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const end = new Date(until.getFullYear(), until.getMonth(), until.getDate(), 12, 0, 0, 0);
  return end.getTime() >= today.getTime() ? 'vigente' : 'vencida';
}

export function warrantyPhrase(state: WarrantyState, days: number | null, untilLabel: string | null) {
  if (state === 'pendiente') return `${days ?? 0} días · empieza al entregar`;
  if (state === 'vigente' && untilLabel) return `Vigente hasta el ${untilLabel}`;
  if (state === 'vencida' && untilLabel) return `Venció el ${untilLabel}`;
  return 'Sin garantía';
}

export function parseWarrantyDaysInput(raw: string): { days?: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (!/^\d+$/.test(trimmed)) return { error: 'Usá un número de días entre 0 y 3650' };
  const days = Number(trimmed);
  if (days > MAX_WARRANTY_DAYS) return { error: 'Usá un número de días entre 0 y 3650' };
  return { days };
}

export function isoFromAr(value: string | null | undefined) {
  const parsed = parseArDate(value ?? '');
  const date = parsed ?? new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function arFromIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatArDate(new Date());
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function saleWarrantyView(sale: Pick<Sale, 'date' | 'status'> & { warrantyDays?: number | null }, now = new Date()) {
  const days = sale.warrantyDays ?? null;
  if (sale.status === 'CANCELADA') return { state: 'sin' as const, days, untilLabel: null, phrase: 'Sin cobertura' };
  const until = warrantyUntil(parseArDate(sale.date), days);
  const state = coverageState(until, now);
  const untilLabel = until ? formatArDate(until) : null;
  return { state, days, untilLabel, phrase: warrantyPhrase(state, days, untilLabel) };
}

export function repairWarrantyView(order: Pick<RepairOrder, 'status' | 'events'> & { warrantyDays?: number | null }, now = new Date()) {
  const days = order.warrantyDays ?? null;
  if (days == null || days <= 0) return { state: 'sin' as const, days, untilLabel: null, phrase: 'Sin garantía' };
  if (order.status !== 'ENTREGADO') return { state: 'pendiente' as const, days, untilLabel: null, phrase: warrantyPhrase('pendiente', days, null) };
  const delivered = [...order.events].reverse().find((event) => event.status === 'ENTREGADO');
  const until = warrantyUntil(parseArDate(delivered?.createdAt), days);
  if (!until) return { state: 'pendiente' as const, days, untilLabel: null, phrase: warrantyPhrase('pendiente', days, null) };
  const state = coverageState(until, now);
  const untilLabel = formatArDate(until);
  return { state, days, untilLabel, phrase: warrantyPhrase(state, days, untilLabel) };
}

function imeiDigits(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

export function clientCoverageLines(clientId: string, sales: Sale[], repairs: RepairOrder[], now = new Date()): CoverageLine[] {
  const saleLines = sales
    .filter((sale) => sale.clientId === clientId && sale.status !== 'CANCELADA')
    .map((sale) => {
      const view = saleWarrantyView(sale, now);
      return { id: `sale-${sale.id}`, title: sale.deviceLabel?.trim() || 'Equipo vendido', detail: view.phrase, state: view.state };
    });
  const repairLines = repairs
    .filter((order) => order.clientId === clientId)
    .map((order) => {
      const view = repairWarrantyView(order, now);
      return { id: `repair-${order.id}`, title: order.device, detail: view.phrase, state: view.state };
    });
  return [...saleLines, ...repairLines];
}

export function deviceCoverageLines(item: Pick<Product, 'id' | 'imei'>, sales: Sale[], repairs: RepairOrder[], now = new Date()): CoverageLine[] {
  const imei = imeiDigits(item.imei);
  const saleLines = sales
    .filter((sale) => sale.productId === item.id && sale.status !== 'CANCELADA')
    .map((sale) => {
      const view = saleWarrantyView(sale, now);
      return { id: `sale-${sale.id}`, title: 'Venta', detail: view.phrase, state: view.state };
    });
  const repairLines = imei
    ? repairs.filter((order) => imeiDigits(order.imei) === imei).map((order) => {
      const view = repairWarrantyView(order, now);
      return { id: `repair-${order.id}`, title: order.device, detail: view.phrase, state: view.state };
    })
    : [];
  return [...saleLines, ...repairLines];
}

export function coverageHeadline(lines: CoverageLine[]) {
  if (lines.some((line) => line.state === 'vigente')) return 'Cubierto';
  if (lines.some((line) => line.state === 'pendiente')) return 'Garantía al entregar';
  if (lines.some((line) => line.state === 'vencida')) return 'Vencida';
  return 'Sin garantía';
}
