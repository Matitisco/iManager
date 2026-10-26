import { expect, it } from 'vitest';
import { applyPlans, heuristicPlan, type ImportSheet } from './sheet-plan.js';

const apply = (sheets: ImportSheet[]) => applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');

it('conserva cinco unidades y USD 2200 al importar las cantidades del fixture QA 02', () => {
  const result = apply([{ name: 'Stock', rows: [
    ['Modelo', 'Cantidad', 'Precio USD', 'Batería'],
    ['iPhone 13', '3', '400', '89%'],
    ['iPhone 14', '2', '500', '92%'],
  ] }]);
  expect(result.rows).toHaveLength(5);
  expect(result.summary).toMatchObject({ rowCount: 5, sheets: [{ rows: 5 }] });
  expect(result.rows.map(row => row.model)).toEqual(['iPhone 13', 'iPhone 13', 'iPhone 13', 'iPhone 14', 'iPhone 14']);
  expect(result.rows.reduce((total, row) => total + Number(row.price), 0)).toBe(2200);
  expect(result.rows.every(row => row.currency === 'USD' && row.quantity === undefined)).toBe(true);
});

it('no multiplica un IMEI ni inventa cantidad cuando falta la columna', () => {
  const result = apply([{ name: 'Stock', rows: [
    ['Modelo', 'Cantidad', 'Precio USD', 'IMEI'],
    ['iPhone 13', '3', '400', '990000000001109'],
    ['iPhone 14', '', '500', ''],
  ] }]);
  expect(result.rows).toHaveLength(2);
  expect(apply([{ name: 'Stock', rows: [['Modelo', 'Precio USD'], ['iPhone 13', '400']] }]).rows).toHaveLength(1);
});

it.each(['0', '-1', '1.5', 'Infinity', '2001', 'tres'])('rechaza cantidad inválida %s sin importar un stock parcial', quantity => {
  expect(() => apply([{ name: 'Stock', rows: [['Modelo', 'Cantidad', 'Precio USD'], ['iPhone 13', quantity, '400']] }])).toThrow();
});
it('respeta el máximo de 2000 equipos del endpoint de importación', () => {
  expect(() => apply([{ name: 'Stock', rows: [['Modelo', 'Cantidad', 'Precio USD'], ['iPhone 13', '1001', '400'], ['iPhone 14', '1000', '500']] }])).toThrow();
});

it.each(['Cantidad', 'Unidades', 'Qty', 'Quantity'])('reconoce %s sin modificar el mapeo visible', header => {
  const sheets = [{ name: 'Stock', rows: [['Modelo', header, 'Precio USD'], ['iPhone 13', '3', '400']] }];
  const result = apply(sheets);
  expect(result.rows).toHaveLength(3);
  expect(result.plans[0].mapping.find(column => column.header === header)?.field).toBe('');
});

it('cuenta las unidades de todas las hojas contra el límite sin expandir las excluidas', () => {
  const sheets = ['Stock 1', 'Stock 2'].map(name => ({ name, rows: [['Modelo', 'Cantidad', 'Precio USD'], ['iPhone 13', '1001', '400']] }));
  expect(() => apply(sheets)).toThrow();
  const plans = heuristicPlan(sheets, 'inventory', 'USD');
  plans[1].include = false;
  expect(applyPlans(sheets, plans, 'inventory', 'USD').rows).toHaveLength(1001);
});
