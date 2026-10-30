import { expect, it } from 'vitest';
import { automaticFieldName, prepareAutomaticImportFields } from './import-custom-fields';
import { inventoryImportPayload } from './inventory-import-payload';
import type { CustomFieldInput } from '../services/custom-fields-api';
import type { ImportSheetPlan } from '../services/import-api';

const plan: ImportSheetPlan = { name: 'Stock', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 4, condition: '', splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD',
  mapping: [{ header: 'Modelo', columnIndex: 0, field: 'model' }] };
const grid = [['Modelo', 'Obs. interna', '', 'Obs. interna'], ['iPhone 13', 'pantalla', 'caja', '12/01/27'], [], ['iPhone 14', 'ok', '0', '05/03/27']];
const rows = [2, 4].map(sourceRow => ({ model: grid[sourceRow - 1][0], _sourceRow: String(sourceRow), _sourceSheet: 'Stock' }));

it('guarda todas las columnas físicas con nombres originales o Columna <letra>, sin perder duplicadas ni expandir filas', () => {
  const result = prepareAutomaticImportFields(rows, [{ name: 'Stock', rows: grid }], [plan], [], {});
  expect(result.definitions.map(field => [field.label, field.type])).toEqual([['Obs. interna', 'text'], ['Columna C', 'text'], ['Obs. interna', 'text']]);
  expect(new Set(result.definitions.map(field => field.key)).size).toBe(3);
  expect(result.rows).toHaveLength(2);
  expect(result.rows.map(row => result.definitions.map(field => row[`custom:${field.key}`]))).toEqual([['pantalla', 'caja', '12/01/27'], ['ok', '0', '05/03/27']]);
  expect(result.rows.map(row => [row.model, row._sourceRow])).toEqual(rows.map(row => [row.model, row._sourceRow]));
  expect(inventoryImportPayload(result.rows).map(row => row.customFields)).toEqual([
    { cf_obs_interna: 'pantalla', cf_columna_c: 'caja', cf_obs_interna_2: '12/01/27' },
    { cf_obs_interna: 'ok', cf_columna_c: '0', cf_obs_interna_2: '05/03/27' },
  ]);
  expect(rows[0]).not.toHaveProperty('custom:cf_obs_interna');
});

it('respeta descartes explícitos y columnas ya mapeadas', () => {
  const mapped = { ...plan, mapping: [...plan.mapping, { header: '', columnIndex: 2, field: 'color' }] };
  const result = prepareAutomaticImportFields(rows, [{ name: 'Stock', rows: grid }], [mapped], [], { 'Stock:1': [1] });
  expect(result.definitions.map(field => field.label)).toEqual(['Obs. interna']);
  expect(result.rows[0]['custom:cf_obs_interna']).toBe('12/01/27');
});

it('reutiliza un campo de texto sin sobrescribir destinos asignados ni imponer tipos incompatibles', () => {
  const definitions: CustomFieldInput[] = [
    { entity: 'inventory', key: 'obs_date', label: 'Obs. interna', type: 'date', order: 0 },
    { entity: 'inventory', key: 'obs_text', label: 'Obs. interna', type: 'text', order: 1 },
  ];
  const mapped = { ...plan, mapping: [...plan.mapping, { header: 'Obs. interna', columnIndex: 3, field: 'custom:obs_text' }] };
  const result = prepareAutomaticImportFields(rows.map(row => ({ ...row, 'custom:obs_text': 'preservar' })), [{ name: 'Stock', rows: grid }], [mapped], definitions, {});
  expect(result.rows[0]['custom:obs_text']).toBe('preservar');
  expect(result.rows[0]['custom:cf_obs_interna']).toBe('pantalla');
  const reused = prepareAutomaticImportFields(rows, [{ name: 'Stock', rows: grid }], [plan], definitions, {});
  expect(reused.rows[0]['custom:obs_text']).toBe('pantalla');
  expect(reused.definitions.filter(field => field.label === 'Obs. interna')).toHaveLength(2);
});

it('separa valores por hoja y omite las excluidas, reutilizando campos compatibles entre hojas', () => {
  const other = { ...plan, name: 'Otra', dataStartRow: 1, headerRow: 0 };
  const excluded = { ...plan, name: 'Excluida', include: false };
  const result = prepareAutomaticImportFields([...rows, { model: 'iPhone 15', _sourceRow: '1', _sourceSheet: 'Otra' }],
    [{ name: 'Stock', rows: grid }, { name: 'Otra', rows: [['iPhone 15', 'Otro dato']] }, { name: 'Excluida', rows: [['Modelo', 'No guardar'], ['iPhone', 'privado']] }], [plan, other, excluded], [], {});
  expect(result.rows[2]['custom:cf_columna_b']).toBe('Otro dato');
  expect(result.rows[0]).not.toHaveProperty('custom:cf_columna_b');
  expect(result.definitions.some(field => field.label === 'No guardar')).toBe(false);
  const shared = prepareAutomaticImportFields([...rows, { ...rows[0], _sourceSheet: 'Otra' }], [{ name: 'Stock', rows: grid }, { name: 'Otra', rows: grid }], [plan, { ...plan, name: 'Otra' }], [], {});
  expect(shared.definitions).toHaveLength(3);
  expect(shared.rows).toHaveLength(2);
  expect(shared.rows[0]).toMatchObject({ 'custom:cf_obs_interna': 'pantalla', quantity: '2', _groupedLines: '2' });
});

it('sin encabezado usa la letra física, también después de Z', () => {
  expect(automaticFieldName({ ...plan, headerRow: 0 }, grid, 1)).toBe('Columna B');
  expect(automaticFieldName(plan, [['', '  ']], 1)).toBe('Columna B');
  expect(automaticFieldName(plan, grid, 26)).toBe('Columna AA');
});

it('no bloquea una importación sin columnas nuevas y no modifica las filas', () => {
  const result = prepareAutomaticImportFields(rows, [{ name: 'Stock', rows: grid.map(row => row.slice(0, 1)) }], [plan], [], {});
  expect(result.rows).toEqual(rows);
  expect(result.definitions).toEqual([]);
});


it('solo agrupa después de considerar columnas nuevas y recalcula al descartarlas', () => {
  const localRows = [{ model: 'iPhone 13', quantity: '2', _sourceRow: '2', _sourceSheet: 'Stock' }, { model: 'iPhone 13', quantity: '3', _sourceRow: '3', _sourceSheet: 'Stock' }];
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Obs'], ['iPhone 13', 'A'], ['iPhone 13', 'B']] }];
  const separate = prepareAutomaticImportFields(localRows, sheets, [plan], [], {});
  expect(separate.rows).toHaveLength(2);
  const grouped = prepareAutomaticImportFields(localRows, sheets, [plan], [], { 'Stock:1': [1] });
  expect(grouped.rows).toHaveLength(1);
  expect(grouped.rows[0]).toMatchObject({ quantity: '5', _groupedLines: '2' });
});
