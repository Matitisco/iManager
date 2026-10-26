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
  it('counts every stock row without price and preserves the existing zero-row outcome', () => {
    const result = apply(withoutPrice);
    expect(result.rows).toEqual([]);
    expect(result.summary.rowCount).toBe(0);
    expect(result.plans[0].mapping).toContainEqual({ header: 'Costo', field: 'cost' });
    expect(result.plans[0].mapping.some(column => column.field === 'price')).toBe(false);
    expect(result.diagnostics).toEqual({ detectedRows: 2, acceptedRows: 0, discardedRows: 2,
      discardedByReason: { missing_price: 2 }, missingRequiredFields: ['price'], missingRecommendedFields: [] });
    expect(result.summary.sheets[0].diagnostics).toEqual(result.diagnostics);
  });

  it.each(['Costo', 'Precio de compra', 'Precio compra USD', 'Cost price', 'Purchase price', 'Valor de compra'])('never maps %s to sale price', (header) => {
    const sheets = [{ name: 'Stock', rows: [['Modelo', header, 'Color'], ['iPhone 13', '420', 'Negro']] }];
    expect(apply(sheets).diagnostics.missingRequiredFields).toContain('price');
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

  it('assigns exactly one reason per physical row and keeps quantity-expanded rowCount separate', () => {
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
    expect(result.summary.rowCount).toBe(3);
    expect(result.diagnostics).toEqual({ detectedRows: 7, acceptedRows: 1, discardedRows: 6,
      discardedByReason: { empty: 1, footer: 1, section_header: 1, missing_model: 1, missing_price: 1, invalid_price: 1 },
      missingRequiredFields: [], missingRecommendedFields: ['imei'] });
  });

  it('keeps excluded sheets separate and unions missing fields across included sheets', () => {
    const sheets = [...withoutPrice, { name: 'Other', rows: [['Modelo', 'Precio'], ['iPhone 13', '500']] }];
    const plans = heuristicPlan(sheets, 'inventory', 'USD');
    const result = applyPlans(sheets, plans, 'inventory', 'USD');
    expect(result.diagnostics.missingRequiredFields).toEqual(['price']);
    expect(result.diagnostics.missingRecommendedFields).toEqual(['imei']);
    plans[0].include = false;
    const next = applyPlans(sheets, plans, 'inventory', 'USD');
    expect(next.diagnostics).toMatchObject({ detectedRows: 3, acceptedRows: 1, discardedRows: 2,
      discardedByReason: { excluded_sheet: 2 }, missingRequiredFields: [] });
  });
});
