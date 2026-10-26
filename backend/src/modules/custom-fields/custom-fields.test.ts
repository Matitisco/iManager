import { describe, expect, it } from 'vitest';
import { convertFields, fieldValue } from './custom-fields.service.js';
import { applyPlans, heuristicPlan } from '../import/sheet-plan.js';
import { acceptModelPlan } from '../import/analyze-import.service.js';
import { buildDecisionContext, plansFromAnswers } from '../import/decisions-plan.js';

const field = { key: 'reparaciones', label: 'Reparaciones', type: 'number' as const };
describe('typed equipment columns', () => {
  it('converts Argentine numbers, dates and blank values without losing zero', () => {
    expect(fieldValue('1.250,50', field)).toBe(1250.5);
    expect(fieldValue('0', field)).toBe(0);
    expect(fieldValue('', field)).toBeNull();
    expect(fieldValue('14/10/2026', { label: 'Garantía', type: 'date' })).toBe('2026-10-14');
    expect(() => fieldValue('31/02/2026', { label: 'Garantía', type: 'date' })).toThrow('fecha inválida');
    expect(() => fieldValue('12 equipos', field)).toThrow('número inválido');
    expect(convertFields({ reparaciones: '2', serial: 'legacy' }, [field])).toEqual({ reparaciones: 2, serial: 'legacy' });
  });
  it('keeps the first row, all sixteen physical columns and source row numbers', () => {
    const sheets = [{ name: 'Stock', rows: [
      ['14/10/2026','Proveedor ficticio','iPhone 13','128GB','0.87','350000000000017','A','Black','420','Original','DISPONIBLE','','Caja','Persona ficticia','90000000','2615550100'],
      ['15/10/2026','Proveedor ficticio','iPhone 14','256GB','0.91','350000000000025','B','Blue','520','Cambiada','DISPONIBLE','','Cargador','Persona ficticia','90000001','2615550101'],
    ] }];
    const plans = heuristicPlan(sheets, 'inventory', 'USD');
    expect(plans[0]).toMatchObject({ headerRow: 0, include: true, dataStartRow: 1 });
    expect(plans[0].mapping).toHaveLength(16);
    plans[0].mapping[9].field = 'batteryNote';
    plans[0].mapping[12].field = 'custom:accesorios';
    const result = applyPlans(sheets, plans, 'inventory', 'USD');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ model: 'iPhone 13', batteryNote: 'Original', entryDate: '14/10/2026', 'custom:accesorios': 'Caja', _sourceRow: '1' });
    expect(result.rows[0].price).toBeUndefined();
  });
  it('uses indices for duplicate/empty headers and discards only the selected column', () => {
    const sheets = [{ name: 'Stock', rows: [['Modelo', '', 'Nota', 'Nota'], ['iPhone 13', '15/10/2026', 'A', 'B']] }];
    const plans = heuristicPlan(sheets, 'inventory', 'USD');
    plans[0] = { ...plans[0], include: true, headerRow: 1, dataStartRow: 2, mapping: [
      { header: 'Modelo', columnIndex: 0, field: 'model' }, { header: 'B', columnIndex: 1, field: 'entryDate' },
      { header: 'Nota', columnIndex: 2, field: 'ignore' }, { header: 'Nota', columnIndex: 3, field: 'custom:nota' },
    ] };
    expect(applyPlans(sheets, plans, 'inventory', 'USD').rows[0]).toMatchObject({ entryDate: '15/10/2026', 'custom:nota': 'B' });
  });
  it('accepts headerless plans from Responses and Decisions', () => {
    const sheets = [{ name: 'Stock', rows: [['iPhone 13','128GB','87%'], ['iPhone 14','256GB','91%']] }];
    const plan = heuristicPlan(sheets, 'inventory', 'USD')[0];
    const accepted = acceptModelPlan(sheets, { sheets: [plan] }, 'inventory', 'USD');
    expect(accepted?.[0].headerRow).toBe(0);
    expect(applyPlans(sheets, accepted!, 'inventory', 'USD').rows).toHaveLength(2);
    const context = buildDecisionContext(sheets, 'inventory', 'USD')!;
    expect(context.sheets[0].candidates).toEqual([0]);
    const answers = [{ name: 'h0_inc', probability: 1 }, { name: 'h0_c0', choice: 'model', confidence: 1 }, { name: 'h0_c1', choice: 'capacity', confidence: 1 }, { name: 'h0_c2', choice: 'batteryHealth', confidence: 1 }];
    expect(applyPlans(sheets, plansFromAnswers(context, answers, 'inventory', 'USD'), 'inventory', 'USD').rows).toHaveLength(2);
  });
});
