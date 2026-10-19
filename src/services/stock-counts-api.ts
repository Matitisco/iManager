import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type StockScanResult = 'FOUND' | 'NOT_LOADED' | 'SOLD' | 'REPEATED';

export type BlindScan = {
  id: string;
  createdAt: string;
  result: StockScanResult;
  imei: string;
  model: string | null;
  capacity: string | null;
  color: string | null;
};

export type BlindCount = {
  id: string;
  subtitle: string;
  mine: number;
  total: number;
  scans: BlindScan[];
};

export type StockCountListItem = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  resolution: 'ADJUSTED' | 'RECORDED' | null;
  subtitle: string;
  summary: string | null;
  startedAt: string;
  closedAt: string | null;
};

export type StockCountLine = {
  key: string;
  inventoryItemId: string | null;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  price: number | null;
  currency: string | null;
  note: string | null;
};

export type ClosedStockCount = StockCountListItem & {
  excludedNoImei: number;
  scanCount: number;
  buckets: {
    matched: StockCountLine[];
    missing: StockCountLine[];
    surplus: StockCountLine[];
    sold: StockCountLine[];
  };
};

export type StockCountPreview = {
  excludedNoImei: number;
  scope: string;
  counters: string;
};

const blindFallback = (status: number) => `No se pudo cargar el control (${status})`;

export async function fetchStockCounts(user: AuthUserLike) {
  const data = await apiRequest<{ counts?: StockCountListItem[] }>(user, '/api/stock-counts', { fallback: blindFallback });
  return data.counts ?? [];
}

export async function fetchStockCountPreview(user: AuthUserLike) {
  return apiRequest<StockCountPreview>(user, '/api/stock-counts/preview', {
    fallback: (status) => `No se pudo preparar el control (${status})`,
    errorFrom: 'friendly',
  });
}

export async function fetchCurrentStockCount(user: AuthUserLike) {
  const data = await apiRequest<{ count?: BlindCount | null }>(user, '/api/stock-counts/current', { fallback: blindFallback });
  return data.count ?? null;
}

export async function fetchStockCount(user: AuthUserLike, id: string) {
  const data = await apiRequest<{ count?: ClosedStockCount }>(user, `/api/stock-counts/${id}`, {
    fallback: (status) => `No se pudo abrir el control (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.count) throw new Error('No encontramos ese control');
  return data.count;
}

export async function startStockCount(user: AuthUserLike) {
  const data = await apiRequest<{ count?: BlindCount }>(user, '/api/stock-counts', {
    method: 'POST',
    body: {},
    fallback: (status) => `No se pudo iniciar el control (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.count) throw new Error('No se pudo iniciar el control');
  return data.count;
}

export async function scanStockCount(user: AuthUserLike, id: string, imei: string) {
  const data = await apiRequest<{ count?: BlindCount }>(user, `/api/stock-counts/${id}/scans`, {
    method: 'POST',
    body: { imei },
    fallback: (status) => `No se pudo sumar el IMEI (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.count) throw new Error('No se pudo sumar el IMEI');
  return data.count;
}

export async function closeStockCount(user: AuthUserLike, id: string) {
  const data = await apiRequest<{ count?: ClosedStockCount }>(user, `/api/stock-counts/${id}/close`, {
    method: 'POST',
    body: {},
    fallback: (status) => `No se pudo cerrar el control (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.count) throw new Error('No se pudo cerrar el control');
  return data.count;
}

export async function resolveStockCount(user: AuthUserLike, id: string, body: { mode: 'ADJUST' | 'RECORD'; missingIds: string[]; surplusImeis: string[] }) {
  const data = await apiRequest<{ count?: ClosedStockCount }>(user, `/api/stock-counts/${id}/resolve`, {
    method: 'POST',
    body,
    fallback: (status) => `No se pudo guardar el control (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.count) throw new Error('No se pudo guardar el control');
  return data.count;
}
