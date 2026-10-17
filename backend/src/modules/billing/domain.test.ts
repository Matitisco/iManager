import { describe, expect, it, vi } from 'vitest';
import { addMonths, arsAmount, billingBetaUnlimited, billingSummary, PLANS, trialChargeStart, trialData, type BillingStore } from './domain.js';

const now = new Date('2026-01-31T10:00:00Z');
const base: BillingStore = { billingPlan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: new Date('2026-02-07T10:00:00Z'), billingPaidThrough: null, billingPeriod: null, billingPreapprovalId: null };
describe('reglas de suscripción', () => {
  it('protege al plan interno aun con fechas vencidas y muchos miembros', () => {
    expect(billingSummary({ ...base, billingPlan: 'INTERNAL', billingStatus: 'EXPIRED', trialEndsAt: now }, 200, now)).toMatchObject({ readOnly: false, memberLimit: null, status: 'ACTIVE' });
  });
  it('da siete días sin tarjeta solo a cuentas nuevas', () => {
    expect(trialData(true, now)).toEqual({});
    expect(trialData(false, now)).toMatchObject({ billingPlan: 'TRIAL', trialEndsAt: new Date('2026-02-07T10:00:00Z') });
  });
  it('con la beta una tienda nueva nace interna y una prueba vencida no se bloquea', () => {
    const previous = process.env.BILLING_BETA_UNLIMITED;
    delete process.env.BILLING_BETA_UNLIMITED;
    try {
      expect(billingBetaUnlimited()).toBe(true);
      expect(trialData(false, now)).toEqual({ billingPlan: 'INTERNAL', billingStatus: 'ACTIVE', trialEndsAt: null });
      expect(trialData(true, now)).toEqual({ billingPlan: 'INTERNAL', billingStatus: 'ACTIVE', trialEndsAt: null });
      const expired = { ...base, trialEndsAt: new Date('2026-01-01T00:00:00Z') };
      expect(billingSummary(expired, 40, now)).toMatchObject({ plan: 'INTERNAL', status: 'ACTIVE', readOnly: false, memberLimit: null, trialDaysLeft: 0, betaUnlimited: true });
      const paid = { ...base, billingPlan: 'BASIC', billingStatus: 'ACTIVE', billingPaidThrough: new Date('2026-03-01T00:00:00Z'), billingPeriod: 'MONTHLY', billingPreapprovalId: 'pre-paid' };
      expect(billingSummary(paid, 9, now)).toMatchObject({ plan: 'BASIC', status: 'ACTIVE', readOnly: true, overLimit: true, memberLimit: 3, betaUnlimited: true });
    } finally {
      process.env.BILLING_BETA_UNLIMITED = previous;
    }
  });
  it('con el interruptor apagado la prueba vencida sigue bloqueada', () => {
    vi.stubEnv('BILLING_BETA_UNLIMITED', 'false');
    try {
      expect(billingBetaUnlimited()).toBe(false);
      const expired = { ...base, trialEndsAt: new Date(0) };
      expect(trialData(false, now)).toMatchObject({ billingPlan: 'TRIAL', trialEndsAt: new Date('2026-02-07T10:00:00Z') });
      expect(billingSummary(expired, 4, now)).toMatchObject({ plan: 'TRIAL', status: 'EXPIRED', readOnly: true, memberLimit: 3, betaUnlimited: false });
    } finally {
      vi.stubEnv('BILLING_BETA_UNLIMITED', '0');
    }
  });
  it('vence exactamente al terminar el séptimo día', () => {
    expect(billingSummary(base, 1, now).trialDaysLeft).toBe(7);
    expect(billingSummary(base, 1, new Date('2026-02-07T09:59:59Z')).trialDaysLeft).toBe(1);
    expect(billingSummary(base, 1, base.trialEndsAt!)).toMatchObject({ trialDaysLeft: 0, readOnly: true, status: 'EXPIRED' });
  });
  it('respeta períodos pagados cancelados hasta su fin', () => {
    const store = { ...base, trialEndsAt: null, billingPlan: 'BASIC', billingStatus: 'CANCELLED', billingPaidThrough: new Date('2026-02-28T10:00:00Z') };
    expect(billingSummary(store, 1, now)).toMatchObject({ status: 'CANCELLED', readOnly: false, canCancel: false, memberLimit: 3 });
    expect(billingSummary(store, 1, store.billingPaidThrough)).toMatchObject({ readOnly: true, status: 'CANCELLED' });
  });
  it.each([['BASIC', 3], ['BUSINESS', 5], ['TRIAL', 3]])('limita %s a %s incluyendo al propietario', (plan, limit) => {
    expect(billingSummary({ ...base, billingPlan: String(plan) }, Number(limit), now)).toMatchObject({ overLimit: false, readOnly: false, memberLimit: limit });
    expect(billingSummary({ ...base, billingPlan: String(plan) }, Number(limit) + 1, now)).toMatchObject({ overLimit: true, readOnly: true });
  });
  it('mantiene los cuatro precios USD y convierte el cobro anual completo', () => {
    expect(Object.values(PLANS).map(plan => plan.users)).toEqual([3, 3, 5, 5]);
    expect(Object.values(PLANS).map(plan => plan.usd)).toEqual([22, 198, 87, 783]);
    expect(arsAmount(783, 1234.56)).toBe(966660.48);
    expect(arsAmount(22, 1200.55)).toBe(26412.1);
  });
  it('cobra al terminar la prueba y, si ya venció, cobra ahora', () => {
    expect(trialChargeStart(base.trialEndsAt, now)?.toISOString()).toBe('2026-02-07T10:00:00.000Z');
    expect(trialChargeStart(now, now)).toBeNull();
    expect(trialChargeStart(new Date(now.getTime() - 1), now)).toBeNull();
    expect(trialChargeStart(null, now)).toBeNull();
  });
  it('avisa uno o dos días antes del primer cobro y no antes', () => {
    const subscribed = { ...base, billingPlan: 'BASIC', billingPreapprovalId: 'pre-1', billingStatus: 'ACTIVE' };
    expect(billingSummary(subscribed, 1, now)).toMatchObject({ firstChargeAt: '2026-02-07T10:00:00.000Z', chargeReminder: false, readOnly: false, status: 'TRIAL' });
    expect(billingSummary(subscribed, 1, new Date('2026-02-06T10:00:00Z'))).toMatchObject({ chargeReminder: true, readOnly: false });
    expect(billingSummary(base, 1, now)).toMatchObject({ firstChargeAt: null, chargeReminder: false });
    expect(billingSummary({ ...subscribed, billingPaidThrough: new Date('2026-03-07T10:00:00Z') }, 1, now)).toMatchObject({ firstChargeAt: null, chargeReminder: false, status: 'ACTIVE' });
    expect(billingSummary({ ...subscribed, billingPlan: 'INTERNAL' }, 1, new Date('2026-02-06T10:00:00Z'))).toMatchObject({ firstChargeAt: null, chargeReminder: false, plan: 'INTERNAL' });
  });
  it.each([0, -1, NaN, Infinity])('rechaza cotización inválida %s', rate => expect(() => arsAmount(22, rate)).toThrow());
  it('suma meses calendario sin desbordar fin de mes ni año bisiesto', () => {
    expect(addMonths(now, 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(new Date('2024-02-29T10:00:00Z'), 12).toISOString()).toBe('2025-02-28T10:00:00.000Z');
  });
});
