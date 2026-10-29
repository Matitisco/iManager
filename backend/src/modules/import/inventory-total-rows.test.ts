import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isPossibleInventoryTotal, POSSIBLE_TOTAL_NOTE, prepareInventoryImportRow } from '../inventory/import-validation.js';
import { applyPlans, heuristicPlan, type ImportSheet } from './sheet-plan.js';

const reviewRows = (rows: Record<string, string>[]) => rows.filter(row => row.batteryNote?.split('\n').includes(POSSIBLE_TOTAL_NOTE));
function preview(data: string[][]) {
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'IMEI', 'Precio', 'Notas'], ...data] }];
  const plan = heuristicPlan(sheets, 'inventory', 'USD');
  return applyPlans(sheets, plan, 'inventory', 'USD');
}

it.each(['TOTAL', 'Subtotal', 'SUB TOTAL', 'Suma', 'Totales', 'Total general'])('preserves %s in any cell and marks it for review', label => {
  const result = preview([['iPhone 13', '', '100', ''], ['iPhone 14', '', '200', ''], ['', '', '300', label]]);
  expect(result.rows).toHaveLength(3);
  expect(result.summary.rowCount).toBe(3);
  expect(result.diagnostics.discardedRows).toBe(0);
  expect(reviewRows(result.rows)).toHaveLength(1);
  expect(result.rows[2]).toMatchObject({ model: 'Equipo sin modelo', price: '300', status: 'EN_REVISION' });
  expect(result.rows[2].batteryNote).toContain(label);
  const confirmed = prepareInventoryImportRow(result.rows[2], 4, new Map());
  expect(confirmed).toEqual(result.rows[2]);
  expect(confirmed.batteryNote.split('\n').filter(note => note === POSSIBLE_TOTAL_NOTE)).toHaveLength(1);
});

it('detects unlabelled sums, subtotals and a grand total without double counting', () => {
  const result = preview([
    ['iPhone 11', '', '100,10', ''], ['iPhone 12', '', '200,20', ''], ['', '', '300,30', 'Subtotal'],
    ['iPhone 13', '', '400', ''], ['iPhone 14', '', '500', ''], ['', '', '900', ''], ['', '', '1200,30', ''],
  ]);
  expect(result.summary.rowCount).toBe(7);
  expect(reviewRows(result.rows).map(row => row._sourceRow)).toEqual(['4', '7', '8']);
});

it('does not flag ordinary amounts, one prior amount, modelled devices or any nonempty IMEI', () => {
  const result = preview([
    ['iPhone 11', '', '100', ''], ['', '', '100', ''], ['', '', '13', ''],
    ['iPhone 13', '', '213', ''], ['', '990000000000038', '426', 'TOTAL'],
    ['', '3.5E+14', '852', 'Subtotal'], ['Totalmente nuevo', '', '100', ''],
  ]);
  expect(result.rows).toHaveLength(7);
  expect(reviewRows(result.rows)).toHaveLength(0);
  expect(isPossibleInventoryTotal({ imei: 'ilegible' }, ['TOTAL'])).toBe(false);
  for (const row of result.rows) expect(prepareInventoryImportRow(row, Number(row._sourceRow), new Map()).batteryNote).not.toContain(POSSIBLE_TOTAL_NOTE);
});

it('limits sums to each selected sheet and data range', () => {
  const sheets = ['A', 'B'].map(name => ({ name, rows: [['Modelo', 'Precio'], ['iPhone 11', '100'], ['iPhone 12', '200'], ['', '300']] }));
  const plans = heuristicPlan(sheets, 'inventory', 'USD');
  plans[1].dataStartRow = 4;
  const result = applyPlans(sheets, plans, 'inventory', 'USD');
  expect(result.summary.rowCount).toBe(4);
  expect(reviewRows(result.rows).map(row => row._sourceSheet)).toEqual(['A']);
});

it.each([
  { file: 'ai-fakes/F07_desordenado_a_mano', env: 'IMPORT_F07_GRID', expected: 25, totals: 1 },
  { file: 'natan/00_natan_anon', env: 'IMPORT_NATAN_GRID', expected: 60, totals: 0 },
])('$file keeps its count with $totals possible totals', fixture => {
  const sheets: ImportSheet[] = JSON.parse(readFileSync(process.env[fixture.env] || new URL(`../../../test/fixtures/import/${fixture.file}.grid.json`, import.meta.url), 'utf8'));
  const plans = heuristicPlan(sheets, 'inventory', 'ARS');
  const result = applyPlans(sheets, plans, 'inventory', 'ARS');
  expect(result.rows).toHaveLength(fixture.expected);
  expect(result.summary.rowCount).toBe(fixture.expected);
  expect(reviewRows(result.rows)).toHaveLength(fixture.totals);
  expect(applyPlans(sheets, plans, 'inventory', 'ARS').rows).toEqual(result.rows);
});
