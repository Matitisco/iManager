import type { Client } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type AccountTone = 'verde' | 'amarillo' | 'rojo';
export type AccountLine = {
  id: string;
  source: 'VENTA' | 'REPARACION' | 'MANUAL';
  label: string;
  amount: number;
  currency: string | null;
  openedAt: string;
  days: number;
  tone: AccountTone;
  state: 'ABIERTA' | 'NOTA_CREDITO';
  saleId: string | null;
  repairId: string | null;
  installments: Array<{ sequence: number; dueDate: string; amount: number; paidAmount: number; status: string }>;
};
export type Debtor = {
  clientId: string;
  name: string;
  phone: string;
  pendingBalance: number;
  repairBalance: number;
  currency: string | null;
  days: number;
  tone: AccountTone;
  statement: string;
  lines: AccountLine[];
};
export type FollowUpCard = {
  id: string;
  kind: 'CUMPLEANOS' | 'GARANTIA' | 'DEUDA' | 'INACTIVO';
  clientId: string;
  name: string;
  phone: string;
  title: string;
  detail: string;
};
export type FollowUpSettings = {
  birthdayLeadDays: number;
  warrantyMonths: number;
  warrantyLeadDays: number;
  inactiveDays: number;
  includeDebts: boolean;
};
export type SaleAccount = {
  saleId: string;
  status: string;
  openBalance: number | null;
  paymentMethod: string;
  plan: { count: number; frequency: string; surcharge: number; financedAmount: number; firstDueDate: string } | null;
  installments: AccountLine['installments'];
  tenders: Array<{ id: string; amount: number; currency: string; method: string; role: string; exchangeRate: number | null }>;
};

const fallback = 'No se pudo actualizar la cuenta corriente';

export function fetchDebtors(user: AuthUserLike) {
  return apiRequest<{ debtors: Debtor[] }>(user, '/api/accounts/debtors', { fallback: 'No se pudo cargar la cuenta corriente' });
}
export function fetchFollowUps(user: AuthUserLike) {
  return apiRequest<{ today: string; settings: FollowUpSettings; cards: FollowUpCard[] }>(user, '/api/accounts/follow-ups', { fallback: 'No se pudieron cargar los seguimientos' });
}
export function saveFollowUpSettings(user: AuthUserLike, body: FollowUpSettings) {
  return apiRequest<{ settings: FollowUpSettings }>(user, '/api/accounts/follow-ups/settings', { method: 'PATCH', body, errorFrom: 'friendly', fallback });
}
export function fetchSaleAccount(user: AuthUserLike, saleId: string) {
  return apiRequest<SaleAccount>(user, `/api/accounts/sales/${encodeURIComponent(saleId)}`, { fallback: 'No se pudo cargar la venta' });
}
export function createAccountMovement(user: AuthUserLike, clientId: string, body: { kind: 'CARGO' | 'DESCUENTO' | 'NOTA_CREDITO'; amount: number; note?: string; saleId?: string | null; currency?: string | null }) {
  return apiRequest<{ client: Client }>(user, `/api/accounts/clients/${encodeURIComponent(clientId)}/movements`, { method: 'POST', body, errorFrom: 'friendly', fallback });
}
export function collectAccount(user: AuthUserLike, body: { clientId: string; saleId?: string | null; repairId?: string | null; amount: number; method: string; currency?: string | null }) {
  return apiRequest<{ client: Client }>(user, '/api/accounts/collections', { method: 'POST', body, errorFrom: 'friendly', fallback });
}
