import { fetchWithTimeout } from '../services/fetch-with-timeout';

export const BLUE_REFRESH_MS = 15 * 60 * 1000;
export const BLUE_REFRESH_LABEL = '15 min';
export const BLUE_STORAGE_KEY = 'imanager-desk-blue';

const AMBITO_PREVIOUS_CLOSE_URL = 'https://mercados.ambito.com/dolar/informal/variacion';
const HISTORY_DAYS = 21;

// Dólar Hoy does not publish a usable JSON API, so it is not offered here.
export const BLUE_SOURCES = [
  { id: 'dolarapi', label: 'DolarApi', url: 'https://dolarapi.com/v1/dolares/blue' },
  { id: 'bluelytics', label: 'Bluelytics', url: 'https://api.bluelytics.com.ar/v2/latest' },
] as const;

export type BlueSourceId = (typeof BLUE_SOURCES)[number]['id'];

export type BlueQuote = {
  source: BlueSourceId;
  buy: number;
  sell: number;
  updatedAt: string;
};

type StoredQuote = {
  buy: number;
  sell: number;
  updatedAt: string;
  fetchedAt: string;
};

export type BlueDay = { buy: number; sell: number };

export const EXCHANGE_HOUSES = [
  { id: 'blue', label: 'Blue', url: 'https://dolarapi.com/v1/dolares/blue' },
  { id: 'oficial', label: 'Oficial', url: 'https://dolarapi.com/v1/dolares/oficial' },
  { id: 'mep', label: 'MEP', url: 'https://dolarapi.com/v1/dolares/bolsa' },
] as const;

export type ExchangeSourceId = (typeof EXCHANGE_HOUSES)[number]['id'];

type HouseCache = { quote: StoredQuote; days: Record<string, BlueDay> };

export type BlueState = {
  source: BlueSourceId;
  quotes: Partial<Record<BlueSourceId, StoredQuote>>;
  days: Partial<Record<BlueSourceId, Record<string, BlueDay>>>;
  houses: Partial<Record<ExchangeSourceId, HouseCache>>;
};

const SOURCE_IDS = new Set<string>(BLUE_SOURCES.map((item) => item.id));
const HOUSE_IDS = new Set<string>(EXCHANGE_HOUSES.map((item) => item.id));

export function isExchangeSource(value: unknown): value is ExchangeSourceId {
  return typeof value === 'string' && HOUSE_IDS.has(value);
}

export function exchangeHouseLabel(source: ExchangeSourceId): string {
  return EXCHANGE_HOUSES.find((item) => item.id === source)?.label ?? 'Blue';
}

export function isBlueSource(value: unknown): value is BlueSourceId {
  return typeof value === 'string' && SOURCE_IDS.has(value);
}

export function blueSourceLabel(source: BlueSourceId): string {
  return BLUE_SOURCES.find((item) => item.id === source)?.label ?? 'DolarApi';
}

export function argentinaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  return hour && minute ? `${hour}:${minute}` : '';
}

export function parseArAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function requireAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Cotización inválida');
  return amount;
}

function requireTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('Cotización inválida');
  return value;
}

export function parseBlueQuote(source: BlueSourceId, body: unknown): BlueQuote {
  if (!body || typeof body !== 'object') throw new Error('Cotización inválida');
  const record = body as Record<string, unknown>;
  if (source === 'dolarapi') {
    return {
      source,
      buy: requireAmount(record.compra),
      sell: requireAmount(record.venta),
      updatedAt: requireTimestamp(record.fechaActualizacion),
    };
  }
  if (!record.blue || typeof record.blue !== 'object') throw new Error('Cotización inválida');
  const blue = record.blue as Record<string, unknown>;
  return {
    source,
    buy: requireAmount(blue.value_buy),
    sell: requireAmount(blue.value_sell),
    updatedAt: requireTimestamp(record.last_update),
  };
}

// Ámbito publishes the previous informal close. Use it only when its live sell
// matches the selected source, so the delta stays on the same print.
export function previousCloseFromAmbito(quoteSell: number, body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const sell = parseArAmount(record.venta);
  const previous = parseArAmount(record.valor_cierre_ant);
  if (sell == null || previous == null) return null;
  if (Math.abs(sell - quoteSell) > 1) return null;
  return previous;
}

export function sellDelta(sell: number, days: Record<string, BlueDay>, now = new Date()): number | null {
  const today = argentinaDay(now);
  const prior = Object.keys(days).filter((day) => day < today).sort().at(-1);
  if (!prior) return null;
  const previous = days[prior]?.sell;
  if (typeof previous !== 'number' || !Number.isFinite(previous)) return null;
  return Math.round(sell - previous);
}

export function convertUsd(usd: number, rate: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(rate) || usd <= 0 || rate <= 0) return 0;
  return Math.round(usd * rate);
}

export function isFreshQuote(fetchedAt: string, now = Date.now()): boolean {
  const time = Date.parse(fetchedAt);
  return Number.isFinite(time) && now >= time && now - time < BLUE_REFRESH_MS;
}

function emptyState(): BlueState {
  return { source: 'dolarapi', quotes: {}, days: {}, houses: {} };
}

function isStoredQuote(value: unknown): value is StoredQuote {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.buy === 'number' && row.buy > 0
    && typeof row.sell === 'number' && row.sell > 0
    && typeof row.updatedAt === 'string' && !Number.isNaN(Date.parse(row.updatedAt))
    && typeof row.fetchedAt === 'string' && !Number.isNaN(Date.parse(row.fetchedAt));
}

function isDay(value: unknown): value is BlueDay {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.buy === 'number' && row.buy > 0 && typeof row.sell === 'number' && row.sell > 0;
}

export function readBlueState(): BlueState {
  try {
    const raw = localStorage.getItem(BLUE_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyState();
    const record = parsed as Record<string, unknown>;
    const quotes: BlueState['quotes'] = {};
    const days: BlueState['days'] = {};
    if (record.quotes && typeof record.quotes === 'object') {
      for (const item of BLUE_SOURCES) {
        const snap = (record.quotes as Record<string, unknown>)[item.id];
        if (isStoredQuote(snap)) quotes[item.id] = snap;
      }
    }
    if (record.days && typeof record.days === 'object') {
      for (const item of BLUE_SOURCES) {
        const bucket = (record.days as Record<string, unknown>)[item.id];
        if (!bucket || typeof bucket !== 'object') continue;
        const clean: Record<string, BlueDay> = {};
        for (const [day, point] of Object.entries(bucket)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isDay(point)) clean[day] = point;
        }
        if (Object.keys(clean).length > 0) days[item.id] = clean;
      }
    }
    const houses: BlueState['houses'] = {};
    if (record.houses && typeof record.houses === 'object') {
      for (const item of EXCHANGE_HOUSES) {
        const snap = (record.houses as Record<string, unknown>)[item.id];
        if (!snap || typeof snap !== 'object') continue;
        const row = snap as Record<string, unknown>;
        if (!isStoredQuote(row.quote) || !row.days || typeof row.days !== 'object') continue;
        const clean: Record<string, BlueDay> = {};
        for (const [day, point] of Object.entries(row.days)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isDay(point)) clean[day] = point;
        }
        houses[item.id] = { quote: row.quote, days: clean };
      }
    }
    return { source: isBlueSource(record.source) ? record.source : 'dolarapi', quotes, days, houses };
  } catch {
    return emptyState();
  }
}

function writeBlueState(state: BlueState) {
  localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify(state));
}

export function quoteFromState(state: BlueState, source: BlueSourceId): BlueQuote | null {
  const snap = state.quotes[source];
  if (!snap) return null;
  return { source, buy: snap.buy, sell: snap.sell, updatedAt: snap.updatedAt };
}

export function saveBlueSource(source: BlueSourceId): BlueState {
  const state = readBlueState();
  const next = { ...state, source };
  writeBlueState(next);
  return next;
}

function pruneDays(days: Record<string, BlueDay>, today: string): Record<string, BlueDay> {
  const cutoff = shiftDay(today, -HISTORY_DAYS);
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= cutoff && day <= today));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetchWithTimeout(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo actualizar la cotización');
  return response.json() as Promise<unknown>;
}

export async function refreshBlueQuote(source: BlueSourceId): Promise<{ quote: BlueQuote; days: Record<string, BlueDay> }> {
  const spec = BLUE_SOURCES.find((item) => item.id === source);
  if (!spec) throw new Error('Fuente desconocida');
  const quote = parseBlueQuote(source, await fetchJson(spec.url));
  const today = argentinaDay(new Date());
  const existing = readBlueState().days[source] ?? {};
  const hadPrior = Object.keys(existing).some((day) => day < today);
  let previous: number | null = null;
  if (!hadPrior) {
    try {
      previous = previousCloseFromAmbito(quote.sell, await fetchJson(AMBITO_PREVIOUS_CLOSE_URL));
    } catch {
      previous = null;
    }
  }
  const days = { ...existing };
  if (previous != null) {
    const day = shiftDay(today, -1);
    if (!days[day]) days[day] = { buy: previous, sell: previous };
  }
  days[today] = { buy: quote.buy, sell: quote.sell };
  const pruned = pruneDays(days, today);
  const latest = readBlueState();
  writeBlueState({
    ...latest,
    quotes: {
      ...latest.quotes,
      [source]: { buy: quote.buy, sell: quote.sell, updatedAt: quote.updatedAt, fetchedAt: new Date().toISOString() },
    },
    days: { ...latest.days, [source]: pruned },
  });
  return { quote, days: pruned };
}

export function houseFromState(state: BlueState, source: ExchangeSourceId): { quote: BlueQuote; days: Record<string, BlueDay> } | null {
  const snap = state.houses[source];
  if (!snap) return null;
  return {
    quote: { source: 'dolarapi', buy: snap.quote.buy, sell: snap.quote.sell, updatedAt: snap.quote.updatedAt },
    days: snap.days,
  };
}

export function houseFetchedAt(state: BlueState, source: ExchangeSourceId): string | null {
  return state.houses[source]?.quote.fetchedAt ?? null;
}

// DolarApi houses share the blue payload (compra / venta / fechaActualizacion).
export async function refreshExchangeQuote(source: ExchangeSourceId): Promise<{ quote: BlueQuote; days: Record<string, BlueDay> }> {
  const spec = EXCHANGE_HOUSES.find((item) => item.id === source);
  if (!spec) throw new Error('Fuente desconocida');
  const quote = parseBlueQuote('dolarapi', await fetchJson(spec.url));
  const today = argentinaDay(new Date());
  const cached = readBlueState();
  const houseDays = cached.houses[source]?.days ?? {};
  const legacyDays = source === 'blue' ? cached.days.dolarapi ?? {} : {};
  const existing = Object.keys(houseDays).length > 0 ? houseDays : legacyDays;
  const hadPrior = Object.keys(existing).some((day) => day < today);
  let previous: number | null = null;
  if (!hadPrior && source === 'blue') {
    try {
      previous = previousCloseFromAmbito(quote.sell, await fetchJson(AMBITO_PREVIOUS_CLOSE_URL));
    } catch {
      previous = null;
    }
  }
  const days = { ...existing };
  if (previous != null) {
    const day = shiftDay(today, -1);
    if (!days[day]) days[day] = { buy: previous, sell: previous };
  }
  days[today] = { buy: quote.buy, sell: quote.sell };
  const pruned = pruneDays(days, today);
  const latest = readBlueState();
  writeBlueState({
    ...latest,
    houses: {
      ...latest.houses,
      [source]: { quote: { buy: quote.buy, sell: quote.sell, updatedAt: quote.updatedAt, fetchedAt: new Date().toISOString() }, days: pruned },
    },
  });
  return { quote, days: pruned };
}
