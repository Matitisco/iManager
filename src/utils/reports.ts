import type {
  ReportsOverview,
  ReportsRangeKey,
  ReportsWidgetId,
  ReportsWidgetPreferences,
} from '../types/reports';

export const REPORTS_WIDGET_IDS: ReportsWidgetId[] = [
  'sales-summary',
  'sales-by-period',
  'inventory-value',
  'top-products',
  'payment-methods',
  'operational-snapshot',
];

export const DEFAULT_VISIBLE_REPORTS_WIDGET_IDS: ReportsWidgetId[] = [
  'sales-summary',
  'sales-by-period',
  'inventory-value',
  'top-products',
  'payment-methods',
];

export const PRESET_REPORTS_RANGE_KEYS: Exclude<ReportsRangeKey, 'custom'>[] = [
  'this_month',
  'last_90_days',
  'this_year',
  'all_time',
];

export function getDefaultReportsWidgetPreferences(): ReportsWidgetPreferences {
  return {
    visibleWidgetIds: [...DEFAULT_VISIBLE_REPORTS_WIDGET_IDS],
    widgetOrder: [...REPORTS_WIDGET_IDS],
  };
}

function uniqueWidgetIds(ids: ReportsWidgetId[]) {
  return Array.from(new Set(ids));
}

export function normalizeReportsWidgetPreferences(
  raw: Partial<ReportsWidgetPreferences> | null | undefined
): ReportsWidgetPreferences {
  const defaultPreferences = getDefaultReportsWidgetPreferences();
  const rawVisibleIds = Array.isArray(raw?.visibleWidgetIds)
    ? raw.visibleWidgetIds.filter((value): value is ReportsWidgetId =>
        REPORTS_WIDGET_IDS.includes(value as ReportsWidgetId)
      )
    : defaultPreferences.visibleWidgetIds;
  const rawOrder = Array.isArray(raw?.widgetOrder)
    ? raw.widgetOrder.filter((value): value is ReportsWidgetId =>
        REPORTS_WIDGET_IDS.includes(value as ReportsWidgetId)
      )
    : defaultPreferences.widgetOrder;
  const widgetOrder = uniqueWidgetIds([...rawOrder, ...REPORTS_WIDGET_IDS]);
  const visibleWidgetIds = uniqueWidgetIds(
    rawVisibleIds.filter((value) => widgetOrder.includes(value))
  );

  return {
    visibleWidgetIds,
    widgetOrder,
  };
}

export function getReportsPreferencesStorageKey(userId: string, storeId: string) {
  return `reportsPreferences:${userId}:${storeId}`;
}

export function readStoredReportsWidgetPreferences(
  userId: string,
  storeId: string
): ReportsWidgetPreferences {
  try {
    const raw = window.localStorage.getItem(getReportsPreferencesStorageKey(userId, storeId));
    if (!raw) {
      return getDefaultReportsWidgetPreferences();
    }

    const parsed = JSON.parse(raw) as Partial<ReportsWidgetPreferences>;
    return normalizeReportsWidgetPreferences(parsed);
  } catch {
    return getDefaultReportsWidgetPreferences();
  }
}

export function writeStoredReportsWidgetPreferences(
  userId: string,
  storeId: string,
  preferences: ReportsWidgetPreferences
) {
  try {
    window.localStorage.setItem(
      getReportsPreferencesStorageKey(userId, storeId),
      JSON.stringify(normalizeReportsWidgetPreferences(preferences))
    );
  } catch {
    // Ignore localStorage failures and keep runtime state.
  }
}

export function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultCustomRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29);
  return {
    startDate: formatDateInputValue(start),
    endDate: formatDateInputValue(today),
  };
}

export function parseDateInputBoundary(value: string, boundary: 'start' | 'end') {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(
    year,
    month,
    day,
    boundary === 'start' ? 0 : 23,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 999
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getCustomRangeError(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 'Selecciona una fecha de inicio y fin para aplicar el rango personalizado.';
  }

  const startBoundary = parseDateInputBoundary(startDate, 'start');
  const endBoundary = parseDateInputBoundary(endDate, 'end');

  if (!startBoundary || !endBoundary) {
    return 'El rango personalizado contiene una fecha invalida.';
  }

  if (new Date(startBoundary).getTime() > new Date(endBoundary).getTime()) {
    return 'La fecha de inicio no puede ser posterior a la fecha de fin.';
  }

  return null;
}

export function getRangeWindow(rangeKey: Exclude<ReportsRangeKey, 'custom'>) {
  if (rangeKey === 'all_time') {
    return { startDate: null, endDate: null };
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (rangeKey === 'this_month') {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }

  if (rangeKey === 'this_year') {
    const startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 89);
  startDate.setHours(0, 0, 0, 0);

  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

function csvRow(cells: Array<string | number | null | undefined>) {
  return cells.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',');
}

export function buildReportsCsv(report: ReportsOverview, visibleWidgetIds: ReportsWidgetId[]) {
  const sections: string[] = [];

  if (visibleWidgetIds.includes('sales-summary')) {
    sections.push(csvRow(['Seccion', 'Metrica', 'Valor']));
    sections.push(csvRow(['Resumen', 'Ingresos', report.summary.revenue.toFixed(2)]));
    sections.push(csvRow(['Resumen', 'Margen estimado', report.summary.grossProfit.toFixed(2)]));
    sections.push(csvRow(['Resumen', 'Equipos vendidos', report.summary.unitsSold]));
    sections.push(csvRow(['Resumen', 'Ticket promedio', report.summary.averageTicket.toFixed(2)]));
    sections.push(csvRow(['Resumen', 'Ventas pendientes', report.summary.pendingSales]));
    sections.push(csvRow(['Resumen', 'Canjes aprobados', report.summary.approvedTradeIns]));
    sections.push('');
  }

  if (visibleWidgetIds.includes('sales-by-period')) {
    sections.push(csvRow(['Serie', 'Periodo', 'Ingresos', 'Unidades']));
    report.salesSeries.forEach((point) => {
      sections.push(csvRow(['Serie', point.label, point.revenue.toFixed(2), point.unitsSold]));
    });
    sections.push('');
  }

  if (visibleWidgetIds.includes('inventory-value')) {
    sections.push(csvRow(['Inventario', 'Metrica', 'Valor']));
    sections.push(csvRow(['Inventario', 'Costo del stock disponible', report.inventory.valuation.costValue.toFixed(2)]));
    sections.push(csvRow(['Inventario', 'Valor potencial de venta', report.inventory.valuation.retailValue.toFixed(2)]));
    sections.push(csvRow(['Inventario', 'Disponibles', report.inventory.availableItems]));
    sections.push(csvRow(['Inventario', 'Total items', report.inventory.totalItems]));
    sections.push('');
  }

  if (visibleWidgetIds.includes('top-products')) {
    sections.push(csvRow(['Top productos', 'Producto', 'Unidades', 'Ingresos', 'Share']));
    report.topProducts.forEach((product) => {
      sections.push(
        csvRow([
          'Top productos',
          product.product,
          product.unitsSold,
          product.revenue.toFixed(2),
          product.share.toFixed(2),
        ])
      );
    });
    sections.push('');
  }

  if (visibleWidgetIds.includes('payment-methods')) {
    sections.push(csvRow(['Metodos', 'Metodo', 'Operaciones', 'Ingresos', 'Share']));
    report.paymentMethods.forEach((method) => {
      sections.push(
        csvRow([
          'Metodos',
          method.label,
          method.count,
          method.revenue.toFixed(2),
          method.share.toFixed(2),
        ])
      );
    });
    sections.push('');
  }

  if (visibleWidgetIds.includes('operational-snapshot')) {
    sections.push(csvRow(['Operacion', 'Metrica', 'Valor']));
    sections.push(csvRow(['Operacion', 'Clientes activos', report.clients.activeClients]));
    sections.push(csvRow(['Operacion', 'Clientes totales', report.clients.totalClients]));
    sections.push(csvRow(['Operacion', 'Saldo pendiente', report.clients.pendingBalance.toFixed(2)]));
    sections.push(csvRow(['Operacion', 'Canjes en rango', report.tradeIns.totalInRange]));
    sections.push(csvRow(['Operacion', 'Canjes aprobados', report.tradeIns.approvedInRange]));
    sections.push(csvRow(['Operacion', 'Caja por canjes', report.tradeIns.cashGenerated.toFixed(2)]));
    sections.push(csvRow(['Operacion', 'Stock vendido', report.inventory.soldItems]));
    sections.push(csvRow(['Operacion', 'Stock en revision', report.inventory.inReviewItems]));
    sections.push('');
  }

  sections.push(csvRow(['Rango', 'Inicio', report.filters.startDate ?? 'Todo']));
  sections.push(csvRow(['Rango', 'Fin', report.filters.endDate ?? 'Todo']));

  return sections.join('\n');
}
