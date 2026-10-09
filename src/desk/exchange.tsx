import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BLUE_REFRESH_MS,
  exchangeHouseLabel,
  formatClock,
  houseFetchedAt,
  houseFromState,
  isFreshQuote,
  readBlueState,
  refreshExchangeQuote,
  sellDelta,
  type BlueDay,
  type ExchangeSourceId,
} from './blue-rate';
import { formatInputMoney, formatMoney, formatMoneyCompact } from './format';
import {
  FX_WARNING,
  combineAmounts,
  commitAmount,
  commitGroup,
  projectAmount,
  type MoneyCurrency,
  type StoredAmount,
} from './money';

export type ExchangeMode = 'auto' | 'manual';

export type StoreExchange = {
  currency: MoneyCurrency;
  exchangeMode: ExchangeMode;
  exchangeSource: ExchangeSourceId;
  manualBuy: number | null;
  manualSell: number | null;
};

export type QuoteView = { buy: number; sell: number; updatedAt: string };

type Phase = 'ready' | 'loading' | 'error';

export type MoneyApi = {
  active: MoneyCurrency;
  rate: number | null;
  warning: string | null;
  show: (amount: number, currency?: string | null) => string;
  compact: (amount: number, currency?: string | null) => string;
  showActive: (amount: number) => string;
  compactActive: (amount: number) => string;
  number: (amount: number, currency?: string | null) => number | null;
  sum: (rows: Array<{ amount: number; currency?: string | null }>) => number | null;
  inputValue: (amount: number, currency?: string | null) => string;
  commit: (typed: number, original: number, currency?: string | null) => StoredAmount;
  commitGroup: (fields: Array<{ typed: number; original: number; currency?: string | null }>) => { amounts: StoredAmount[]; blocked: boolean };
  label: (name: string) => string;
};

type ExchangeValue = {
  settings: StoreExchange;
  phase: Phase;
  quote: QuoteView | null;
  days: Record<string, BlueDay>;
  delta: number | null;
  label: string;
  title: string;
  refresh: () => void;
  money: MoneyApi;
};

const DEFAULT_SETTINGS: StoreExchange = {
  currency: 'ARS',
  exchangeMode: 'auto',
  exchangeSource: 'blue',
  manualBuy: null,
  manualSell: null,
};

const ExchangeContext = createContext<ExchangeValue | null>(null);

function readCachedQuote(source: ExchangeSourceId) {
  const state = readBlueState();
  const house = houseFromState(state, source);
  const fetchedAt = houseFetchedAt(state, source);
  if (house && fetchedAt) return { ...house, fetchedAt };
  if (source !== 'blue') return null;
  const legacy = state.quotes.dolarapi;
  if (!legacy) return null;
  return {
    quote: { source: 'dolarapi' as const, buy: legacy.buy, sell: legacy.sell, updatedAt: legacy.updatedAt },
    days: state.days.dolarapi ?? {},
    fetchedAt: legacy.fetchedAt,
  };
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function exchangeFromStore(store?: {
  currency?: string | null;
  exchangeMode?: string | null;
  exchangeSource?: string | null;
  manualBuy?: number | null;
  manualSell?: number | null;
} | null): StoreExchange {
  const source = store?.exchangeSource;
  return {
    currency: store?.currency === 'USD' ? 'USD' : 'ARS',
    exchangeMode: store?.exchangeMode === 'manual' ? 'manual' : 'auto',
    exchangeSource: source === 'oficial' || source === 'mep' ? source : 'blue',
    manualBuy: positive(store?.manualBuy),
    manualSell: positive(store?.manualSell),
  };
}

function passthroughMoney(): MoneyApi {
  return {
    active: 'ARS',
    rate: null,
    warning: null,
    show: (amount) => formatMoney(amount),
    compact: (amount) => formatMoneyCompact(amount),
    showActive: (amount) => formatMoney(amount),
    compactActive: (amount) => formatMoneyCompact(amount),
    number: (amount) => amount,
    sum: (rows) => Math.round(rows.reduce((total, row) => total + (Number.isFinite(row.amount) ? row.amount : 0), 0)),
    inputValue: (amount) => formatInputMoney(amount),
    commit: (typed, original, currency) => ({ amount: typed, currency: currency ?? null }),
    commitGroup: (fields) => ({ blocked: false, amounts: fields.map((field) => ({ amount: field.typed, currency: field.currency ?? null })) }),
    label: (name) => name,
  };
}

function buildMoney(active: MoneyCurrency, rate: number | null, warning: string | null): MoneyApi {
  const show = (amount: number, currency?: string | null) => {
    const projected = projectAmount(amount, currency, active, rate);
    return formatMoney(projected.value, projected.currency);
  };
  const compact = (amount: number, currency?: string | null) => {
    const projected = projectAmount(amount, currency, active, rate);
    return formatMoneyCompact(projected.value, projected.currency);
  };
  return {
    active,
    rate,
    warning,
    show,
    compact,
    showActive: (amount) => formatMoney(amount, active),
    compactActive: (amount) => formatMoneyCompact(amount, active),
    number: (amount, currency) => {
      const projected = projectAmount(amount, currency, active, rate);
      return projected.blocked ? null : projected.value;
    },
    sum: (rows) => combineAmounts(rows, active, rate),
    inputValue: (amount, currency) => {
      const projected = projectAmount(amount, currency, active, rate);
      return formatInputMoney(projected.blocked ? amount : projected.value);
    },
    commit: (typed, original, currency) => commitAmount(typed, original, currency, active, rate),
    commitGroup: (fields) => commitGroup(fields, active, rate),
    label: (name) => `${name} · ${active}`,
  };
}

export function ExchangeProvider({ settings = DEFAULT_SETTINGS, children }: { settings?: StoreExchange; children: ReactNode }) {
  const manualQuote = settings.exchangeMode === 'manual' && settings.manualBuy && settings.manualSell
    ? { buy: settings.manualBuy, sell: settings.manualSell, updatedAt: '' }
    : null;
  const cached = settings.exchangeMode === 'auto' ? readCachedQuote(settings.exchangeSource) : null;
  const [quote, setQuote] = useState<QuoteView | null>(manualQuote ?? (cached ? { buy: cached.quote.buy, sell: cached.quote.sell, updatedAt: cached.quote.updatedAt } : null));
  const [days, setDays] = useState<Record<string, BlueDay>>(cached?.days ?? {});
  const [phase, setPhase] = useState<Phase>(settings.exchangeMode === 'manual' ? (manualQuote ? 'ready' : 'error') : (cached ? 'ready' : 'loading'));
  const request = useRef(0);
  const source = settings.exchangeSource;

  const load = useCallback(async (mode: 'silent' | 'visible') => {
    if (settings.exchangeMode !== 'auto') return;
    const id = ++request.current;
    if (mode === 'visible') setPhase('loading');
    try {
      const result = await refreshExchangeQuote(source);
      if (request.current !== id) return;
      setQuote({ buy: result.quote.buy, sell: result.quote.sell, updatedAt: result.quote.updatedAt });
      setDays(result.days);
      setPhase('ready');
    } catch {
      if (request.current !== id) return;
      setPhase('error');
    }
  }, [settings.exchangeMode, source]);

  useEffect(() => {
    if (settings.exchangeMode === 'manual') {
      setQuote(manualQuote);
      setDays({});
      setPhase(manualQuote ? 'ready' : 'error');
      return;
    }
    const snap = readCachedQuote(source);
    const fetchedAt = snap?.fetchedAt ?? null;
    if (snap) {
      setQuote({ buy: snap.quote.buy, sell: snap.quote.sell, updatedAt: snap.quote.updatedAt });
      setDays(snap.days);
      setPhase('ready');
    } else {
      setQuote(null);
      setDays({});
      setPhase('loading');
    }
    if (!fetchedAt || !isFreshQuote(fetchedAt)) void load(snap ? 'silent' : 'visible');
    const timer = window.setInterval(() => { void load('silent'); }, BLUE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [settings.exchangeMode, settings.manualBuy, settings.manualSell, source, load, manualQuote?.buy, manualQuote?.sell]);

  const convertible = phase === 'ready' && quote != null && quote.sell > 0;
  const warning = convertible ? null : (phase === 'loading' ? null : FX_WARNING);
  const money = useMemo(
    () => buildMoney(settings.currency, convertible ? quote!.sell : null, warning),
    [settings.currency, convertible, quote, warning],
  );
  const value = useMemo<ExchangeValue>(() => ({
    settings,
    phase,
    quote,
    days,
    delta: quote ? sellDelta(quote.sell, days) : null,
    label: settings.exchangeMode === 'manual' ? 'Manual' : `DolarApi · ${exchangeHouseLabel(source)}`,
    title: settings.exchangeMode === 'manual' ? 'Dólar' : source === 'mep' ? 'Dólar MEP' : `Dólar ${exchangeHouseLabel(source).toLowerCase()}`,
    refresh: () => { void load('visible'); },
    money,
  }), [settings, phase, quote, days, source, load, money]);

  return <ExchangeContext.Provider value={value}>{children}</ExchangeContext.Provider>;
}

export function useExchange() {
  const value = useContext(ExchangeContext);
  if (!value) throw new Error('Falta el contexto de cotización');
  return value;
}

export function useMoney(): MoneyApi {
  return useContext(ExchangeContext)?.money ?? passthroughMoney();
}

export function useExchangeOptional() {
  return useContext(ExchangeContext);
}

export function useDisplayQuote() {
  const exchange = useExchangeOptional();
  const sell = exchange && exchange.phase !== 'loading' && exchange.quote && exchange.quote.sell > 0 ? exchange.quote.sell : null;
  const staleClock = exchange?.phase === 'error' && exchange.quote?.updatedAt ? formatClock(exchange.quote.updatedAt) : '';
  return { sell, staleClock };
}

export function approxUsd(amount: number, currency: string | null | undefined, active: MoneyCurrency, sellRate: number | null): string | null {
  if (!(amount > 0) || active !== 'ARS' || sellRate == null || !(sellRate > 0)) return null;
  const pesos = projectAmount(amount, currency, 'ARS', sellRate);
  if (pesos.blocked || !(pesos.value > 0)) return null;
  return `≈ ${formatMoney(Math.round(pesos.value / sellRate), 'USD')}`;
}

export function approxActive(total: number | null, active: MoneyCurrency, sellRate: number | null): string | null {
  if (total == null || !(total > 0) || active !== 'ARS' || sellRate == null || !(sellRate > 0)) return null;
  return `≈ ${formatMoney(Math.round(total / sellRate), 'USD')}`;
}
