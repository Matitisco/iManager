import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { EMPTY_COLUMN_FILTERS, columnFilterActive, columnFilterKey, compareInventoryColor, inventoryColorOptions, inventoryConditionOptions, matchesInventoryColor, matchesInventoryColumns, matchesInventoryCondition, matchesInventoryStatuses, searchInventoryColors, type InventoryColumnFilters } from './inventory-filters';

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
  it('searches compound and historical colors without changing their exact filter values', () => {
    const colors = inventoryColorOptions(['Azul océano', 'AZUL OCEANO', 'Azul / Plata', 'Negro', 'Azul océano']);
    expect(searchInventoryColors(colors, '  OCEANO ')).toEqual(['Azul océano', 'AZUL OCEANO']);
    expect(searchInventoryColors(colors, '/ plata')).toEqual(['Azul / Plata']);
    expect(searchInventoryColors(colors, 'inexistente')).toEqual([]);
    expect(searchInventoryColors(colors, '  ')).toEqual(colors);
    expect(matchesInventoryColor('AZUL OCEANO', ['Azul océano'])).toBe(false);
  });
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
    expect(matchesInventoryColumns(product({ needsCompletion: true }), filters({ needsCompletion: true }))).toBe(true);
    expect(matchesInventoryColumns(product(), filters({ needsCompletion: true }))).toBe(false);
    expect(columnFilterActive(filters({ needsCompletion: true }), 'statuses')).toBe(true);
    expect(matchesInventoryColumns(available, filters({ statuses: ['RESERVADO'], conditions: ['Usado'] }))).toBe(false);
    expect(columnFilterActive(filters({ statuses: ['RESERVADO'] }), 'statuses')).toBe(true);
    expect(columnFilterActive(EMPTY_COLUMN_FILTERS, 'statuses')).toBe(false);
    expect(columnFilterKey(filters({ statuses: ['RESERVADO', 'DISPONIBLE'] }))).toBe(columnFilterKey(filters({ statuses: ['DISPONIBLE', 'RESERVADO'] })));
  });

  it('keeps the condition catalog when nothing is in stock and appends values that exist', () => {
    expect(inventoryConditionOptions([], []).map((option) => option.label)).toEqual(['Nuevo', 'Usado']);
    expect(inventoryConditionOptions(
      [{ id: 'NUEVO', label: 'Sellado' }, { id: 'OUTLET', label: 'Outlet' }],
      ['PRE-OWNED', 'NUEVO', '', 'Outlet'],
    )).toEqual([
      { id: 'NUEVO', label: 'Sellado' },
      { id: 'USADO', label: 'Usado' },
      { id: 'OUTLET', label: 'Outlet' },
      { id: 'PRE-OWNED', label: 'Pre-owned' },
    ]);
  });

  it('matches a condition by enum or label and keeps several selections', () => {
    expect(matchesInventoryCondition('USADO', [])).toBe(true);
    expect(matchesInventoryCondition('USADO', ['Usado'])).toBe(true);
    expect(matchesInventoryCondition('USADO', ['NUEVO'])).toBe(false);
    expect(matchesInventoryCondition('Nuevo', ['NUEVO', 'USADO'])).toBe(true);
    expect(matchesInventoryCondition('PRE-OWNED', ['Pre-owned'])).toBe(true);
    expect(matchesInventoryCondition('Outlet', ['OUTLET'])).toBe(true);
    expect(matchesInventoryCondition('', ['NUEVO'])).toBe(false);
    expect(matchesInventoryColumns(product({ condition: 'NUEVO' }), filters({ conditions: ['NUEVO', 'USADO'] }))).toBe(true);
    expect(matchesInventoryColumns(product({ condition: 'USADO' }), filters({ conditions: ['NUEVO'] }))).toBe(false);
    expect(matchesInventoryColumns(product({ condition: 'PRE-OWNED' }), filters({ conditions: ['USADO', 'PRE-OWNED'] }))).toBe(true);
  });

  it('lists stored colors and keeps every selected color', () => {
    expect(inventoryColorOptions([' Negro ', '', 'Azul', 'Negro', 'ámbar'])).toEqual(['ámbar', 'Azul', 'Negro']);
    expect(matchesInventoryColor('Azul', [])).toBe(true);
    expect(matchesInventoryColor('  Azul ', ['Azul'])).toBe(true);
    expect(matchesInventoryColor('', ['Azul'])).toBe(false);
    expect(matchesInventoryColumns(product(), filters({ colors: ['Azul', 'Negro'] }))).toBe(true);
    expect(matchesInventoryColumns(product({ color: 'Verde' }), filters({ colors: ['Azul', 'Negro'] }))).toBe(false);
    expect(matchesInventoryColumns(product({ color: '' }), filters({ colors: ['Azul'] }))).toBe(false);
    expect(matchesInventoryColumns(product({ color: '' }), EMPTY_COLUMN_FILTERS)).toBe(true);
    expect(columnFilterActive(filters({ colors: ['Azul'] }), 'colors')).toBe(true);
    expect(columnFilterActive(EMPTY_COLUMN_FILTERS, 'colors')).toBe(false);
    expect(columnFilterKey(filters({ colors: ['Negro', 'Azul'] }))).toBe(columnFilterKey(filters({ colors: ['Azul', 'Negro'] })));
    expect(compareInventoryColor('Negro', 'Azul', 'asc')).toBeGreaterThan(0);
    expect(compareInventoryColor('Negro', 'Azul', 'desc')).toBeLessThan(0);
    expect(compareInventoryColor('', 'Azul', 'asc')).toBeGreaterThan(0);
    expect(compareInventoryColor('', 'Azul', 'desc')).toBeGreaterThan(0);
  });
});

it('filtra proveedor por identidad junto con los demás criterios e incluye su estado en la clave', () => {
  const selected = filters({ supplierId: 's1', conditions: ['Usado'], statuses: ['DISPONIBLE'], colors: ['Azul'], battery: '80', priceMax: '150000', equipo: 'Pixel' });
  expect(matchesInventoryColumns(product({ supplierId: 's1' }), selected)).toBe(true);
  expect(matchesInventoryColumns(product({ supplierId: 's2', supplierName: 'Mismo nombre' }), selected)).toBe(false);
  expect(matchesInventoryColumns(product(), selected)).toBe(false);
  expect(matchesInventoryColumns(product({ supplierId: 's1', status: 'VENDIDO' }), selected)).toBe(false);
  expect(matchesInventoryColumns(product({ supplierId: 's1', condition: 'NUEVO' }), selected)).toBe(false);
  expect(matchesInventoryColumns(product(), EMPTY_COLUMN_FILTERS)).toBe(true);
  expect(columnFilterActive(selected, 'supplierId')).toBe(true);
  expect(columnFilterActive(EMPTY_COLUMN_FILTERS, 'supplierId')).toBe(false);
  expect(columnFilterKey(selected)).not.toBe(columnFilterKey({ ...selected, supplierId: 's2' }));
});

it('filtra precio a definir sin confundir null con cero ni un rango de precios', () => {
  expect(matchesInventoryColumns(product({ price: null }), filters({ priceToDefine: true }))).toBe(true);
  expect(matchesInventoryColumns(product({ price: 0 }), filters({ priceToDefine: true }))).toBe(false);
  expect(matchesInventoryColumns(product({ price: null }), filters({ priceMax: '500' }))).toBe(false);
  expect(columnFilterActive(filters({ priceToDefine: true }), 'priceMin')).toBe(true);
  expect(columnFilterKey(filters({ priceToDefine: true }))).not.toBe(columnFilterKey(filters()));
});
