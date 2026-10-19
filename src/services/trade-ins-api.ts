import type { TradeIn } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

type BackendTradeInsResponse = {
  tradeIn?: TradeIn;
  tradeIns?: TradeIn[];
};

export async function fetchBackendTradeIns(user: AuthUserLike): Promise<TradeIn[]> {
  const data = await apiRequest<BackendTradeInsResponse>(user, '/api/trade-ins', {
    fallback: (status) => `No se pudieron cargar los canjes (${status})`,
  });
  return data.tradeIns ?? [];
}

export async function updateBackendTradeIn(user: AuthUserLike, tradeIn: TradeIn): Promise<TradeIn> {
  const data = await apiRequest<BackendTradeInsResponse>(user, `/api/trade-ins/${tradeIn.id}`, {
    method: 'PATCH',
    body: tradeIn,
    fallback: (status) => `No se pudo actualizar el canje (${status})`,
  });
  if (!data.tradeIn) {
    throw new Error('Respuesta inválida al actualizar canje');
  }

  return data.tradeIn;
}

export async function fetchVoidedTradeIns(user: AuthUserLike): Promise<TradeIn[]> {
  const data = await apiRequest<{ tradeIns?: TradeIn[] }>(user, '/api/trade-ins?voided=1', {
    fallback: (status) => `No se pudieron cargar los canjes anulados (${status})`,
  });
  return data.tradeIns ?? [];
}

export async function deleteBackendTradeIn(user: AuthUserLike, tradeInId: string, reason?: string): Promise<void> {
  await apiRequest<void>(user, `/api/trade-ins/${tradeInId}`, {
    method: 'DELETE',
    ...(reason == null ? {} : { body: { reason } }),
    fallback: (status) => `No se pudo anular el canje (${status})`,
  });
}
