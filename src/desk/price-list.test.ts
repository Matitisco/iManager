import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { priceListMessage } from './price-list';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    imei: '111',
    model: 'iPhone 15',
    capacity: '128 GB',
    color: 'Negro',
    condition: 'NUEVO',
    grade: '',
    batteryHealth: '100',
    cost: 800000,
    price: 1250000,
    status: 'DISPONIBLE',
    ...overrides,
  };
}

describe('priceListMessage', () => {
  it('builds a client-ready list with the store name and skips internal fields', () => {
    const message = priceListMessage([
      product(),
      product({
        id: '2',
        model: 'iPhone 13',
        color: 'Azul',
        condition: 'USADO',
        grade: 'A',
        batteryHealth: '87',
        price: 690000,
        cost: 400000,
        imei: '999',
      }),
    ], '  Tienda Centro  ');

    expect(message).toBe([
      'Lista de precios — Tienda Centro',
      '',
      '• iPhone 15 · 128 GB — Negro · Nuevo — $ 1.250.000',
      '• iPhone 13 · 128 GB — Azul · Usado · Grado A · Batería 87% — $ 690.000',
    ].join('\n'));
    expect(message).not.toContain('800');
    expect(message).not.toContain('999');
  });

  it('keeps a battery range and omits the store name when it is blank', () => {
    const message = priceListMessage([
      product({ condition: 'USADO', batteryHealth: '83-85%', grade: 'N/A', color: '' }),
    ], '   ');

    expect(message).toBe([
      'Lista de precios',
      '',
      '• iPhone 15 · 128 GB — Usado · Batería 83-85% — $ 1.250.000',
    ].join('\n'));
  });

  it('says the list is empty', () => {
    expect(priceListMessage([])).toBe('Lista de precios\n\nNo hay equipos para mostrar.');
  });
});
