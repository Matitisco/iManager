import { describe, expect, it } from 'vitest';
import { applyPlans, heuristicPlan } from './sheet-plan.js';
import { analyzeImport } from './analyze-import.service.js';

const grid = [['Modelo', 'IMEI', 'Color', 'Calidad', 'Batería', 'Costo', 'Estado'],
  ['iPhone 13', '356789012345671', 'Negro', 'A', '87%', '420', 'Disponible'],
  ['iPhone 12', '356789012345672', 'Blanco', 'B', '83%', '310', 'Disponible']];

describe('precio a definir', () => {
  it('conserva todas las filas sin columna de precio y su costo', () => {
    const sheets = [{ name: 'Stock', rows: grid }];
    const applied = applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');
    expect(applied.summary.rowCount).toBe(2);
    expect(applied.rows).toEqual([expect.objectContaining({ model: 'iPhone 13', cost: '420' }), expect.objectContaining({ model: 'iPhone 12', cost: '310' })]);
    expect(applied.rows.every(row => row.price == null)).toBe(true);
    expect(applied.diagnostics).toMatchObject({ detectedRows: 2, acceptedRows: 2, discardedRows: 0, discardedByReason: {}, missingRequiredFields: [], missingRecommendedFields: ['price'] });
  });
  it('conserva filas con precio vacío y distingue precio cero', () => {
    const sheets = [{ name: 'Stock', rows: [['Modelo', 'Precio'], ['iPhone 13', ''], ['iPhone 12', '0'], ['iPhone 14', '650']] }];
    const applied = applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');
    expect(applied.rows.map(row => row.price)).toEqual(['', '0', '650']);
  });
  it('sigue exigiendo modelo y expande unidades sin precio', () => {
    const sheets = [{ name: 'Stock', rows: [['Modelo', 'Cantidad', 'Costo'], ['iPhone 13', '2', '420'], ['', '1', '310']] }];
    const applied = applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');
    expect(applied.rows).toHaveLength(2);
    expect(applied.diagnostics.discardedRows).toBe(1);
    expect(applied.rows.every(row => row.model === 'iPhone 13')).toBe(true);
  });
  it('el análisis sin proveedor externo admite el archivo sin precio', async () => {
    const applied = await analyzeImport({ section: 'inventory', currency: 'USD', sheets: [{ name: 'Stock', rows: grid }] }, {});
    expect(applied.summary.rowCount).toBe(2);
  });
});

it('cuenta encabezados repetidos sin descartar un modelo que solo tiene nombre', () => {
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Precio'], ['USADOS', ''], ['iPhone 13', ''], ['Modelo', 'Precio'], ['Samsung', ''], ['Galaxy S24', '']] }];
  const result = applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');
  expect(result.rows.map(row => row.model)).toEqual(['iPhone 13', 'Galaxy S24']);
  expect(result.diagnostics).toMatchObject({ detectedRows: 5, acceptedRows: 2, discardedRows: 3, discardedByReason: { section_header: 3 } });
});

it('no transforma un texto de precio inválido en un precio ausente', () => {
 const sheets = [{ name: 'Stock', rows: [['Modelo', 'Precio'], ['iPhone 13', 'inválido']] }];
 const result = applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');
 expect(result.rows).toEqual([]);
 expect(result.diagnostics).toMatchObject({ acceptedRows: 0, discardedRows: 1, discardedByReason: { invalid_price: 1 } });
});
