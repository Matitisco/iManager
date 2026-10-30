import { describe, expect, it } from 'vitest';
import { groupTextReviewRows, prepareTextRows, textRowError } from './text-import-review';
const row = { model: 'iPhone 13', price: '420', currency: 'USD', condition: 'USADO', quantity: '3', imei: '' };
describe('text import review validation', () => {
  it('conserva una fila con cantidad y moneda', () => {
    expect(prepareTextRows([row])).toEqual([{ ...row, quantity: '3', cost: '' }]);

  });
  it('permite cantidades mayores a 100 sin multiplicarlas dos veces', () => {
    expect(textRowError({ ...row, quantity: '1001' })).toBeNull();
    const expanded = prepareTextRows([{ ...row, quantity: '1001' }]);
    expect(expanded).toHaveLength(1);
    expect(expanded.every(item => item.quantity === '1001')).toBe(true);
  });
  it.each([{ ...row, quantity: '0' }, { ...row, quantity: '1.5' }, { ...row, price: '-1' }, { ...row, cost: 'bad' }, { ...row, model: '' }, { ...row, currency: 'EUR' }, { ...row, imei: '350000000000001' }, { ...row, serial: 'ABCD' }])('rejects invalid/unreviewed values %s', (bad) => {
    expect(textRowError(bad)).toBeTruthy();
    expect(() => prepareTextRows([bad])).toThrow();
  });
  it('allows explicit zero price, quantity one with IMEI and bounds expansion', () => {
    expect(textRowError({ ...row, price: '0', quantity: '1', imei: '350000000000001' })).toBeNull();
    expect(() => prepareTextRows(Array(21).fill({ ...row, quantity: '100' }))).toThrow('2000');
  });
});

it('accepts Argentine amounts entered from mobile keyboards', () => {
  const rows = prepareTextRows([{ ...row, price: '420,50', cost: '1.200,25', quantity: '1' }]);
  expect(rows[0]).toMatchObject({ price: '420.5', cost: '1200.25' });
});

it('permite precio a definir sin convertir la ausencia a cero', () => {
  expect(textRowError({ ...row, price: '' })).toBeNull();
  expect(prepareTextRows([{ ...row, price: '' }])[0].price).toBe('');
});


it('agrupa cantidades repetidas tras editar y conserva variantes e IMEI', () => {
  const base = { ...row, quantity: '1' };
  const result = prepareTextRows([{ ...base, quantity: '2' }, { ...base, quantity: '3' }, { ...base, color: 'Rojo' }, { ...base, imei: '990000000000038' }]);
  expect(result).toHaveLength(3);
  expect(result[0]).toMatchObject({ quantity: '5', _groupedLines: '2' });
  expect(result[1]).toMatchObject({ quantity: '1', color: 'Rojo' });
  expect(result[2]).toMatchObject({ quantity: '1', imei: '990000000000038' });
});


it('realinea dudas y exclusiones al unir filas después de editar', () => {
  const result = groupTextReviewRows([{ ...row, quantity: '2' }, { ...row, quantity: '3' }, { ...row, quantity: '1' }],
    [1, 2, 3].map(line => ({ line, original: `Línea ${line}`, dudas: [`Duda ${line}`] })), 'USD', new Set([2]));
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0].quantity).toBe('5');
  expect(result.review[0]).toEqual({ line: 1, original: 'Línea 1\nLínea 2', dudas: ['Duda 1', 'Duda 2'] });
  expect(result.excluded).toEqual(new Set([1]));
});
