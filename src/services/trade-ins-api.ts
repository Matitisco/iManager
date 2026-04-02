import type { User } from 'firebase/auth';
import type { TradeIn } from '../types';
import { getBackendBaseUrl } from './backend-session';

type BackendTradeInsResponse = {
  tradeIn?: TradeIn;
  tradeIns?: TradeIn[];
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

async function getAuthHeaders(user: User) {
  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getBaseUrlOrThrow() {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('Backend no configurado');
  }

  return trimTrailingSlash(baseUrl);
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function fetchBackendTradeIns(user: User): Promise<TradeIn[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/trade-ins`, {
    headers: await getAuthHeaders(user),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudieron cargar los canjes (${response.status})`);
  }

  const data = await parseJson<BackendTradeInsResponse>(response);
  return data.tradeIns ?? [];
}

export async function createBackendTradeIn(user: User, tradeIn: Omit<TradeIn, 'id'>): Promise<TradeIn> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/trade-ins`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(tradeIn),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo crear el canje (${response.status})`);
  }

  const data = await parseJson<BackendTradeInsResponse>(response);
  if (!data.tradeIn) {
    throw new Error('Respuesta inválida al crear canje');
  }

  return data.tradeIn;
}

export async function updateBackendTradeIn(user: User, tradeIn: TradeIn): Promise<TradeIn> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/trade-ins/${tradeIn.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(tradeIn),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo actualizar el canje (${response.status})`);
  }

  const data = await parseJson<BackendTradeInsResponse>(response);
  if (!data.tradeIn) {
    throw new Error('Respuesta inválida al actualizar canje');
  }

  return data.tradeIn;
}

export async function deleteBackendTradeIn(user: User, tradeInId: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/trade-ins/${tradeInId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar el canje (${response.status})`);
  }
}
