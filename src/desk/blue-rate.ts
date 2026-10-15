import { fetchWithTimeout } from '../services/fetch-with-timeout';

export const BLUE_REFRESH_MS = 15 * 60 * 1000;
export const BLUE_REFRESH_LABEL = '15 min';
export const BLUE_STORAGE_KEY = 'imanager-desk-blue';

const AMBITO_PREVIOUS_CLOSE_URL = 'https://mercados.ambito.com/dolar/informal/variacion';
const HISTORY_DAYS = 21;

export type BlueQuote = {
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

// `quotes.dolarapi` and `days.dolarapi` are the cache written before exchange
// houses existed; the blue house still falls back to them.
export type BlueState = {
  quotes: { dolarapi?: StoredQuote };
  days: { dolarapi?: Record<string, BlueDay> };
  houses: Partial<Record<ExchangeSourceId, HouseCache>>;
};

export function exchangeHouseLabel(source: ExchangeSourceId): string {
  return EXCHANGE_HOUSES.find((item) => item.id === source)?.label ?? 'Blue';
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

// DolarApi houses share the blue payload (compra / venta / fechaActualizacion).
export function parseBlueQuote(body: unknown): BlueQuote {
  if (!body || typeof body !== 'object') throw new Error('Cotización inválida');
  const record = body as Record<string, unknown>;
  return {
    buy: requireAmount(record.compra),
    sell: requireAmount(record.venta),
    updatedAt: requireTimestamp(record.fechaActualizacion),
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
  return { quotes: {}, days: {}, houses: {} };
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

function cleanDays(value: unknown): Record<string, BlueDay> {
  const clean: Record<string, BlueDay> = {};
  if (!value || typeof value !== 'object') return clean;
  for (const [day, point] of Object.entries(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isDay(point)) clean[day] = point;
  }
  return clean;
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
    const legacyQuote = (record.quotes as Record<string, unknown> | undefined)?.dolarapi;
    if (isStoredQuote(legacyQuote)) quotes.dolarapi = legacyQuote;
    const legacyDays = cleanDays((record.days as Record<string, unknown> | undefined)?.dolarapi);
    if (Object.keys(legacyDays).length > 0) days.dolarapi = legacyDays;
    const houses: BlueState['houses'] = {};
    if (record.houses && typeof record.houses === 'object') {
      for (const item of EXCHANGE_HOUSES) {
        const snap = (record.houses as Record<string, unknown>)[item.id];
        if (!snap || typeof snap !== 'object') continue;
        const row = snap as Record<string, unknown>;
        if (!isStoredQuote(row.quote) || !row.days || typeof row.days !== 'object') continue;
        houses[item.id] = { quote: row.quote, days: cleanDays(row.days) };
      }
    }
    return { quotes, days, houses };
  } catch {
    return emptyState();
  }
}

function writeBlueState(state: BlueState) {
  localStorage.setItem(BLUE_STORAGE_KEY, JSON.stringify(state));
}

function pruneDays(days: Record<string, BlueDay>, today: string): Record<string, BlueDay> {
  const cutoff = shiftDay(today, -HISTORY_DAYS);
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= cutoff && day <= today));
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetchWithTimeout(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('No se pudo actualizar la cotización');
  return response.json() as Promise<unknown>;
}

export function houseFromState(state: BlueState, source: ExchangeSourceId): { quote: BlueQuote; days: Record<string, BlueDay> } | null {
  const snap = state.houses[source];
  if (!snap) return null;
  return {
    quote: { buy: snap.quote.buy, sell: snap.quote.sell, updatedAt: snap.quote.updatedAt },
    days: snap.days,
  };
}

export function houseFetchedAt(state: BlueState, source: ExchangeSourceId): string | null {
  return state.houses[source]?.quote.fetchedAt ?? null;
}

export async function refreshExchangeQuote(source: ExchangeSourceId, signal?: AbortSignal): Promise<{ quote: BlueQuote; days: Record<string, BlueDay> }> {
  const spec = EXCHANGE_HOUSES.find((item) => item.id === source);
  if (!spec) throw new Error('Fuente desconocida');
  const quote = parseBlueQuote(await fetchJson(spec.url, signal));
  signal?.throwIfAborted();
  const today = argentinaDay(new Date());
  const cached = readBlueState();
  const houseDays = cached.houses[source]?.days ?? {};
  const legacyDays = source === 'blue' ? cached.days.dolarapi ?? {} : {};
  const existing = Object.keys(houseDays).length > 0 ? houseDays : legacyDays;
  const hadPrior = Object.keys(existing).some((day) => day < today);
  let previous: number | null = null;
  if (!hadPrior && source === 'blue') {
    try {
      previous = previousCloseFromAmbito(quote.sell, await fetchJson(AMBITO_PREVIOUS_CLOSE_URL, signal));
    } catch {
      previous = null;
    }
  }
  signal?.throwIfAborted();
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
