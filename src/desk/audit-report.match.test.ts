import { describe, expect, it } from 'vitest';
import { combineAmounts } from './money';
import { customReportBounds, inReportPeriod } from './report-period';
import { isInStock, paymentLabel } from './format';

const bounds = customReportBounds('2026-09-01', '2026-09-30').bounds!;
const sales = [
  { date: '15/09/2026', status: 'COMPLETADA', amount: 1_000_000, currency: 'ARS', paymentMethod: 'TRANSFERENCIA' },
  { date: '20/09/2026', status: 'PENDIENTE', amount: 200, currency: 'USD', paymentMethod: 'EFECTIVO' },
  { date: '10/09/2026', status: 'CANCELADA', amount: 500_000, currency: 'ARS', paymentMethod: 'TARJETA' },
  { date: '01/10/2026', status: 'COMPLETADA', amount: 999, currency: 'ARS', paymentMethod: 'TARJETA' },
  { date: '02/08/2026', status: 'COMPLETADA', amount: 400_000, currency: 'ARS', paymentMethod: 'TRANSFERENCIA' },
  { date: '01/08/2026', status: 'COMPLETADA', amount: 900_000, currency: 'ARS', paymentMethod: 'EFECTIVO' },
];

describe('Reportes y el mail automático cuentan igual', () => {
  it('factura las no canceladas del período, convierte USD y separa las canceladas', () => {
    const counted = sales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.start, bounds.end));
    const previous = sales.filter((sale) => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.prevStart, bounds.prevEnd));
    const cancelled = sales.filter((sale) => sale.status === 'CANCELADA' && inReportPeriod(sale.date, bounds.start, bounds.end));
    expect(combineAmounts(counted.map((sale) => ({ amount: sale.amount, currency: sale.currency })), 'ARS', 1000)).toBe(1_200_000);
    expect(combineAmounts(previous.map((sale) => ({ amount: sale.amount, currency: sale.currency })), 'ARS', 1000)).toBe(400_000);
    expect(cancelled).toHaveLength(1);
    expect(combineAmounts(cancelled.map((sale) => ({ amount: sale.amount, currency: sale.currency })), 'ARS', 1000)).toBe(500_000);
    const byPayment = new Map<string, number>();
    for (const sale of counted) {
      const label = paymentLabel(sale.paymentMethod);
      const value = combineAmounts([{ amount: sale.amount, currency: sale.currency }], 'ARS', 1000) ?? 0;
      byPayment.set(label, (byPayment.get(label) ?? 0) + value);
    }
    expect(byPayment.get('Transferencia')).toBe(1_000_000);
    expect(byPayment.get('Efectivo')).toBe(200_000);
  });

  it('el stock del período usa el día de Argentina, igual que el tab Stock', () => {
    const items = [
      { createdAt: '2026-09-15T15:00:00.000Z', status: 'DISPONIBLE' },
      { createdAt: '2026-09-20T15:00:00.000Z', status: 'VENDIDO' },
      { createdAt: '2026-09-01T02:00:00.000Z', status: 'DISPONIBLE' },
      { createdAt: '2026-09-01T03:00:00.000Z', status: 'EN_REVISION' },
    ].filter((item) => inReportPeriod(item.createdAt, bounds.start, bounds.end));
    expect(items).toHaveLength(3);
    expect(items.filter((item) => isInStock(item.status))).toHaveLength(1);
  });
});
