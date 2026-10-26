import { expect, it } from 'vitest';
import { applyPlans, heuristicPlan, parseMoney } from './sheet-plan.js';
import { normalizeCurrencyToken } from './normalize-import.js';

it.each(['AR$', 'ARS', 'ar$'])('reconoce el prefijo %s sin descartar filas de inventario', (prefix) => {
  const sheets = [{ name: 'Stock', rows: [
    ['Modelo', 'IMEI', 'Precio', 'Costo', 'Moneda'],
    ['iPhone 13 AR$', '990000000001109', `${prefix} 650.000,50`, `${prefix} 500.000,25`, prefix],
  ] }];
  expect(parseMoney(`${prefix} 650.000,50`)).toBe(650000.50);
  expect(normalizeCurrencyToken(prefix)).toBe('ARS');
  expect(applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD').rows).toEqual([
    expect.objectContaining({ model: 'iPhone 13 AR$', price: '650000.5', cost: '500000.25', currency: 'ARS' }),
  ]);
});
