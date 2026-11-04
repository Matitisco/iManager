import { describe, expect, it } from 'vitest';
import { monthPeriods, monthRange, sumFigures } from './balance.js';

describe('meses del balance multitienda', () => {
  it('incluye el mes parcial y atraviesa año y febrero bisiesto', () => {
    expect(monthPeriods(3, 'UTC', new Date('2024-03-15T12:00:00Z'))).toEqual([
      { month: '2024-01', from: '2024-01-01', to: '2024-01-31' },
      { month: '2024-02', from: '2024-02-01', to: '2024-02-29' },
      { month: '2024-03', from: '2024-03-01', to: '2024-03-15' },
    ]);
    expect(
      monthPeriods(3, 'UTC', new Date('2026-01-05T00:00:00Z')).map(
        (row) => row.month,
      ),
    ).toEqual(['2025-11', '2025-12', '2026-01']);
  });
  it('elige el mes según la zona de la tienda y soporta DST', () => {
    const now = new Date('2026-11-01T02:30:00Z');
    expect(
      monthPeriods(3, 'America/Argentina/Buenos_Aires', now).at(-1),
    ).toEqual({ month: '2026-10', from: '2026-10-01', to: '2026-10-31' });
    expect(monthPeriods(3, 'Asia/Tokyo', now).at(-1)).toEqual({
      month: '2026-11',
      from: '2026-11-01',
      to: '2026-11-01',
    });
    expect(
      monthPeriods(3, 'America/New_York', new Date('2026-03-09T02:00:00Z')).at(
        -1,
      )?.to,
    ).toBe('2026-03-08');
  });
  it('combina cada concepto sin redondear otra vez', () => {
    expect(
      sumFigures([
        {
          revenue: 1,
          cost: 0.1,
          grossProfit: 0.9,
          expenses: 0.2,
          netProfit: 0.7,
        },
        {
          revenue: 2,
          cost: 0.2,
          grossProfit: 1.8,
          expenses: 0.4,
          netProfit: 1.4,
        },
      ]).netProfit,
    ).toBeCloseTo(2.1);
  });
});

it('cierra cada mes según el día local de cada tienda, incluyendo zonas adelantadas', () => {
  const now = new Date('2026-11-04T02:30:00Z');
  expect(monthRange('2026-11', 'America/Argentina/Buenos_Aires', now).to).toBe(
    '2026-11-03',
  );
  expect(monthRange('2026-11', 'Asia/Tokyo', now).to).toBe('2026-11-04');
});
