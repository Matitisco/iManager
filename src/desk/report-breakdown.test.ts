import { describe, expect, it } from 'vitest';
import type { CustomColumn } from '../types';
import {
  buildClientReport,
  dimensionsFor,
  groupBreakdown,
  leadTimeLabel,
  repairLeadDays,
  saleBreakdownLabel,
  sellerLabel,
} from './report-breakdown';

const column = (id: string, label: string, entity: CustomColumn['entity']): CustomColumn => ({
  id, label, entity, type: 'text',
});

describe('report breakdown', () => {
  it('keeps seller as a built-in column and adds other custom columns', () => {
    const dimensions = dimensionsFor('Ventas', [
      column('seller', 'Vendedor', 'sales'),
      column('origin', 'Origen', 'sales'),
      column('color', 'Color extra', 'inventory'),
    ]);
    expect(dimensions.map((item) => item.label)).toEqual(['Medio de pago', 'Modelo', 'Condición', 'Color', 'Vendedor', 'Origen']);
  });

  it('reads the seller from a custom column or a vendedor field', () => {
    const columns = [column('seller', 'Vendedor', 'sales')];
    expect(sellerLabel({ seller: 'Ana' }, columns)).toBe('Ana');
    expect(sellerLabel({ vendedor: 'Luis' })).toBe('Luis');
    expect(sellerLabel({})).toBe('Sin vendedor');
    expect(saleBreakdownLabel({ paymentMethod: 'TARJETA', deviceLabel: 'Pixel 8' }, 'payment', [])).toBe('Tarjeta');
    expect(saleBreakdownLabel({ deviceLabel: 'Pixel 8' }, 'model', [])).toBe('Pixel 8');
    expect(saleBreakdownLabel({ productId: 'p1' }, 'condition', [{ id: 'p1', condition: 'USADO' }])).toBe('Usado');
  });

  it('folds extra slices into Otros', () => {
    const grouped = groupBreakdown([
      { label: 'A', value: 7 },
      { label: 'B', value: 6 },
      { label: 'C', value: 5 },
      { label: 'D', value: 4 },
      { label: 'E', value: 3 },
      { label: 'F', value: 2 },
      { label: 'G', value: 1 },
    ]);
    expect(grouped.parts.map((part) => part.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'Otros']);
    expect(grouped.parts.at(-1)?.value).toBe(3);
    expect(grouped.otherLabels).toEqual(['F', 'G']);
  });

  it('classifies altas, returning buyers and first purchases inside the period', () => {
    const bounds = {
      start: new Date(2026, 3, 1),
      end: new Date(2026, 3, 4),
      prevStart: new Date(2026, 2, 29),
      prevEnd: new Date(2026, 3, 1),
    };
    const report = buildClientReport({
      clients: [
        { id: 'new', name: 'Ana', createdAt: '2026-04-02T12:00:00-03:00', tag: 'VIP' },
        { id: 'back', name: 'Luis', createdAt: '2026-01-01T12:00:00-03:00' },
        { id: 'once', name: 'Zoe', createdAt: '2026-01-02T12:00:00-03:00' },
        { id: 'idle', name: 'Nico', createdAt: '2026-01-03T12:00:00-03:00' },
      ],
      categories: [],
      sales: [
        { clientId: 'new', date: '2026-04-02', amount: 10, status: 'COMPLETADA' },
        { clientId: 'new', date: '2026-04-03', amount: 15, status: 'COMPLETADA' },
        { clientId: 'back', date: '2026-03-01', amount: 5, status: 'COMPLETADA' },
        { clientId: 'back', date: '2026-04-01', amount: 20, status: 'COMPLETADA' },
        { clientId: 'once', date: '2026-04-03', amount: 8, status: 'COMPLETADA' },
        { clientId: 'once', date: '2026-04-03', amount: 100, status: 'CANCELADA' },
        { clientId: 'idle', date: '2026-01-01', amount: 1, status: 'COMPLETADA' },
      ],
      bounds,
      project: (amount) => amount,
    });
    expect(report.altas).toBe(1);
    expect(report.recurrentes).toBe(1);
    expect(report.rows.map((row) => [row.name, row.kind, row.purchases, row.revenue])).toEqual([
      ['Ana', 'Alta', 2, 25],
      ['Luis', 'Recurrente', 1, 20],
      ['Zoe', 'Primera compra', 1, 8],
    ]);
  });

  it('measures repair turnaround through the delivered event', () => {
    expect(repairLeadDays({ status: 'RECIBIDO', receivedAt: '01/04/2026', events: [] })).toBeNull();
    expect(repairLeadDays({
      status: 'ENTREGADO',
      receivedAt: '01/04/2026',
      events: [{ status: 'ENTREGADO', createdAt: '03/04/2026' }],
    })).toBe(2);
    expect(leadTimeLabel(null)).toBe('sin entregas para medir el tiempo');
    expect(leadTimeLabel(0)).toBe('tiempo medio: mismo día');
    expect(leadTimeLabel(2)).toBe('tiempo medio: 2 días');
  });
});