import type { CustomColumn } from '../types';
import { conditionLabel, paymentLabel, statusLabel } from './format';
import { inReportPeriod, parseReportDate, type ReportBounds } from './report-period';
import { repairFault } from './repairs';

export const REPORT_TABS = ['Ventas', 'Stock', 'Canjes', 'Clientes', 'Servicio'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export interface BreakdownDimension {
  id: string;
  label: string;
}

export const DEFAULT_DIMENSION: Record<ReportTab, string> = {
  Ventas: 'payment',
  Stock: 'status',
  Canjes: 'status',
  Clientes: 'kind',
  Servicio: 'status',
};

const ENTITY: Partial<Record<ReportTab, CustomColumn['entity']>> = {
  Ventas: 'sales',
  Stock: 'inventory',
  Canjes: 'trade-ins',
  Clientes: 'clients',
};

const BUILTIN: Record<ReportTab, BreakdownDimension[]> = {
  Ventas: [
    { id: 'payment', label: 'Medio de pago' },
    { id: 'model', label: 'Modelo' },
    { id: 'condition', label: 'Condición' },
    { id: 'color', label: 'Color' },
    { id: 'seller', label: 'Vendedor' },
  ],
  Stock: [
    { id: 'status', label: 'Estado' },
    { id: 'model', label: 'Modelo' },
    { id: 'condition', label: 'Condición' },
    { id: 'color', label: 'Color' },
  ],
  Canjes: [
    { id: 'status', label: 'Estado' },
    { id: 'client', label: 'Cliente' },
    { id: 'device', label: 'Equipo recibido' },
  ],
  Clientes: [
    { id: 'kind', label: 'Tipo' },
    { id: 'tag', label: 'Etiqueta' },
    { id: 'category', label: 'Categoría' },
  ],
  Servicio: [
    { id: 'status', label: 'Estado' },
    { id: 'technician', label: 'Técnico' },
    { id: 'device', label: 'Equipo' },
    { id: 'fault', label: 'Falla' },
  ],
};

const PALETTE = ['#397964', '#5B8DEF', '#DF668B', 'var(--c-lime)', '#16181D', '#E8A33D', '#8B5CF6'];

export interface BreakdownPart {
  label: string;
  value: number;
  color: string;
}

export function dimensionsFor(tab: ReportTab, columns: CustomColumn[] = []): BreakdownDimension[] {
  const entity = ENTITY[tab];
  const extra = columns
    .filter((column) => column.entity === entity && !/vendedor|seller/i.test(column.label))
    .map((column) => ({ id: `custom:${column.id}`, label: column.label }));
  return [...BUILTIN[tab], ...extra];
}

export function breakdownTitle(tab: ReportTab, dimensionId: string, dimensions: BreakdownDimension[]) {
  if (tab === 'Stock' && dimensionId === 'status') return 'Estado actual';
  if (dimensionId === 'status') return 'Por estado';
  const label = dimensions.find((item) => item.id === dimensionId)?.label ?? 'desglose';
  return `Por ${label.toLowerCase()}`;
}

export function breakdownCatalog(tab: ReportTab, dimensionId: string): Array<{ label: string; color: string }> | undefined {
  if (tab === 'Ventas' && dimensionId === 'payment') {
    return [
      { label: 'Transferencia', color: '#397964' },
      { label: 'Efectivo', color: '#5B8DEF' },
      { label: 'Tarjeta', color: '#DF668B' },
      { label: 'Cripto', color: 'var(--c-lime)' },
    ];
  }
  if (tab === 'Stock' && dimensionId === 'status') {
    return [
      { label: 'Disponible', color: 'var(--c-lime)' },
      { label: 'En revisión', color: '#5B8DEF' },
      { label: 'Vendido', color: '#397964' },
      { label: 'Reservado', color: '#DF668B' },
    ];
  }
  if (tab === 'Canjes' && dimensionId === 'status') {
    return [
      { label: 'Pendiente', color: '#5B8DEF' },
      { label: 'Peritaje téc.', color: '#DF668B' },
      { label: 'En revisión', color: 'var(--c-lime)' },
      { label: 'Aprobado', color: '#397964' },
      { label: 'Completado', color: '#16181D' },
    ];
  }
  if (tab === 'Servicio' && dimensionId === 'status') {
    return [
      { label: 'Recibido', color: '#9AA0AA' },
      { label: 'En reparación', color: '#5B8DEF' },
      { label: 'Listo para retirar', color: '#25A66A' },
      { label: 'Entregado', color: '#16181D' },
    ];
  }
  if (tab === 'Clientes' && dimensionId === 'kind') {
    return [
      { label: 'Alta', color: '#397964' },
      { label: 'Recurrente', color: '#5B8DEF' },
      { label: 'Primera compra', color: '#DF668B' },
    ];
  }
  return undefined;
}

export function groupBreakdown(
  entries: Array<{ label: string; value: number }>,
  catalog?: Array<{ label: string; color: string }>,
): { parts: BreakdownPart[]; otherLabels: string[] } {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.label, (totals.get(entry.label) ?? 0) + entry.value);
  if (catalog) {
    const known = new Set(catalog.map((item) => item.label));
    const parts = catalog.map((item) => ({ ...item, value: totals.get(item.label) ?? 0 }));
    for (const [label, value] of totals) {
      if (!known.has(label) && value > 0) parts.push({ label, value, color: '#737984' });
    }
    return { parts, otherLabels: [] };
  }
  const ranked = [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'es'));
  if (ranked.length <= 6) {
    return {
      parts: ranked.map(([label, value], index) => ({ label, value, color: PALETTE[index % PALETTE.length] })),
      otherLabels: [],
    };
  }
  const rest = ranked.slice(5);
  return {
    parts: [
      ...ranked.slice(0, 5).map(([label, value], index) => ({ label, value, color: PALETTE[index % PALETTE.length] })),
      { label: 'Otros', value: rest.reduce((sum, [, value]) => sum + value, 0), color: '#737984' },
    ],
    otherLabels: rest.map(([label]) => label),
  };
}

export function matchesBreakdown(label: string, selected: string | null, otherLabels: string[]) {
  if (!selected) return true;
  if (selected === 'Otros') return otherLabels.includes(label);
  return label === selected;
}

export function customFieldLabel(fields: Record<string, unknown> | undefined, columnId: string) {
  const value = fields?.[columnId];
  if (Array.isArray(value)) {
    const text = value.map((item) => String(item).trim()).filter(Boolean).join(', ');
    return text || 'Sin dato';
  }
  if (value == null || value === '') return 'Sin dato';
  const text = String(value).trim();
  return text || 'Sin dato';
}

export function sellerLabel(fields: Record<string, unknown> | undefined, columns: CustomColumn[] = []) {
  const column = columns.find((item) => item.entity === 'sales' && /vendedor|seller/i.test(item.label));
  if (column) {
    const label = customFieldLabel(fields, column.id);
    if (label !== 'Sin dato') return label;
  }
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (!/vendedor|seller/i.test(key)) continue;
      const text = Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean).join(', ')
        : String(value ?? '').trim();
      if (text) return text;
    }
  }
  return 'Sin vendedor';
}

type SaleSlice = {
  paymentMethod?: string;
  deviceLabel?: string | null;
  productId?: string;
  customFields?: Record<string, unknown>;
};

type ProductSlice = {
  id: string;
  model?: string;
  color?: string;
  condition?: string;
  customFields?: Record<string, unknown>;
};

export function saleBreakdownLabel(sale: SaleSlice, dimensionId: string, inventory: ProductSlice[], columns: CustomColumn[] = []) {
  const product = sale.productId ? inventory.find((item) => item.id === sale.productId) : undefined;
  if (dimensionId === 'payment') return paymentLabel(sale.paymentMethod || 'Otro');
  if (dimensionId === 'model') return product?.model?.trim() || sale.deviceLabel?.trim() || 'Sin modelo';
  if (dimensionId === 'condition') return product?.condition ? conditionLabel(product.condition) : 'Sin dato';
  if (dimensionId === 'color') return product?.color?.trim() || 'Sin color';
  if (dimensionId === 'seller') return sellerLabel(sale.customFields, columns);
  if (dimensionId.startsWith('custom:')) return customFieldLabel(sale.customFields, dimensionId.slice('custom:'.length));
  return 'Sin dato';
}

export function stockBreakdownLabel(item: ProductSlice & { status?: string }, dimensionId: string) {
  if (dimensionId === 'status') return statusLabel(item.status || '');
  if (dimensionId === 'model') return item.model?.trim() || 'Sin modelo';
  if (dimensionId === 'condition') return item.condition ? conditionLabel(item.condition) : 'Sin dato';
  if (dimensionId === 'color') return item.color?.trim() || 'Sin color';
  if (dimensionId.startsWith('custom:')) return customFieldLabel(item.customFields, dimensionId.slice('custom:'.length));
  return 'Sin dato';
}

export function tradeBreakdownLabel(
  item: { status?: string; deviceReceived?: string; clientId?: string; clientName?: string | null; customFields?: Record<string, unknown> },
  dimensionId: string,
  clientName: string,
) {
  if (dimensionId === 'status') return statusLabel(item.status || '');
  if (dimensionId === 'client') return clientName.trim() || 'Sin cliente';
  if (dimensionId === 'device') return item.deviceReceived?.trim() || 'Sin equipo';
  if (dimensionId.startsWith('custom:')) return customFieldLabel(item.customFields, dimensionId.slice('custom:'.length));
  return 'Sin dato';
}

export function serviceBreakdownLabel(
  order: { status: string; technician?: string; device?: string; fault?: string; faultTags?: string[] },
  dimensionId: string,
) {
  if (dimensionId === 'status') return statusLabel(order.status);
  if (dimensionId === 'technician') return order.technician?.trim() || 'Sin técnico';
  if (dimensionId === 'device') return order.device?.trim() || 'Sin equipo';
  if (dimensionId === 'fault') return repairFault({ fault: order.fault ?? '', faultTags: order.faultTags ?? [] });
  return 'Sin dato';
}

export function clientBreakdownLabel(
  row: { kind: string | null; tag?: string | null; category?: string | null; customFields?: Record<string, unknown> },
  dimensionId: string,
) {
  if (dimensionId === 'kind') return row.kind || 'Sin tipo';
  if (dimensionId === 'tag') return row.tag?.trim() || 'Sin etiqueta';
  if (dimensionId === 'category') return row.category?.trim() || 'Sin categoría';
  if (dimensionId.startsWith('custom:')) return customFieldLabel(row.customFields, dimensionId.slice('custom:'.length));
  return 'Sin dato';
}

export interface ClientReportRow {
  id: string | null;
  name: string;
  createdAt: string | null;
  tag: string;
  category: string;
  customFields?: Record<string, unknown>;
  purchases: number;
  revenue: number;
  blocked: boolean;
  kind: 'Alta' | 'Recurrente' | 'Primera compra';
}

interface ClientSource {
  id: string;
  name: string;
  createdAt?: string | null;
  tag?: string | null;
  categoryId?: string | null;
  customFields?: Record<string, unknown>;
}

interface SaleSource {
  clientId?: string;
  clientName?: string;
  date: string;
  amount: number;
  status: string;
  amountCurrency?: string | null;
}

export function buildClientReport(input: {
  clients: ClientSource[];
  categories: Array<{ id: string; name: string }>;
  sales: SaleSource[];
  bounds: ReportBounds;
  project: (amount: number, currency?: string | null) => number | null;
}): { rows: ClientReportRow[]; altas: number; recurrentes: number } {
  const categoryName = new Map(input.categories.map((category) => [category.id, category.name]));
  type Bucket = {
    id: string | null;
    name: string;
    createdAt: string | null;
    tag: string;
    category: string;
    customFields?: Record<string, unknown>;
    purchases: Array<{ date: string; amount: number; currency?: string | null }>;
  };
  const buckets = new Map<string, Bucket>();
  const byName = new Map<string, string>();
  for (const client of input.clients) {
    const key = `id:${client.id}`;
    buckets.set(key, {
      id: client.id,
      name: client.name.trim() || 'Sin nombre',
      createdAt: client.createdAt ?? null,
      tag: client.tag?.trim() || '',
      category: (client.categoryId && categoryName.get(client.categoryId)) || '',
      customFields: client.customFields,
      purchases: [],
    });
    if (client.name.trim()) byName.set(client.name.trim().toLowerCase(), key);
  }
  for (const sale of input.sales) {
    if (sale.status === 'CANCELADA') continue;
    const typed = sale.clientName?.trim() || '';
    let key = sale.clientId ? `id:${sale.clientId}` : (typed ? byName.get(typed.toLowerCase()) : undefined);
    if (!key) {
      const name = typed || 'Consumidor final';
      key = `name:${name.toLowerCase()}`;
      if (!buckets.has(key)) {
        buckets.set(key, { id: null, name, createdAt: null, tag: '', category: '', purchases: [] });
      }
    }
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.purchases.push({ date: sale.date, amount: sale.amount, currency: sale.amountCurrency });
  }

  const rows: ClientReportRow[] = [];
  for (const bucket of buckets.values()) {
    const inPeriod = bucket.purchases.filter((purchase) => inReportPeriod(purchase.date, input.bounds.start, input.bounds.end));
    const before = bucket.purchases.filter((purchase) => {
      const date = parseReportDate(purchase.date);
      return !!date && date < input.bounds.start;
    });
    const isNew = inReportPeriod(bucket.createdAt ?? undefined, input.bounds.start, input.bounds.end);
    const returning = !isNew && (inPeriod.length >= 2 || (inPeriod.length >= 1 && before.length >= 1));
    const kind = isNew ? 'Alta' : returning ? 'Recurrente' : inPeriod.length === 1 ? 'Primera compra' : null;
    if (!kind) continue;
    let revenue = 0;
    let blocked = false;
    for (const purchase of inPeriod) {
      const projected = input.project(purchase.amount, purchase.currency);
      if (projected == null) blocked = true;
      else revenue += projected;
    }
    rows.push({
      id: bucket.id,
      name: bucket.name,
      createdAt: bucket.createdAt,
      tag: bucket.tag,
      category: bucket.category,
      customFields: bucket.customFields,
      purchases: inPeriod.length,
      revenue: blocked ? 0 : revenue,
      blocked,
      kind,
    });
  }
  rows.sort((left, right) => right.revenue - left.revenue || right.purchases - left.purchases || left.name.localeCompare(right.name, 'es'));
  return {
    rows,
    altas: rows.filter((row) => row.kind === 'Alta').length,
    recurrentes: rows.filter((row) => row.kind === 'Recurrente').length,
  };
}

export function repairLeadDays(order: { status: string; receivedAt: string; events?: Array<{ status: string; createdAt: string }> }) {
  if (order.status !== 'ENTREGADO') return null;
  const start = parseReportDate(order.receivedAt);
  const delivered = [...(order.events ?? [])].reverse().find((event) => event.status === 'ENTREGADO');
  const end = parseReportDate(delivered?.createdAt) ?? start;
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export function averageLeadDays(days: Array<number | null>) {
  const measured = days.filter((day): day is number => day != null);
  if (!measured.length) return null;
  return Math.round(measured.reduce((sum, day) => sum + day, 0) / measured.length);
}

export function leadTimeLabel(average: number | null) {
  if (average == null) return 'sin entregas para medir el tiempo';
  if (average === 0) return 'tiempo medio: mismo día';
  if (average === 1) return 'tiempo medio: 1 día';
  return `tiempo medio: ${average} días`;
}
