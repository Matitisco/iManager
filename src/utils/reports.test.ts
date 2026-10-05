import { describe, expect, it } from 'vitest';
import type { ReportsOverview } from '../types/reports';
import {
  buildReportsCsv,
  getCustomRangeError,
  getDefaultReportsWidgetPreferences,
  normalizeReportsWidgetPreferences,
  parseDateInputBoundary,
} from './reports';

const sampleReport: ReportsOverview = {
  filters: {
    rangeKey: 'custom',
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-15T23:59:59.999Z',
  },
  summary: {
    revenue: 100000,
    grossProfit: 25000,
    unitsSold: 4,
    averageTicket: 25000,
    pendingSales: 1,
    pendingAmount: 8000,
    marginRate: 25,
    approvedTradeIns: 2,
  },
  comparison: {
    available: true,
    revenue: 80000,
    grossProfit: 20000,
    unitsSold: 3,
    averageTicket: 26666.67,
    revenueChange: 25,
    grossProfitChange: 25,
    unitsChange: 33.3,
    averageTicketChange: -6.2,
  },
  salesSeries: [
    { label: '01 abr', revenue: 50000, unitsSold: 2 },
    { label: '02 abr', revenue: 50000, unitsSold: 2 },
  ],
  topProducts: [
    { product: 'iPhone 14 128GB Negro', unitsSold: 2, revenue: 60000, share: 50 },
  ],
  categories: [
    { category: 'Usados', unitsSold: 4, revenue: 100000, share: 100 },
  ],
  topClients: [
    { client: 'Ana', purchases: 2, revenue: 60000 },
  ],
  paymentMethods: [
    { label: 'EFECTIVO', revenue: 40000, count: 2, share: 40 },
  ],
  inventory: {
    totalItems: 10,
    availableItems: 6,
    soldItems: 3,
    inReviewItems: 1,
    valuation: {
      costValue: 300000,
      retailValue: 420000,
    },
    aging: [
      { label: '0-14 días', count: 4, costValue: 200000 },
      { label: '15-30 días', count: 1, costValue: 50000 },
      { label: '31-60 días', count: 1, costValue: 50000 },
      { label: 'Más de 60 días', count: 0, costValue: 0 },
    ],
  },
  clients: {
    totalClients: 8,
    activeClients: 3,
    pendingBalance: 5000,
  },
  tradeIns: {
    totalInRange: 2,
    approvedInRange: 2,
    openInRange: 1,
    cashGenerated: 10000,
  },
};

describe('normalizeReportsWidgetPreferences', () => {
  it('fills missing widget ids and drops unknown values', () => {
    const result = normalizeReportsWidgetPreferences({
      visibleWidgetIds: ['payment-methods', 'unknown-widget' as never],
      widgetOrder: ['payment-methods', 'inventory-value'],
    });

    expect(result.visibleWidgetIds).toEqual([
      'sales-summary',
      'sales-by-period',
      'top-products',
      'business-mix',
      'payment-methods',
    ]);
    expect(result.widgetOrder).toEqual([
      'sales-summary',
      'sales-by-period',
      'top-products',
      'business-mix',
      'payment-methods',
      'inventory-value',
      'operational-snapshot',
    ]);
  });

  it('returns project defaults when preferences are missing', () => {
    expect(normalizeReportsWidgetPreferences(null)).toEqual(
      getDefaultReportsWidgetPreferences()
    );
  });
});

describe('parseDateInputBoundary', () => {
  it('builds an ISO string for the start of the selected day', () => {
    expect(parseDateInputBoundary('2026-04-19', 'start')).toBe('2026-04-19T03:00:00.000Z');
  });

  it('builds an ISO string for the end of the selected day', () => {
    expect(parseDateInputBoundary('2026-04-19', 'end')).toBe('2026-04-20T02:59:59.999Z');
  });
});

describe('getCustomRangeError', () => {
  it('rejects missing dates', () => {
    expect(getCustomRangeError('', '2026-04-19')).toContain('inicio y fin');
  });

  it('rejects inverted ranges', () => {
    expect(getCustomRangeError('2026-04-20', '2026-04-19')).toContain('posterior');
  });

  it('accepts a valid custom range', () => {
    expect(getCustomRangeError('2026-04-01', '2026-04-19')).toBeNull();
  });
});

describe('buildReportsCsv', () => {
  it('exports only the sections for visible widgets plus the applied range', () => {
    const csv = buildReportsCsv(sampleReport, ['sales-summary', 'top-products']);

    expect(csv).toContain('"Resumen","Ingresos","100000.00"');
    expect(csv).toContain('"Resumen","Monto pendiente","8000.00"');
    expect(csv).toContain('"Comparacion","Ingresos anteriores","80000.00"');
    expect(csv).toContain('"Top productos","iPhone 14 128GB Negro","2","60000.00","50.00"');
    expect(csv).not.toContain('"Inventario","Costo del stock disponible","300000.00"');
    expect(csv).not.toContain('"Categorias","Usados"');
    expect(csv).toContain('"Rango","Inicio","2026-04-01T00:00:00.000Z"');
  });

  it('exports category, client and aging rows when those widgets are visible', () => {
    const csv = buildReportsCsv(sampleReport, ['business-mix', 'inventory-value']);

    expect(csv).toContain('"Categorias","Usados","4","100000.00","100.00"');
    expect(csv).toContain('"Clientes","Ana","2","60000.00"');
    expect(csv).toContain('"Inventario","Antiguedad 0-14 días","4","200000.00"');
  });
});
