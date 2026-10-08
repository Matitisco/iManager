import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type CommissionBasis = 'PERCENT_SALE' | 'PERCENT_PROFIT' | 'FIXED_PER_DEVICE';

export interface CommissionRuleView {
  basis: CommissionBasis;
  rate: number;
  includeAccessories: boolean;
  settlement: 'MONTHLY';
  label: string;
  detail: string;
}

export interface CommissionSaleLine {
  id: string;
  code: string;
  date: string;
  device: string;
  accessoriesAmount: number;
  total: number;
  commission: number;
  soldAt: string;
}

export interface CommissionPerson {
  memberId: string;
  userId: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  salesCount: number;
  soldAmount: number;
  commission: number;
  rule: CommissionRuleView | null;
  paidAt: string | null;
  sales?: CommissionSaleLine[];
}

export interface CommissionMember {
  id: string;
  name: string;
  role: CommissionPerson['role'];
}

export interface CommissionPeriod {
  period: { key: string; label: string; closesLabel: string; current: boolean };
  summary: {
    soldAmount: number;
    salesCount: number;
    commission: number;
    share: number;
    paidAmount: number;
    paidCount: number;
    peopleCount: number;
    pendingAmount: number;
  };
  people: CommissionPerson[];
  members: CommissionMember[];
  rules: { team: CommissionRuleView | null; personal: Record<string, CommissionRuleView> };
}

export interface CommissionRuleInput {
  memberId: string | null;
  basis: CommissionBasis;
  rate: number;
  includeAccessories: boolean;
}

async function headers(user: AuthUserLike, withBody = false) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

function baseUrl() {
  const value = getBackendBaseUrl();
  if (!value) throw new Error('Backend no configurado');
  return value.replace(/\/+$/, '');
}

async function request<T>(user: AuthUserLike, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithTimeout(`${baseUrl()}${path}`, {
    ...init,
    headers: await headers(user, init.body !== undefined),
  });
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || `No se pudieron cargar las comisiones (${response.status})`);
  return body as T;
}

export function fetchCommissionPeriod(user: AuthUserLike, period: string) {
  return request<CommissionPeriod>(user, `/api/commissions?period=${encodeURIComponent(period)}`);
}

export function fetchCommissionPerson(user: AuthUserLike, memberId: string, period: string) {
  return request<{ period: CommissionPeriod['period']; person: CommissionPerson }>(
    user,
    `/api/commissions/people/${encodeURIComponent(memberId)}?period=${encodeURIComponent(period)}`,
  );
}

export function saveCommissionRule(user: AuthUserLike, input: CommissionRuleInput) {
  return request<CommissionPeriod>(user, '/api/commissions/rules', { method: 'PUT', body: JSON.stringify(input) });
}

export function markCommissionPaid(user: AuthUserLike, input: { memberId: string; period: string }) {
  return request<CommissionPeriod>(user, '/api/commissions/payments', { method: 'POST', body: JSON.stringify(input) });
}
