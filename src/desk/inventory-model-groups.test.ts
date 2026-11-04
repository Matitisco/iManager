import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import {
  EMPTY_COLUMN_FILTERS,
  matchesInventoryColumns,
} from './inventory-filters';
import {
  compareInventoryLine,
  groupInventoryModels,
  parseInventoryModel,
  summarizeGroupMoney,
} from './inventory-model-groups';

const item = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  imei: id.padEnd(15, '0'),
  model: 'iPhone 15',
  capacity: '128 GB',
  color: 'Negro',
  condition: 'NUEVO',
  grade: '',
  batteryHealth: '100%',
  cost: 100,
  price: 200,
  currency: 'USD',
  status: 'DISPONIBLE',
  ...overrides,
});

describe('orden por línea', () => {
  it('parsea marca, generación y variante sin confundir Pro con Pro Max', () => {
    expect(parseInventoryModel(' Apple iPhone 14 Pro Max ')).toMatchObject({
      brand: 'Apple',
      generation: 14,
      variant: 'promax',
      rank: 3,
    });
    expect(parseInventoryModel('Samsung Galaxy S24')).toMatchObject({
      brand: 'samsung',
      recognized: true,
      generation: null,
    });
    expect(parseInventoryModel('Sin identificar')).toMatchObject({
      recognized: false,
      generation: null,
    });
  });

  it('ordena generación, variantes y capacidad, luego marcas y desconocidos con números naturales', () => {
    const models = [
      'Desconocido 10',
      'Samsung Galaxy S24',
      'iPhone 14 Pro Max',
      'iPhone 13 Pro',
      'iPhone 14 Plus',
      'iPhone 14',
      'iPhone 14 Pro',
      'iPhone 13 Pro Max',
      'iPhone 13',
      'Samsung Galaxy S9',
      'Motorola Moto G9',
      'Desconocido 2',
      'iPhone 15',
    ];
    expect(
      models
        .map((model) => item(model, { model }))
        .sort(compareInventoryLine)
        .map((row) => row.model),
    ).toEqual([
      'iPhone 13',
      'iPhone 13 Pro',
      'iPhone 13 Pro Max',
      'iPhone 14',
      'iPhone 14 Plus',
      'iPhone 14 Pro',
      'iPhone 14 Pro Max',
      'iPhone 15',
      'Motorola Moto G9',
      'Samsung Galaxy S9',
      'Samsung Galaxy S24',
      'Desconocido 2',
      'Desconocido 10',
    ]);
    const capacities = [
      '1 TB',
      '512 GB',
      '128GB',
      '256 GB',
      '',
      '2 TB',
      '64 GB',
    ];
    expect(
      capacities
        .map((capacity) => item(capacity, { capacity }))
        .sort(compareInventoryLine)
        .map((row) => row.capacity),
    ).toEqual(['64 GB', '128GB', '256 GB', '512 GB', '1 TB', '2 TB', '']);
    expect(
      ['Pro Max', 'Pro', 'Mini', '', 'Plus']
        .map((variant) =>
          item(variant, { model: `iPhone 13 ${variant}`.trim() }),
        )
        .sort(compareInventoryLine)
        .map((row) => row.model),
    ).toEqual([
      'iPhone 13',
      'iPhone 13 Mini',
      'iPhone 13 Plus',
      'iPhone 13 Pro',
      'iPhone 13 Pro Max',
    ]);
  });
});

describe('agrupación después de filtros', () => {
  it('agrupa solo modelo y capacidad, suma cantidad sin convertir cero en uno y deduplica colores', () => {
    const rows = [
      item('1', { cantidad: 3, imei: '' }),
      item('2', {
        model: ' apple IPHONE15 ',
        capacity: '128GB',
        color: ' negro ',
        condition: 'USADO',
        status: 'RESERVADO',
      }),
      item('3', { color: 'Azul', status: 'VENDIDO', cantidad: 0 }),
      item('4', { capacity: '256 GB' }),
    ];
    const groups = groupInventoryModels(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      units: 4,
      available: 3,
      colors: ['Negro', 'Azul'],
    });
    expect(groups[0].items).toHaveLength(3);
    expect(rows[1].color).toBe(' negro ');
  });

  it('usa exclusivamente los registros filtrados por estado, proveedor, búsqueda y archivados', () => {
    const rows = [
      item('1', { supplierId: 'a', cantidad: 4 }),
      item('2', { supplierId: 'b' }),
      item('3', { supplierId: 'a', status: 'RESERVADO' }),
      item('4', { supplierId: 'a', archivedAt: '2026-11-01' }),
      item('5', { model: 'Samsung S24', supplierId: 'a' }),
    ];
    const filters = {
      ...EMPTY_COLUMN_FILTERS,
      statuses: ['DISPONIBLE'],
      supplierId: 'a',
    };
    const filtered = rows.filter(
      (row) =>
        !row.archivedAt &&
        row.model.includes('iPhone') &&
        matchesInventoryColumns(row, filters),
    );
    expect(groupInventoryModels(filtered)[0]).toMatchObject({
      units: 4,
      available: 4,
    });
    expect(
      groupInventoryModels(rows.filter((row) => row.archivedAt))[0],
    ).toMatchObject({ units: 1, available: 0 });
    expect(groupInventoryModels([])).toEqual([]);
  });

  it('excluye accesorios cuando el dato opcional kind está presente', () => {
    const accessory = { ...item('a'), kind: 'ACCESSORY' };
    expect(groupInventoryModels([accessory, item('b')])[0].units).toBe(1);
  });
});

describe('resúmenes de importes de presentación', () => {
  it('ignora precios pendientes, incluye cero y muestra extremos o un único precio', () => {
    expect(
      summarizeGroupMoney(
        [
          item('1', { price: null }),
          item('2', { price: 300.25 }),
          item('3', { price: 250.75 }),
        ],
        'price',
        'USD',
        null,
      ),
    ).toMatchObject({ min: 250.75, max: 300.25 });
    expect(
      summarizeGroupMoney([item('1'), item('2')], 'price', 'USD', null),
    ).toMatchObject({ min: 200, max: 200 });
    expect(
      summarizeGroupMoney([item('1', { price: 0 })], 'price', 'USD', null),
    ).toMatchObject({ min: 0, max: 0 });
    expect(
      summarizeGroupMoney([item('1', { price: null })], 'price', 'USD', null),
    ).toBeNull();
  });

  it('pondera costo por unidades con centavos y excluye costo desconocido', () => {
    expect(
      summarizeGroupMoney(
        [
          item('1', { cost: 100.1, cantidad: 3 }),
          item('2', { cost: 200.2 }),
          item('3', { cost: undefined, cantidad: 10 }),
          item('4', { cost: 999, cantidad: 0 }),
        ],
        'cost',
        'USD',
        null,
      ),
    ).toMatchObject({ average: 125.13 });
    expect(
      summarizeGroupMoney([item('1', { cantidad: 0 })], 'cost', 'USD', null),
    ).toMatchObject({ average: null });
  });

  it('proyecta monedas con el helper existente y no combina monedas sin cotización', () => {
    const mixed = [
      item('1', { price: 1.25 }),
      item('2', { price: 1500, currency: 'ARS' }),
    ];
    expect(summarizeGroupMoney(mixed, 'price', 'ARS', 1000)).toMatchObject({
      min: 1250,
      max: 1500,
      currency: 'ARS',
      blocked: false,
    });
    expect(summarizeGroupMoney(mixed, 'price', 'ARS', null)).toEqual({
      blocked: true,
    });
    expect(
      summarizeGroupMoney([item('1', { price: 1.25 })], 'price', 'ARS', null),
    ).toMatchObject({ min: 1.25, currency: 'USD', blocked: false });
  });
});
