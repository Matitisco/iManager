import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { EMPTY_COLUMN_FILTERS, matchesInventoryColumns, type InventoryColumnFilters } from './inventory-filters';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    imei: '100000000000001',
    model: 'Pixel',
    capacity: '128 GB',
    color: 'Azul',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '83-85%',
    cost: 10,
    price: 150000,
    status: 'DISPONIBLE',
    ...overrides,
  };
}

function filters(overrides: Partial<InventoryColumnFilters> = {}): InventoryColumnFilters {
  return { ...EMPTY_COLUMN_FILTERS, ...overrides };
}

describe('inventory column filters', () => {
  it('matches the visible equipment text, condition label, battery floor and price range together', () => {
    const item = product();
    expect(matchesInventoryColumns(item, EMPTY_COLUMN_FILTERS)).toBe(true);
    expect(matchesInventoryColumns(item, filters({ equipo: 'pix' }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ equipo: 'negro' }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ conditions: ['Usado · Grado A'] }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ conditions: ['Nuevo'] }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ battery: '80' }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ battery: '90' }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ priceMin: '100.000', priceMax: '200000' }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ priceMin: '200000' }))).toBe(false);
    expect(matchesInventoryColumns(product({ batteryHealth: '' }), filters({ battery: '70' }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({
      equipo: 'azul',
      conditions: ['Usado · Grado A'],
      battery: '80',
      priceMax: '150000',
    }))).toBe(true);
  });
});
