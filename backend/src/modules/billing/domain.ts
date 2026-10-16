import type { Store } from '@prisma/client';
import { DomainError } from '../../lib/domain-error.js';

export const PLANS = {
  BASIC_MONTHLY: { plan: 'BASIC', name: 'Básico', period: 'MONTHLY', usd: 22, months: 1, users: 3 },
  BASIC_ANNUAL: { plan: 'BASIC', name: 'Básico', period: 'ANNUAL', usd: 198, months: 12, users: 3 },
  BUSINESS_MONTHLY: { plan: 'BUSINESS', name: 'Negocio', period: 'MONTHLY', usd: 87, months: 1, users: 5 },
  BUSINESS_ANNUAL: { plan: 'BUSINESS', name: 'Negocio', period: 'ANNUAL', usd: 783, months: 12, users: 5 },
} as const;
export type PlanKey = keyof typeof PLANS;
export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];
export const BILLING_LOCK = 'billing:catalog';
export const storeBillingLock = (storeId: string) => `billing:store:${storeId}`;
export const trialData = (legacy: boolean, now = new Date()) => legacy ? {} : {
  billingPlan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: new Date(now.getTime() + 7 * 86_400_000),
};
export function arsAmount(usd: number, rate: number) {
  const amount = Math.round((usd * rate + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000_000) throw new DomainError('Cotización inválida para la suscripción');
  return amount;
}
export function memberLimit(plan: string) {
  return plan === 'INTERNAL' ? null : plan === 'BASIC' ? 3 : 5;
}
export type BillingStore = Pick<Store, 'billingPlan' | 'billingStatus' | 'trialEndsAt' | 'billingPaidThrough' | 'billingPeriod' | 'billingPreapprovalId'>;
export function billingSummary(store: BillingStore, members: number, now = new Date()) {
  const internal = store.billingPlan === 'INTERNAL';
  const trial = !internal && store.trialEndsAt !== null && store.trialEndsAt > now;
  const paid = !internal && store.billingPaidThrough !== null && store.billingPaidThrough > now;
  const limit = memberLimit(store.billingPlan);
  const overLimit = !internal && limit !== null && members > limit;
  const status = internal ? 'ACTIVE' : store.billingStatus === 'CANCELLED' ? 'CANCELLED' : paid ? 'ACTIVE' : trial ? 'TRIAL' : 'EXPIRED';
  return {
    plan: store.billingPlan, status, period: store.billingPeriod,
    trialEndsAt: store.trialEndsAt?.toISOString() ?? null,
    paidThrough: store.billingPaidThrough?.toISOString() ?? null,
    trialDaysLeft: trial ? Math.ceil((store.trialEndsAt!.getTime() - now.getTime()) / 86_400_000) : 0,
    readOnly: !internal && ((!trial && !paid) || overLimit),
    memberLimit: limit, members, overLimit,
    canCancel: !internal && !!store.billingPreapprovalId && store.billingStatus !== 'CANCELLED',
  };
}
export type BillingSummary = ReturnType<typeof billingSummary>;

/** Calendar months, clamped at month end (Jan 31 -> Feb 28), independent of server timezone. */
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
