import { describe, expect, it } from 'vitest';
import { prepareTextRows, textRowError } from './text-import-review';
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
