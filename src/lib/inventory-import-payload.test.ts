import { expect, it } from 'vitest';
import { inventoryImportPayload } from './inventory-import-payload';

it('preserves UI payload semantics for physical rows, quantities, money and explicit custom fields', () => {
  const rows = inventoryImportPayload([
    { _sourceRow: '12', model: 'iPhone 13', quantity: '2', price: '1.250,50', cost: '900,25', currency: 'USD', serial: 'SERIAL', originalStatus: 'Reservado', 'custom:quality': 'A' },
    { model: 'iPhone 14', quantity: '3', currency: 'EUR', price: '', cost: 'a definir' },
    { model: 'iPhone 15', quantity: '', price: 'a definir', cost: '', batteryHealth: '90%' },
  ]);
  expect(rows[0]).toMatchObject({ sourceRow: 12, quantity: 2, price: 1250.5, cost: 900.25, currency: 'USD', imei: '', customFields: { serial: 'SERIAL', originalStatus: 'Reservado', quality: 'A' } });
  expect(rows[0].batteryHealth).toBeUndefined();
  expect(rows[1]).toMatchObject({ quantity: 3, price: null, cost: 'a definir', batteryHealth: 'N/A', customFields: {} });
  expect(rows[1].currency).toBeUndefined();
  expect(rows[2]).toMatchObject({ quantity: 1, price: 'a definir', cost: '', batteryHealth: '90%' });
});
