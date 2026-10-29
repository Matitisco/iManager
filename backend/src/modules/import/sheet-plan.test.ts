import { describe, expect, it } from 'vitest';
import { autoMap } from './column-mapping.js';
import { IMPORT_CATALOGS } from './import-catalog.js';
import { applyPlans, heuristicPlan, type ImportSheet } from './sheet-plan.js';

const withoutPrice: ImportSheet[] = [{ name: 'Stock', rows: [
  ['Modelo', 'IMEI', 'Color', 'Calidad', 'Batería', 'Costo', 'Estado'],
  ['iPhone 13', '356789012345671', 'Negro', 'A', '87%', '420', 'Disponible'],
  ['iPhone 12', '356789012345672', 'Blanco', 'B', '83%', '310', 'Disponible'],
] }];

const apply = (sheets: ImportSheet[]) => applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');

describe('spreadsheet diagnostics', () => {
  it('accepts stock rows without price and reports price as recommended', () => {
    const result = apply(withoutPrice);
    expect(result.rows).toEqual([expect.objectContaining({ model: 'iPhone 13', cost: '420' }), expect.objectContaining({ model: 'iPhone 12', cost: '310' })]);
    expect(result.summary.rowCount).toBe(2);
    expect(result.plans[0].mapping).toContainEqual({ header: 'Costo', columnIndex: 5, field: 'cost' });
    expect(result.plans[0].mapping.some(column => column.field === 'price')).toBe(false);
    expect(result.diagnostics).toEqual({ detectedRows: 2, acceptedRows: 2, discardedRows: 0,
      discardedByReason: {}, missingRequiredFields: [], missingRecommendedFields: ['price'] });
    expect(result.summary.sheets[0].diagnostics).toEqual(result.diagnostics);
  });

  it.each(['Costo', 'Precio de compra', 'Precio compra USD', 'Cost price', 'Purchase price', 'Valor de compra'])('never maps %s to sale price', (header) => {
    const sheets = [{ name: 'Stock', rows: [['Modelo', header, 'Color'], ['iPhone 13', '420', 'Negro']] }];
    expect(apply(sheets).diagnostics.missingRecommendedFields).toContain('price');
    const catalog = IMPORT_CATALOGS.inventory;
    expect(autoMap([header], catalog.fields, catalog.hints).price).toBeUndefined();
    const sales = IMPORT_CATALOGS.sales;
    expect(autoMap([header], sales.fields, sales.hints).amount).toBeUndefined();
  });

  it.each(['Venta', 'PVP', 'Precio USD', '$'])('recognizes sale price %s next to cost', (header) => {
    const result = apply([{ name: 'Stock', rows: [['Modelo', 'Costo', header], ['iPhone 13', '420', '500']] }]);
    expect(result.rows).toEqual([expect.objectContaining({ model: 'iPhone 13', cost: '420', price: '500' })]);
    expect(result.diagnostics.missingRequiredFields).toEqual([]);
  });

  it('keeps every nonempty physical row exactly once and preserves invalid values', () => {
    const result = apply([{ name: 'Stock', rows: [
      ['Modelo', 'Precio', 'Color', 'Cantidad'],
      ['iPhone 13', '500', 'Negro', '3'],
      ['', '', '', ''],
      ['Subtotal', '500', '', ''],
      ['USADOS', '', '', ''],
      ['', '500', 'Negro', ''],
      ['iPhone 14', '', 'Negro', ''],
      ['iPhone 15', 'a consultar', 'Negro', ''],
    ] }]);
    expect(result.summary.rowCount).toBe(6);
    expect(result.diagnostics).toEqual({ detectedRows: 7, acceptedRows: 6, discardedRows: 1,
      discardedByReason: { empty: 1 }, missingRequiredFields: [], missingRecommendedFields: ['imei'] });
    expect(result.rows[0].batteryNote).toContain('Cantidad (origen): 3');
    expect(result.rows[3]).toMatchObject({ model: 'Equipo sin modelo', status: 'EN_REVISION' });
    expect(result.rows[5].batteryNote).toContain('a consultar');
  });

  it('keeps excluded sheets separate and unions missing fields across included sheets', () => {
    const sheets = [...withoutPrice, { name: 'Other', rows: [['Modelo', 'Precio'], ['iPhone 13', '500']] }];
    const plans = heuristicPlan(sheets, 'inventory', 'USD');
    const result = applyPlans(sheets, plans, 'inventory', 'USD');
    expect(result.diagnostics.missingRequiredFields).toEqual([]);
    expect(result.diagnostics.missingRecommendedFields).toEqual(['price', 'imei']);
    plans[0].include = false;
    const next = applyPlans(sheets, plans, 'inventory', 'USD');
    expect(next.diagnostics).toMatchObject({ detectedRows: 1, acceptedRows: 1, discardedRows: 0,
      discardedByReason: {}, missingRequiredFields: [] });
  });
});
