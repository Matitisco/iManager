import { describe, expect, it } from 'vitest';
import { expandTextRows, textRowError } from './text-import-review';
const row = { model: 'iPhone 13', price: '420', currency: 'USD', condition: 'USADO', quantity: '3', imei: '' };
describe('text import review validation', () => {
  it('expands only reviewed quantities and preserves currency', () => {
    expect(expandTextRows([row])).toEqual(Array(3).fill({ ...row, cost: '' }));
    expect(expandTextRows([row])[0]).not.toBe(expandTextRows([row])[1]);
  });
  it.each([{ ...row, quantity: '0' }, { ...row, quantity: '1.5' }, { ...row, price: '-1' }, { ...row, cost: 'bad' }, { ...row, model: '' }, { ...row, currency: 'EUR' }, { ...row, imei: '350000000000001' }, { ...row, serial: 'ABCD' }])('rejects invalid/unreviewed values %s', (bad) => {
    expect(textRowError(bad)).toBeTruthy();
    expect(() => expandTextRows([bad])).toThrow();
  });
  it('allows explicit zero price, quantity one with IMEI and bounds expansion', () => {
    expect(textRowError({ ...row, price: '0', quantity: '1', imei: '350000000000001' })).toBeNull();
    expect(() => expandTextRows(Array(21).fill({ ...row, quantity: '100' }))).toThrow('2000');
  });
});

it('accepts Argentine amounts entered from mobile keyboards', () => {
  const rows = expandTextRows([{ ...row, price: '420,50', cost: '1.200,25', quantity: '1' }]);
  expect(rows[0]).toMatchObject({ price: '420.5', cost: '1200.25' });
});

it('permite precio a definir sin convertir la ausencia a cero', () => {
  expect(textRowError({ ...row, price: '' })).toBeNull();
  expect(expandTextRows([{ ...row, price: '' }])[0].price).toBe('');
});
