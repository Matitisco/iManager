import { describe, expect, it } from 'vitest';
import type { Sale } from '../types';
import { EMPTY_SALE_FILTERS, matchesSaleColumns, saleColumnActive, saleFiltersActive, type SaleColumnFilters } from './sale-column-filters';

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: '1',
    saleNumber: 1,
    date: '2026-10-01',
    clientId: 'c1',
    productId: '',
    deviceLabel: 'Pixel 8',
    amount: 150000,
    paymentMethod: 'TRANSFERENCIA',
    status: 'COMPLETADA',
    ...overrides,
  };
}

function filters(overrides: Partial<SaleColumnFilters> = {}): SaleColumnFilters {
  return { ...EMPTY_SALE_FILTERS, ...overrides };
}

const labels = { client: 'Ana Pérez', equipment: 'Pixel 8' };

describe('sale column filters', () => {
  it('combines every column and reports which ones are active', () => {
    const row = sale();
    expect(matchesSaleColumns(row, EMPTY_SALE_FILTERS, labels)).toBe(true);
    expect(saleFiltersActive(EMPTY_SALE_FILTERS)).toBe(false);
    expect(matchesSaleColumns(row, filters({ code: 'v-0001', client: 'ana', equipment: 'pix', payments: ['Transferencia'], amountMin: '100000', amountMax: '200000', statuses: ['COMPLETADA'], dateFrom: '01/10/2026', dateTo: '02/10/2026' }), labels)).toBe(true);
    expect(matchesSaleColumns(row, filters({ client: 'juan' }), labels)).toBe(false);
    expect(matchesSaleColumns(row, filters({ payments: ['Efectivo'] }), labels)).toBe(false);
    expect(matchesSaleColumns(row, filters({ statuses: ['CANCELADA'] }), labels)).toBe(false);
    expect(matchesSaleColumns(row, filters({ equipment: 'iphone' }), labels)).toBe(false);
    expect(matchesSaleColumns(row, filters({ sellers: ['none'] }), labels)).toBe(true);
    expect(matchesSaleColumns(sale({ sellerMemberId: 'lucia' }), filters({ sellers: ['lucia'] }), labels)).toBe(true);
    expect(matchesSaleColumns(sale({ sellerMemberId: 'lucia' }), filters({ sellers: ['none'] }), labels)).toBe(false);
    expect(saleFiltersActive(filters({ sellers: ['lucia'] }))).toBe(true);
    expect(saleColumnActive(filters({ sellers: ['lucia'] }), 'sellers')).toBe(true);
    expect(saleFiltersActive(filters({ client: 'ana' }))).toBe(true);
    expect(saleColumnActive(filters({ payments: ['Efectivo'] }), 'payments')).toBe(true);
    expect(saleColumnActive(filters({ payments: ['Efectivo'] }), 'client')).toBe(false);
  });
});


it.each([{ status: 'CANCELADA' }, { voidedAt: '2026-10-22' }, { status: 'CANCELADA', voidedAt: '2026-10-22' }])('matches the unified Anulada filter for %j and excludes active states', patch => {
  const row = sale(patch);
  expect(matchesSaleColumns(row, filters({ statuses: ['ANULADA'] }), labels)).toBe(true);
  expect(matchesSaleColumns(row, filters({ statuses: ['COMPLETADA', 'PENDIENTE'] }), labels)).toBe(false);
});
