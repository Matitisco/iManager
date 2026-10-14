import type { AuthUserLike } from '../types/auth-user';
import type { CommissionDetail, CommissionPayment, CommissionPaymentInput, CommissionReport, CommissionRule, CommissionRuleInput, CommissionSummary } from '../types/commissions';
import { apiRequest } from './api-client';

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, value);
  return search.size ? `?${search}` : '';
};
const fallback = (status: number) => `No se pudo completar la operación de comisiones (${status})`;

export function fetchCommissionSummary(user: AuthUserLike, period?: string) {
  return apiRequest<CommissionSummary>(user, `/api/commissions${query({ period })}`, { fallback });
}
export function fetchCommissionMember(user: AuthUserLike, memberId: string, period?: string) {
  return apiRequest<CommissionDetail>(user, `/api/commissions/members/${encodeURIComponent(memberId)}${query({ period })}`, { fallback });
}
export function fetchMyCommissions(user: AuthUserLike, period?: string) {
  return apiRequest<CommissionDetail>(user, `/api/commissions/mine${query({ period })}`, { fallback });
}
export async function fetchCommissionRules(user: AuthUserLike): Promise<CommissionRule[]> {
  const data = await apiRequest<{ rules: CommissionRule[] }>(user, '/api/commissions/rules', { fallback });
  if (!Array.isArray(data.rules)) throw new Error('Respuesta inválida de reglas de comisiones');
  return data.rules;
}
export async function createCommissionRule(user: AuthUserLike, input: CommissionRuleInput): Promise<CommissionRule> {
  const data = await apiRequest<{ rule: CommissionRule }>(user, '/api/commissions/rules', { method: 'POST', body: input, fallback, errorFrom: 'friendly' });
  if (!data.rule) throw new Error('Respuesta inválida al guardar regla');
  return data.rule;
}
export async function updateCommissionRule(user: AuthUserLike, id: string, input: Partial<CommissionRuleInput>): Promise<CommissionRule> {
  const data = await apiRequest<{ rule: CommissionRule }>(user, `/api/commissions/rules/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, fallback, errorFrom: 'friendly' });
  if (!data.rule) throw new Error('Respuesta inválida al guardar regla');
  return data.rule;
}
export function deleteCommissionRule(user: AuthUserLike, id: string): Promise<void> {
  return apiRequest<void>(user, `/api/commissions/rules/${encodeURIComponent(id)}`, { method: 'DELETE', fallback });
}
export async function fetchCommissionPayments(user: AuthUserLike, period?: string, memberId?: string): Promise<CommissionPayment[]> {
  const data = await apiRequest<{ payments: CommissionPayment[] }>(user, `/api/commissions/payments${query({ period, memberId })}`, { fallback });
  if (!Array.isArray(data.payments)) throw new Error('Respuesta inválida de pagos de comisiones');
  return data.payments;
}
export async function createCommissionPayment(user: AuthUserLike, input: CommissionPaymentInput): Promise<CommissionPayment> {
  const data = await apiRequest<{ payment: CommissionPayment }>(user, '/api/commissions/payments', { method: 'POST', body: input, fallback, errorFrom: 'friendly' });
  if (!data.payment) throw new Error('Respuesta inválida al registrar pago');
  return data.payment;
}
export function assignSalesSeller(user: AuthUserLike, saleIds: string[], sellerMemberId: string | null) {
  return apiRequest<{ updated: number }>(user, '/api/commissions/sales/seller', { method: 'PATCH', body: { saleIds, sellerMemberId }, fallback, errorFrom: 'friendly' });
}
export function fetchCommissionReport(user: AuthUserLike, from: string, to: string) {
  return apiRequest<CommissionReport>(user, `/api/reports/commissions${query({ from, to })}`, { fallback });
}

export async function fetchCommissionSellers(user: AuthUserLike): Promise<import('../types/commissions').CommissionSeller[]> {
  const data = await apiRequest<{ sellers: import('../types/commissions').CommissionSeller[] }>(user, '/api/commissions/sellers', { fallback });
  if (!Array.isArray(data.sellers)) throw new Error('Respuesta inválida de vendedores');
  return data.sellers;
}

export async function fetchCommissionExchangeRate(user: AuthUserLike): Promise<number> {
  const data = await apiRequest<{ exchangeRate: number }>(user, '/api/commissions/exchange-rate', { fallback });
  if (!Number.isFinite(data.exchangeRate) || data.exchangeRate <= 0) throw new Error('No se pudo obtener la cotización blue');
  return data.exchangeRate;
}
