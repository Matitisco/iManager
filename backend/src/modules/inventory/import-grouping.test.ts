import { expect, it } from 'vitest';
import { INVENTORY_DUPLICATE_FIELDS, inventoryDuplicateKey } from './duplicate-key.js';
import { groupInventoryPreviewRows, inventoryImportGroups } from './import-grouping.js';

const row = { model: 'iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A',
  batteryHealth: '90%', batteryNote: 'Original', cost: 300, price: 450, currency: 'USD',
  entryDate: '01/10/2026', status: 'DISPONIBLE', supplierName: 'Proveedor', customFields: { nested: { a: 1, b: 2 } } };

it('suma cantidades y usa uno si falta, sin mutar entradas ni perder unidades', () => {
  const rows = [{ ...row, quantity: 2 }, { ...row, quantity: 3 }, row];
  const before = structuredClone(rows);
  const groups = inventoryImportGroups(rows, 'ARS');
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ quantity: 6, indices: [0, 1, 2] });
  expect(groups.reduce((sum, group) => sum + group.quantity, 0)).toBe(6);
  expect(rows).toEqual(before);
});

it.each([
  ['model', 'iPhone 14'], ['capacity', '256GB'], ['color', 'negro'], ['condition', 'NUEVO'], ['grade', 'B'],
  ['cost', 300.001], ['batteryHealth', '89%'], ['batteryNote', 'Otra nota'], ['cost', 301], ['price', 451], ['currency', 'ARS'],
  ['status', 'EN_REVISION'], ['supplierName', 'Otro'], ['entryDate', '02/10/2026'],
  ['customFields', { nested: { a: 2, b: 2 } }], ['purchaseName', 'Otra compra'], ['purchasedAt', '02/10/2026'],
])('no agrupa cuando difiere %s', (field, value) => {
  expect(inventoryImportGroups([row, { ...row, [field]: value }], 'USD')).toHaveLength(2);
});

it('compara JSON por contenido, sin depender del orden de claves', () => {
  expect(inventoryImportGroups([row, { ...row, customFields: { nested: { b: 2, a: 1 } } }], 'USD')).toHaveLength(1);
});

it('conserva todas las filas identificadas, incluso IMEI repetido o reparado', () => {
  const identified = { ...row, imei: '990000000000038' };
  expect(inventoryImportGroups([identified, identified, { ...row, imei: '990000000001109' }], 'USD'))
    .toMatchObject([{ quantity: 1, indices: [0] }, { quantity: 1, indices: [1] }, { quantity: 1, indices: [2] }]);
  const repaired = { ...row, batteryNote: 'IMEI duplicado en el archivo: 990000000000038' };
  expect(inventoryImportGroups([repaired, repaired], 'USD')).toHaveLength(2);
});

it('no oculta cantidades inválidas ni multiplica filas marcadas como total', () => {
  for (const quantity of [0, -1, 1.5, NaN]) {
    expect(inventoryImportGroups([{ ...row, quantity }, row], 'USD')).toHaveLength(2);
  }
  const total = { ...row, quantity: 1, batteryNote: 'Parece una fila de total' };
  expect(inventoryImportGroups([total, total], 'USD')).toHaveLength(2);
});

it('preview conserva procedencia, suma cantidades e informa líneas agrupadas', () => {
  const base = { model: 'iPhone 13', price: '450', 'custom:nota': 'sin uso', _sourceSheet: 'Stock' };
  const groups = groupInventoryPreviewRows([{ ...base, quantity: '2', _sourceRow: '2' }, { ...base, quantity: '3', _sourceRow: '3' }], 'USD');
  expect(groups).toEqual([{ row: { ...base, quantity: '5', _sourceRow: '2', _groupedLines: '2' }, indices: [0, 1] }]);
});

it.each(INVENTORY_DUPLICATE_FIELDS)('la clave administrativa conserva el campo estricto %s', field => {
  expect(inventoryDuplicateKey({ [field]: 'a' })).not.toBe(inventoryDuplicateKey({ [field]: 'b' }));
});
