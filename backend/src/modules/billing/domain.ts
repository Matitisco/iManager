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
/** Unset or blank stays on. `0`, `false`, `off` and `no` turn the beta off. */
export function billingBetaUnlimited() {
  const raw = process.env.BILLING_BETA_UNLIMITED;
  if (raw == null || raw.trim() === '') return true;
  return !/^(0|false|off|no)$/i.test(raw.trim());
}
const INTERNAL_OPENING = { billingPlan: 'INTERNAL', billingStatus: 'ACTIVE', trialEndsAt: null } as const;
export const trialData = (legacy: boolean, now = new Date()) => {
  if (billingBetaUnlimited()) return { ...INTERNAL_OPENING };
  return legacy ? {} : {
    billingPlan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: new Date(now.getTime() + 7 * 86_400_000),
  };
};
function paidActiveSubscription(store: Pick<BillingStore, 'billingPlan' | 'billingStatus' | 'billingPaidThrough'>, now: Date) {
  if (store.billingPlan !== 'BASIC' && store.billingPlan !== 'BUSINESS') return false;
  if (store.billingStatus !== 'ACTIVE') return false;
  return store.billingPaidThrough !== null && store.billingPaidThrough > now;
}
export function arsAmount(usd: number, rate: number) {
  const amount = Math.round((usd * rate + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000_000) throw new DomainError('Cotización inválida para la suscripción');
  return amount;
}
/** The no-card trial carries Básico entitlements. INTERNAL stays unlimited. */
export function memberLimit(plan: string) {
  return plan === 'INTERNAL' ? null : plan === 'BASIC' || plan === 'TRIAL' ? 3 : 5;
}
export type BillingStore = Pick<Store, 'billingPlan' | 'billingStatus' | 'trialEndsAt' | 'billingPaidThrough' | 'billingPeriod' | 'billingPreapprovalId'>;
/** First debit of a subscription started during the trial. Null means charge now. */
export function trialChargeStart(trialEndsAt: Date | null | undefined, now = new Date()) {
  if (!trialEndsAt || trialEndsAt.getTime() <= now.getTime()) return null;
  return trialEndsAt;
}
const CHARGE_REMINDER_MS = 2 * 86_400_000;
export function billingSummary(store: BillingStore, members: number, now = new Date()) {
  const betaUnlimited = billingBetaUnlimited();
  const effective = betaUnlimited && !paidActiveSubscription(store, now)
    ? { ...store, billingPlan: 'INTERNAL', billingStatus: 'ACTIVE', trialEndsAt: null }
    : store;
  const internal = effective.billingPlan === 'INTERNAL';
  const trial = !internal && effective.trialEndsAt !== null && effective.trialEndsAt > now;
  const paid = !internal && effective.billingPaidThrough !== null && effective.billingPaidThrough > now;
  const limit = memberLimit(effective.billingPlan);
  const overLimit = !internal && limit !== null && members > limit;
  const status = internal ? 'ACTIVE' : effective.billingStatus === 'CANCELLED' ? 'CANCELLED' : paid ? 'ACTIVE' : trial ? 'TRIAL' : 'EXPIRED';
  const scheduled = trial && !paid && !!effective.billingPreapprovalId && effective.billingStatus !== 'CANCELLED';
  const untilCharge = scheduled ? effective.trialEndsAt!.getTime() - now.getTime() : 0;
  return {
    plan: effective.billingPlan, status, period: effective.billingPeriod,
    trialEndsAt: effective.trialEndsAt?.toISOString() ?? null,
    paidThrough: effective.billingPaidThrough?.toISOString() ?? null,
    trialDaysLeft: trial ? Math.ceil((effective.trialEndsAt!.getTime() - now.getTime()) / 86_400_000) : 0,
    readOnly: !internal && ((!trial && !paid) || overLimit),
    memberLimit: limit, members, overLimit,
    canCancel: !internal && !!effective.billingPreapprovalId && effective.billingStatus !== 'CANCELLED',
    firstChargeAt: scheduled ? effective.trialEndsAt!.toISOString() : null,
    chargeReminder: scheduled && untilCharge <= CHARGE_REMINDER_MS,
    betaUnlimited,
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
