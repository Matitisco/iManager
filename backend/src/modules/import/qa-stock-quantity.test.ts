import { afterEach, expect, it, vi } from 'vitest';
import { applyPlans, heuristicPlan, type ImportSheet } from './sheet-plan.js';
import { analyzeImport, applyImportPlan } from './analyze-import.service.js';
import { buildDecisionContext, plansFromAnswers } from './decisions-plan.js';

const apply = (sheets: ImportSheet[]) => applyPlans(sheets, heuristicPlan(sheets, 'inventory', 'USD'), 'inventory', 'USD');
afterEach(() => vi.unstubAllEnvs());

it('prepara cantidades mayoristas con costo y precio unitarios separados', () => {
  const result = apply([{ name: 'Stock', rows: [
    ['Modelo', 'Capacidad', 'Cantidad', 'Costo', 'Precio USD'],
    ['15 Pro', '128GB', '58', '420', '500'],
    ['14 Pro', '256GB', '83', '310', '400'],
  ] }]);
  expect(result.rows).toHaveLength(2);
  expect(result.summary).toMatchObject({ rowCount: 141, sheets: [{ rows: 141 }] });
  expect(result.diagnostics).toMatchObject({ detectedRows: 2, acceptedRows: 2, discardedRows: 0 });
  expect(result.rows).toEqual([
    expect.objectContaining({ model: '15 Pro', quantity: '58', cost: '420', price: '500', capacity: '128GB' }),
    expect.objectContaining({ model: '14 Pro', quantity: '83', cost: '310', price: '400', capacity: '256GB' }),
  ]);
});

it.each(['Cantidad', 'cant', 'Qty', 'Quantity', 'Unidades', 'Stock'])('mapea %s a cantidad y no a batería/costo/estado', header => {
  const result = apply([{ name: 'Stock', rows: [['Modelo', header, 'Costo'], ['15 Pro', '83', '450']] }]);
  expect(result.plans[0].mapping.find(column => column.header === header)?.field).toBe('quantity');
  expect(result.rows[0]).toMatchObject({ quantity: '83', cost: '450' });
  expect(result.rows[0].batteryHealth).toBeUndefined();
  expect(result.summary.rowCount).toBe(83);
});

it('usa uno sin columna, con celda vacía o cantidad explícita 1', () => {
  const result = apply([{ name: 'Stock', rows: [['Modelo', 'Cantidad'], ['15 Pro', ''], ['14 Pro', '1']] }]);
  expect(result.rows.map(row => row.quantity)).toEqual(['1', '1']);
  const single = apply([{ name: 'Stock', rows: [['Modelo', 'Costo'], ['15 Pro', '450']] }]);
  expect(single.rows[0]).toMatchObject({ quantity: '1', cost: '450' });
  expect(single.summary.rowCount).toBe(1);
});

it('no replica IMEI para cantidades múltiples y conserva el original para revisar', () => {
  const result = apply([{ name: 'Stock', rows: [['Modelo', 'Cantidad', 'IMEI'], ['15 Pro', '3', '990000000001109']] }]);
  expect(result.rows[0]).toMatchObject({ quantity: '3', imei: '', status: 'EN_REVISION', batteryNote: 'imei (origen): 990000000001109' });
  expect(result.summary.rowCount).toBe(3);
});

it.each(['0', '-1', '1.5', 'Infinity', 'tres', '9007199254740992'])('conserva cantidad inválida %s para revisión sin expansión', quantity => {
  const result = apply([{ name: 'Stock', rows: [['Modelo', 'Cantidad'], ['15 Pro', quantity]] }]);
  expect(result.rows[0]).toMatchObject({ quantity: '1', status: 'EN_REVISION' });
  expect(result.rows[0].batteryNote).toContain(`quantity (origen): ${quantity}`);
  expect(result.summary.rowCount).toBe(1);
});

it('cuenta miles de unidades de todas las hojas incluidas', () => {
  const sheets = ['A', 'B'].map(name => ({ name, rows: [['Modelo', 'Cantidad'], ['15 Pro', '1001']] }));
  expect(apply(sheets).summary.rowCount).toBe(2002);
  const plans = heuristicPlan(sheets, 'inventory', 'USD');
  plans[1].include = false;
  expect(applyPlans(sheets, plans, 'inventory', 'USD').summary.rowCount).toBe(1001);
});

it('conserva una fila de total sin volver a multiplicar el stock', () => {
  const result = apply([{ name: 'Stock', rows: [['Modelo', 'Cantidad'], ['15 Pro', '58'], ['14 Pro', '83'], ['Total', '141']] }]);
  expect(result.summary.rowCount).toBe(142);
  expect(result.rows[2]).toMatchObject({ quantity: '1', status: 'EN_REVISION' });
  expect(result.rows[2].batteryNote).toContain('Parece una fila de total');
});

it('analyze y apply manual conservan cantidades, y permiten descartar su mapeo', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Cantidad', 'Costo'], ['15 Pro', '1001', '450']] }];
  const input = { section: 'inventory' as const, currency: 'USD' as const, sheets };
  const analysis = await analyzeImport(input);
  expect(analysis.summary.rowCount).toBe(1001);
  expect((await applyImportPlan({ ...input, plan: analysis.plan })).rows).toEqual(analysis.rows);
  const plan = analysis.plan.map(sheet => ({ ...sheet, mapping: sheet.mapping.map(column => column.field === 'quantity' ? { ...column, field: 'ignore' } : column) }));
  expect((await applyImportPlan({ ...input, plan })).summary.rowCount).toBe(1);
});

it('el plan externo ofrece y aplica el campo cantidad', () => {
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Cantidad', 'Costo'], ['15 Pro', '58', '450']] }];
  const context = buildDecisionContext(sheets, 'inventory', 'USD')!;
  expect(context.request.questions.find(question => question.name === 'h0_c1')?.choices).toContainEqual(expect.objectContaining({ value: 'quantity' }));
  const plan = plansFromAnswers(context, [{ name: 'h0_inc', probability: 1 }, { name: 'h0_c1', choice: 'quantity' }], 'inventory', 'USD');
  expect(plan[0].mapping).toContainEqual(expect.objectContaining({ field: 'quantity', columnIndex: 1 }));
});
