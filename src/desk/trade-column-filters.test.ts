import { describe, expect, it } from 'vitest';
import type { TradeIn } from '../types';
import { EMPTY_TRADE_FILTERS, matchesTradeColumns, tradeColumnActive, tradeFiltersActive, type TradeColumnFilters } from './trade-column-filters';

function trade(overrides: Partial<TradeIn> = {}): TradeIn {
  return {
    id: '1',
    tradeNumber: 12,
    date: '2026-10-08',
    clientId: 'c1',
    deviceReceived: 'iPhone 11 64GB',
    deviceReceivedImei: '353456789012345',
    deviceGiven: 'iPhone 13 128GB',
    takeValue: 300000,
    differencePaid: 350000,
    status: 'APROBADO',
    ...overrides,
  };
}

function filters(overrides: Partial<TradeColumnFilters> = {}): TradeColumnFilters {
  return { ...EMPTY_TRADE_FILTERS, ...overrides };
}

const labels = { code: 'C-0012', client: 'Ana Pérez' };

describe('trade column filters', () => {
  it('combines every column and reports which ones are active', () => {
    const row = trade();
    expect(matchesTradeColumns(row, EMPTY_TRADE_FILTERS, labels)).toBe(true);
    expect(tradeFiltersActive(EMPTY_TRADE_FILTERS)).toBe(false);
    expect(matchesTradeColumns(row, filters({
      code: '0012',
      dateFrom: '01/10/2026',
      dateTo: '09/10/2026',
      client: 'ana',
      received: '353456',
      given: 'iphone 13',
      valueMin: '200000',
      valueMax: '400000',
      differenceMin: '300000',
      differenceMax: '400000',
    }), labels)).toBe(true);
    expect(matchesTradeColumns(row, filters({ client: 'juan' }), labels)).toBe(false);
    expect(matchesTradeColumns(row, filters({ code: 'c-0001' }), labels)).toBe(false);
    expect(matchesTradeColumns(row, filters({ received: 'galaxy' }), labels)).toBe(false);
    expect(matchesTradeColumns(row, filters({ given: 'pixel' }), labels)).toBe(false);
    expect(matchesTradeColumns(row, filters({ valueMin: '500000' }), labels)).toBe(false);
    expect(matchesTradeColumns(row, filters({ differenceMax: '1000' }), labels)).toBe(false);
    expect(matchesTradeColumns(row, filters({ dateFrom: '10/10/2026' }), labels)).toBe(false);
    expect(matchesTradeColumns(trade({ date: '' }), filters({ dateTo: '09/10/2026' }), labels)).toBe(false);
    expect(matchesTradeColumns(trade({ differencePaid: -500 }), EMPTY_TRADE_FILTERS, labels)).toBe(true);
    expect(tradeFiltersActive(filters({ given: '13' }))).toBe(true);
    expect(tradeColumnActive(filters({ differenceMin: '1' }), 'value')).toBe(true);
    expect(tradeColumnActive(filters({ differenceMin: '1' }), 'client')).toBe(false);
  });
});
