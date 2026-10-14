import type { AuthUserLike } from '../types/auth-user';
import type { ClientDeposit } from '../types';
import { apiRequest } from './api-client';
export type DepositInput = { amount: number; currency: 'ARS' | 'USD'; exchangeRate: number; method: string; productId?: string | null; requestKey: string };
const path = (clientId: string) => `/api/clients/${encodeURIComponent(clientId)}/deposits`;
export async function fetchClientDeposits(user: AuthUserLike, clientId: string) {
  const result = await apiRequest<{ deposits: ClientDeposit[] }>(user, path(clientId), { errorFrom: 'friendly', fallback: 'No se pudieron cargar las señas' });
  if (!Array.isArray(result.deposits)) throw new Error('Respuesta inválida al cargar las señas');
  return result.deposits;
}
export async function createClientDeposit(user: AuthUserLike, clientId: string, input: DepositInput) {
  const result = await apiRequest<{ deposit: ClientDeposit }>(user, path(clientId), { method: 'POST', body: input, errorFrom: 'friendly', fallback: 'No se pudo registrar la seña' });
  if (!result.deposit) throw new Error('Respuesta inválida al registrar la seña');
  return result.deposit;
}
export async function cancelClientDeposit(user: AuthUserLike, clientId: string, id: string, mode: 'REFUND' | 'CREDIT') {
  const result = await apiRequest<{ deposit: ClientDeposit }>(user, `${path(clientId)}/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { mode }, errorFrom: 'friendly', fallback: 'No se pudo cancelar la seña' });
  if (!result.deposit) throw new Error('Respuesta inválida al cancelar la seña');
  return result.deposit;
}
export async function applyClientDepositToRepair(user: AuthUserLike, clientId: string, id: string, repairId: string, exchangeRate?: number) {
  const result = await apiRequest<{ deposit: ClientDeposit; repairDeposit: number; repairCurrency: string | null }>(user, `${path(clientId)}/${encodeURIComponent(id)}/repair`, { method: 'POST', body: { repairId, exchangeRate }, errorFrom: 'friendly', fallback: 'No se pudo aplicar la seña' });
  if (!result.deposit) throw new Error('Respuesta inválida al aplicar la seña');
  return result;
}
