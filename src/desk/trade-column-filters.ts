import type { TradeIn } from '../types';
import { includesText, matchesDateRange, matchesMoney } from './column-filters';

export type TradeColumnFilters = {
  code: string;
  dateFrom: string;
  dateTo: string;
  client: string;
  received: string;
  given: string;
  valueMin: string;
  valueMax: string;
  differenceMin: string;
  differenceMax: string;
};

export const EMPTY_TRADE_FILTERS: TradeColumnFilters = {
  code: '',
  dateFrom: '',
  dateTo: '',
  client: '',
  received: '',
  given: '',
  valueMin: '',
  valueMax: '',
  differenceMin: '',
  differenceMax: '',
};

export function tradeFilterKey(filters: TradeColumnFilters) {
  return [
    filters.code.trim().toLowerCase(),
    filters.dateFrom.trim(),
    filters.dateTo.trim(),
    filters.client.trim().toLowerCase(),
    filters.received.trim().toLowerCase(),
    filters.given.trim().toLowerCase(),
    filters.valueMin.trim(),
    filters.valueMax.trim(),
    filters.differenceMin.trim(),
    filters.differenceMax.trim(),
  ].join('~');
}

export function tradeFiltersActive(filters: TradeColumnFilters) {
  return tradeFilterKey(filters) !== tradeFilterKey(EMPTY_TRADE_FILTERS);
}

export function tradeColumnActive(filters: TradeColumnFilters, column: 'code' | 'date' | 'client' | 'received' | 'given' | 'value') {
  if (column === 'code') return filters.code.trim() !== '';
  if (column === 'date') return filters.dateFrom.trim() !== '' || filters.dateTo.trim() !== '';
  if (column === 'client') return filters.client.trim() !== '';
  if (column === 'received') return filters.received.trim() !== '';
  if (column === 'given') return filters.given.trim() !== '';
  return filters.valueMin.trim() !== '' || filters.valueMax.trim() !== '' || filters.differenceMin.trim() !== '' || filters.differenceMax.trim() !== '';
}

export function matchesTradeColumns(
  trade: TradeIn,
  filters: TradeColumnFilters,
  labels: { code: string; client: string },
) {
  if (!includesText(labels.code, filters.code)) return false;
  if (!matchesDateRange(trade.date, filters.dateFrom, filters.dateTo)) return false;
  if (!includesText(labels.client, filters.client)) return false;
  if (!includesText(`${trade.deviceReceived} ${trade.deviceReceivedImei}`, filters.received)) return false;
  if (!includesText(trade.deviceGiven, filters.given)) return false;
  if (!matchesMoney(trade.takeValue, filters.valueMin, filters.valueMax)) return false;
  if (!matchesMoney(trade.differencePaid, filters.differenceMin, filters.differenceMax)) return false;
  return true;
}
