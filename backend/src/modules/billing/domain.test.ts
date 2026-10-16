import { describe, expect, it } from 'vitest';
import { addMonths, arsAmount, billingSummary, PLANS, trialData, type BillingStore } from './domain.js';

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
  it.each([['BASIC', 3], ['BUSINESS', 5], ['TRIAL', 5]])('limita %s a %s incluyendo al propietario', (plan, limit) => {
    expect(billingSummary({ ...base, billingPlan: String(plan) }, Number(limit), now)).toMatchObject({ overLimit: false, readOnly: false, memberLimit: limit });
    expect(billingSummary({ ...base, billingPlan: String(plan) }, Number(limit) + 1, now)).toMatchObject({ overLimit: true, readOnly: true });
  });
  it('mantiene los cuatro precios USD y convierte el cobro anual completo', () => {
    expect(Object.values(PLANS).map(plan => plan.users)).toEqual([3, 3, 5, 5]);
    expect(Object.values(PLANS).map(plan => plan.usd)).toEqual([22, 198, 87, 783]);
    expect(arsAmount(783, 1234.56)).toBe(966660.48);
    expect(arsAmount(22, 1200.55)).toBe(26412.1);
  });
  it.each([0, -1, NaN, Infinity])('rechaza cotización inválida %s', rate => expect(() => arsAmount(22, rate)).toThrow());
  it('suma meses calendario sin desbordar fin de mes ni año bisiesto', () => {
    expect(addMonths(now, 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(new Date('2024-02-29T10:00:00Z'), 12).toISOString()).toBe('2025-02-28T10:00:00.000Z');
  });
});
