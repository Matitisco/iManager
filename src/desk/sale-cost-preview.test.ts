import { describe, expect, it } from 'vitest';
import { saleCostPreview } from './sale-cost-preview';

describe('ganancia en vivo de la venta', () => {
  const base = { amount: 1500.31, cost: 900.12, cantidad: 1, currency: 'USD' as const, costCurrency: 'USD', rate: 1200 };
  it('conserva centavos y el precio completo incluso si una parte se paga en canje', () => {
    expect(saleCostPreview(base).profit).toBeCloseTo(600.19);
    expect(saleCostPreview(base).marginPct).toBe(40);
  });
  it('multiplica costo por cantidad, no el total de la venta', () => {
    expect(saleCostPreview({ ...base, amount: 6500, cost: 450, cantidad: 10 }).profit).toBe(2000);
  });
  it('usa la proyección monetaria de Ventas', () => {
    expect(saleCostPreview({ ...base, amount: 1800000, currency: 'ARS' }).profit).toBe(719856);
  });
  it('no inventa ganancia sin costo o sin cotización necesaria', () => {
    expect(saleCostPreview({ ...base, cost: 0 }).profit).toBeNull();
    expect(saleCostPreview({ ...base, costCurrency: 'ARS', rate: null }).profit).toBeNull();
  });
  it('muestra pérdida', () => {
    expect(saleCostPreview({ ...base, amount: 500, cost: 900 }).profit).toBe(-400);
  });
});
