import type { Client, Product, Sale, TradeIn } from '../types';
import type { AppMembershipRole } from '../types/app-session';
import type { ReportsOverviewParams, ReportsRangeKey } from '../types/reports';

export const PHONE_QUERY = '(max-width: 767px)';
export const MOBILE_PAGE_SIZE = 16;
export const LONG_PRESS_MS = 480;

export type MobileScreen =
  | 'dash'
  | 'inv'
  | 'ven'
  | 'rep'
  | 'mas'
  | 'canjes'
  | 'clientes'
  | 'config'
  | 'notif';

export type MainTabId = 'dash' | 'inv' | 'ven' | 'rep' | 'mas';

export const MAIN_TABS: { id: MainTabId; label: string }[] = [
  { id: 'dash', label: 'Dashboard' },
  { id: 'inv', label: 'Inventario' },
  { id: 'ven', label: 'Ventas' },
  { id: 'rep', label: 'Reportes' },
  { id: 'mas', label: 'Más' },
];

const SUB_SCREENS = new Set<MobileScreen>(['canjes', 'clientes', 'config', 'notif']);

export const ROLE_LABEL: Record<AppMembershipRole, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Socio',
  STAFF: 'Agente',
};

export function tabsForRole(role: string | null | undefined) {
  if (role === 'STAFF') {
    return MAIN_TABS.filter((tab) => tab.id !== 'rep');
  }
  return MAIN_TABS;
}

export function canOpenScreen(role: string | null | undefined, screen: MobileScreen) {
  if (role !== 'STAFF') return true;
  if (screen === 'rep') return false;
  return true;
}

export function navTabForScreen(screen: MobileScreen): MainTabId | null {
  if (screen === 'notif') return null;
  if (SUB_SCREENS.has(screen)) return 'mas';
  if (screen === 'dash' || screen === 'inv' || screen === 'ven' || screen === 'rep' || screen === 'mas') {
    return screen;
  }
  return 'dash';
}

export function formatMoney(value: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const negative = rounded < 0;
  const body = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}$ ${body}`;
}

export function formatMoneyCompact(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  if (Math.abs(amount) >= 1_000_000) {
    const compact = (amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    return `$ ${compact}M`;
  }
  return formatMoney(amount);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return letters || '·';
}

export function avatarTone(seed: string) {
  const tones = ['b', 'p', 'g'] as const;
  let hash = 0;
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % tones.length;
  return tones[hash];
}

export function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function parseEsDate(label: string | null | undefined): Date | null {
  if (!label || label === 'N/A') return null;
  const clean = label
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bde\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = clean.match(/(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})/);
  if (match) {
    const month = MONTHS.findIndex((name) => match[2].startsWith(name));
    if (month >= 0) {
      return new Date(Number(match[3]), month, Number(match[1]));
    }
  }
  const iso = Date.parse(label);
  return Number.isNaN(iso) ? null : new Date(iso);
}

export type SalesPeriod = 'Semana' | 'Mes' | 'Año';
export type ReportPeriod = 'Semana' | 'Mes' | '3 meses' | 'Año';

export function periodStart(period: SalesPeriod | ReportPeriod, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'Semana') start.setDate(start.getDate() - 6);
  else if (period === 'Mes') start.setDate(start.getDate() - 29);
  else if (period === '3 meses') start.setDate(start.getDate() - 89);
  else start.setFullYear(start.getFullYear() - 1);
  return start;
}

export function isInPeriod(label: string | null | undefined, period: SalesPeriod | ReportPeriod, now = new Date()) {
  const date = parseEsDate(label);
  if (!date) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return date >= periodStart(period, now) && date <= end;
}

export function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function reportQuery(period: ReportPeriod, now = new Date()): ReportsOverviewParams {
  const rangeKey: ReportsRangeKey =
    period === 'Mes' ? 'this_month'
      : period === '3 meses' ? 'last_90_days'
        : period === 'Año' ? 'this_year'
          : 'custom';
  if (rangeKey !== 'custom') return { rangeKey };
  return {
    rangeKey,
    startDate: isoDate(periodStart('Semana', now)),
    endDate: isoDate(now),
  };
}

export const INVENTORY_CHIPS: { label: string; status?: string }[] = [
  { label: 'Todos' },
  { label: 'Disponible', status: 'DISPONIBLE' },
  { label: 'En revisión', status: 'EN_REVISION' },
  { label: 'Vendido', status: 'VENDIDO' },
];

export const TRADE_IN_CHIPS: { label: string; status?: string }[] = [
  { label: 'Todos' },
  { label: 'Pendiente', status: 'PENDIENTE' },
  { label: 'Peritaje téc.', status: 'PERITAJE TÉC.' },
  { label: 'En revisión', status: 'EN REVISIÓN' },
  { label: 'Aprobado', status: 'APROBADO' },
  { label: 'Listo', status: 'LISTO' },
  { label: 'Rechazado', status: 'RECHAZADO' },
];

const OPEN_TRADE_INS = new Set(['PENDIENTE', 'EN REVISIÓN', 'PERITAJE TÉC.']);

export function statusLabel(status: string) {
  const known: Record<string, string> = {
    DISPONIBLE: 'Disponible',
    EN_REVISION: 'En revisión',
    VENDIDO: 'Vendido',
    COMPLETADA: 'Completada',
    PENDIENTE: 'Pendiente',
    'EN REVISIÓN': 'En revisión',
    'PERITAJE TÉC.': 'Peritaje téc.',
    APROBADO: 'Aprobado',
    LISTO: 'Listo',
    RECHAZADO: 'Rechazado',
  };
  return known[status] ?? status;
}

export function pillClass(status: string) {
  if (['DISPONIBLE', 'COMPLETADA', 'APROBADO', 'LISTO'].includes(status)) return 'ok';
  if (['RECHAZADO'].includes(status)) return 'no';
  if (status === 'VENDIDO') return 'off';
  return 'mid';
}

export function isOpenTradeIn(status: string) {
  return OPEN_TRADE_INS.has(status);
}

export function paymentLabel(method: string) {
  const known: Record<string, string> = {
    TRANSFERENCIA: 'Transferencia',
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    'CANJE / PAGO': 'Canje + dif.',
    'T. Crédito': 'Tarjeta',
  };
  return known[method] ?? method;
}

export function saleCode(sale: Pick<Sale, 'id' | 'saleNumber'>) {
  if (sale.saleNumber != null) return `V-${String(sale.saleNumber).padStart(4, '0')}`;
  return sale.id.slice(0, 8);
}

export function clientName(clients: Client[], clientId: string) {
  return clients.find((client) => client.id === clientId)?.name ?? 'Cliente';
}

export function productLabel(product: Pick<Product, 'model' | 'capacity'> | undefined) {
  if (!product) return 'Equipo';
  return [product.model, product.capacity].filter(Boolean).join(' ');
}

export function salesInPeriod(sales: Sale[], period: SalesPeriod, now = new Date()) {
  return sales.filter((sale) => sale.status !== 'PENDIENTE' && isInPeriod(sale.date, period, now));
}

export interface StoreActivity {
  id: string;
  title: string;
  subtitle: string;
  screen: MobileScreen;
}

export function buildStoreActivity(input: {
  sales: Sale[];
  tradeIns: TradeIn[];
  inventory: Product[];
  clients: Client[];
}): StoreActivity[] {
  const items: StoreActivity[] = [];

  for (const sale of input.sales) {
    if (sale.status !== 'PENDIENTE') continue;
    items.push({
      id: `sale:${sale.id}`,
      title: 'Venta pendiente',
      subtitle: `${saleCode(sale)} · ${formatMoney(sale.amount)}`,
      screen: 'ven',
    });
  }

  for (const trade of input.tradeIns) {
    if (!isOpenTradeIn(trade.status)) continue;
    items.push({
      id: `trade:${trade.id}`,
      title: 'Canje en curso',
      subtitle: `${trade.deviceReceived} · ${statusLabel(trade.status)}`,
      screen: 'canjes',
    });
  }

  for (const item of input.inventory) {
    if (item.status !== 'EN_REVISION') continue;
    items.push({
      id: `inv:${item.id}`,
      title: 'Equipo en revisión',
      subtitle: productLabel(item),
      screen: 'inv',
    });
  }

  for (const client of input.clients) {
    if (client.pendingBalance <= 0) continue;
    items.push({
      id: `client:${client.id}`,
      title: 'Cliente con saldo',
      subtitle: `${client.name} · ${formatMoney(client.pendingBalance)}`,
      screen: 'clientes',
    });
  }

  return items.slice(0, 40);
}

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-.]/g, '');
}

export function mapImportRows(
  rawRows: string[][],
  fields: ImportField[],
  hints: Record<string, string> = {},
) {
  const headerIndex = rawRows.findIndex((row) => row.filter((cell) => cell && Number.isNaN(Number(cell))).length >= 2);
  const headerRow = headerIndex >= 0 ? headerIndex : 0;
  const headers = (rawRows[headerRow] ?? []).map((header, index) => header || `Columna ${index + 1}`);
  const mapping: Record<string, string> = {};

  for (const field of fields) {
    const key = normalizeHeader(field.key);
    const label = normalizeHeader(field.label);
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return hints[normalized] === field.key || normalized === key || normalized === label;
    });
    if (match) mapping[field.key] = match;
  }

  const missingRequired = fields.filter((field) => field.required && !mapping[field.key]).map((field) => field.label);
  const rows = rawRows.slice(headerRow + 1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    const mapped: Record<string, string> = {};
    for (const field of fields) {
      const header = mapping[field.key];
      if (header) mapped[field.key] = record[header] ?? '';
    }
    return mapped;
  }).filter((row) => Object.values(row).some((value) => value.trim()));

  const preview = rows.slice(0, 4).map((row) => {
    const left = fields.slice(0, 2).map((field) => row[field.key]).filter(Boolean).join(' · ');
    const amount = row.price || row.amount || row.takeValue || '';
    return amount ? `${left} · ${amount}` : left || 'Fila';
  });

  return { rows, preview, missingRequired, fileRows: rows.length };
}

export function hasMorePages(loaded: number, total: number) {
  return loaded < total;
}
