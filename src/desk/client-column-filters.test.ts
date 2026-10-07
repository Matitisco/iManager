import { describe, expect, it } from 'vitest';
import type { Client } from '../types';
import { EMPTY_CLIENT_FILTERS, clientColumnActive, clientFiltersActive, matchesClientColumns, type ClientColumnFilters } from './client-column-filters';

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: '1',
    dni: '30111222',
    name: 'Ana Pérez',
    email: 'ana@tienda.com',
    phone: '1122334455',
    lastPurchaseDate: '2026-10-01',
    totalSpent: 200000,
    pendingBalance: 15000,
    tag: 'Mayorista',
    ...overrides,
  };
}

function filters(overrides: Partial<ClientColumnFilters> = {}): ClientColumnFilters {
  return { ...EMPTY_CLIENT_FILTERS, ...overrides };
}

describe('client column filters', () => {
  it('combines name, tag, contact, date and money, and treats N/A as an empty date', () => {
    const row = client();
    expect(matchesClientColumns(row, EMPTY_CLIENT_FILTERS)).toBe(true);
    expect(clientFiltersActive(EMPTY_CLIENT_FILTERS)).toBe(false);
    expect(matchesClientColumns(row, filters({
      name: 'ana',
      tags: ['Mayorista'],
      dni: '3011',
      phone: '2233',
      dateFrom: '01/10/2026',
      dateTo: '07/10/2026',
      spentMin: '100000',
      spentMax: '300000',
      balanceMin: '10000',
      balanceMax: '20000',
    }))).toBe(true);
    expect(matchesClientColumns(row, filters({ tags: ['Minorista'] }))).toBe(false);
    expect(matchesClientColumns(row, filters({ dni: '999' }))).toBe(false);
    expect(matchesClientColumns(client({ lastPurchaseDate: 'N/A' }), filters({ dateFrom: '01/10/2026' }))).toBe(false);
    expect(matchesClientColumns(client({ lastPurchaseDate: 'N/A' }), EMPTY_CLIENT_FILTERS)).toBe(true);
    expect(clientFiltersActive(filters({ tags: ['Mayorista'] }))).toBe(true);
    expect(clientColumnActive(filters({ tags: ['Mayorista'] }), 'name')).toBe(true);
    expect(clientColumnActive(filters({ tags: ['Mayorista'] }), 'dni')).toBe(false);
  });
});
