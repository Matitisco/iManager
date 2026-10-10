import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { EMPTY_COLUMN_FILTERS, columnFilterActive, columnFilterKey, matchesInventoryColumns, matchesInventoryStatuses, type InventoryColumnFilters } from './inventory-filters';

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
    expect(matchesInventoryColumns(item, filters({ conditions: ['Usado'] }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ conditions: ['Nuevo'] }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ qualities: ['A'] }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ qualities: ['A+'] }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ qualities: ['A', 'B'] }))).toBe(true);
    expect(matchesInventoryColumns(product({ condition: 'NUEVO', grade: 'A' }), filters({ qualities: ['A'] }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ battery: '80' }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ battery: '90' }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({ priceMin: '100.000', priceMax: '200000' }))).toBe(true);
    expect(matchesInventoryColumns(item, filters({ priceMin: '200000' }))).toBe(false);
    expect(matchesInventoryColumns(product({ batteryHealth: '' }), filters({ battery: '70' }))).toBe(false);
    expect(matchesInventoryColumns(item, filters({
      equipo: 'azul',
      conditions: ['Usado'],
      qualities: ['A'],
      battery: '80',
      priceMax: '150000',
    }))).toBe(true);
  });

  it('keeps every selected status and treats an empty selection as all statuses', () => {
    const available = product({ status: 'DISPONIBLE' });
    const blank = product({ status: '' });
    const reserved = product({ status: 'RESERVADO' });
    const sold = product({ status: 'VENDIDO' });
    const review = product({ status: 'EN_REVISION' });

    expect(matchesInventoryStatuses(available.status, [])).toBe(true);
    expect(matchesInventoryStatuses(sold.status, [])).toBe(true);
    expect(matchesInventoryColumns(available, filters({ statuses: ['DISPONIBLE', 'RESERVADO'] }))).toBe(true);
    expect(matchesInventoryColumns(blank, filters({ statuses: ['DISPONIBLE'] }))).toBe(true);
    expect(matchesInventoryColumns(reserved, filters({ statuses: ['DISPONIBLE', 'RESERVADO'] }))).toBe(true);
    expect(matchesInventoryColumns(sold, filters({ statuses: ['DISPONIBLE', 'RESERVADO'] }))).toBe(false);
    expect(matchesInventoryColumns(review, filters({ statuses: ['EN_REVISION'] }))).toBe(true);
    expect(matchesInventoryColumns(available, filters({ statuses: ['RESERVADO'], conditions: ['Usado'] }))).toBe(false);
    expect(columnFilterActive(filters({ statuses: ['RESERVADO'] }), 'statuses')).toBe(true);
    expect(columnFilterActive(EMPTY_COLUMN_FILTERS, 'statuses')).toBe(false);
    expect(columnFilterKey(filters({ statuses: ['RESERVADO', 'DISPONIBLE'] }))).toBe(columnFilterKey(filters({ statuses: ['DISPONIBLE', 'RESERVADO'] })));
  });
});
