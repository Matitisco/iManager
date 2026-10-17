import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../lib/domain-error.js';
import { mockMercadoPago } from '../../test/billing-http.js';

type Plan = { key: string; sellerId: string; providerId: string; initPoint: string; amountArs: number; exchangeRate: number };
type Checkout = { id: string; checkoutStatus: string; payerEmail: string };
type Store = { id: string; billingPlan: string; billingPreapprovalId: string | null; billingPayerEmail: string | null };

const state = vi.hoisted(() => ({
  plans: [] as Plan[],
  checkouts: [] as Checkout[],
  stores: [] as Store[],
  storeUpdates: 0,
}));

vi.mock('../../plugins/prisma.js', () => {
  const prisma = {
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    billingPlan: {
      findMany: vi.fn(async () => state.plans.map(plan => ({ sellerId: plan.sellerId, key: plan.key }))),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => state.plans.find(plan => plan.key === where.key) ?? null),
      deleteMany: vi.fn(async ({ where }: { where: { sellerId: { not: string } } }) => {
        const kept = state.plans.filter(plan => plan.sellerId === where.sellerId.not);
        const count = state.plans.length - kept.length;
        state.plans = kept;
        return { count };
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { key: string }; create: Plan; update: Partial<Plan> }) => {
        const current = state.plans.find(plan => plan.key === where.key);
        if (current) Object.assign(current, update);
        else state.plans.push({ ...create });
        return state.plans.find(plan => plan.key === where.key);
      }),
    },
    billingCheckout: {
      updateMany: vi.fn(async ({ where, data }: { where: { checkoutStatus: { in: string[] } }; data: Partial<Checkout> }) => {
        const rows = state.checkouts.filter(row => where.checkoutStatus.in.includes(row.checkoutStatus));
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
      }),
    },
    store: {
      count: vi.fn(async ({ where }: { where: { billingPlan: { not: string }; billingPreapprovalId: { not: null } } }) => (
        state.stores.filter(store => store.billingPlan !== where.billingPlan.not && store.billingPreapprovalId !== null).length
      )),
      update: vi.fn(async () => { state.storeUpdates += 1; return null; }),
    },
  };
  return { prisma };
});

import { syncFailureLine, syncPlans } from './service.js';

let mp: ReturnType<typeof mockMercadoPago>;
beforeEach(() => {
  state.plans = [];
  state.checkouts = [];
  state.stores = [];
  state.storeUpdates = 0;
  mp = mockMercadoPago();
});

describe('sincronización ante un cambio de vendedor', () => {
  it('recrea los planes del vendedor nuevo y falla solo los checkouts abiertos', async () => {
    const quiet = { info: vi.fn(), warn: vi.fn() };
    await syncPlans(quiet);
    expect(quiet.info).not.toHaveBeenCalled();
    expect(state.plans).toHaveLength(4);
    expect(state.plans.every(plan => plan.sellerId === '123')).toBe(true);
    const previous = state.plans.map(plan => plan.providerId);
    state.checkouts = [
      { id: 'quoted', checkoutStatus: 'QUOTED', payerEmail: 'buyer@example.com' },
      { id: 'creating', checkoutStatus: 'CREATING', payerEmail: 'buyer@example.com' },
      { id: 'created', checkoutStatus: 'CREATED', payerEmail: 'buyer@example.com' },
      { id: 'resolved', checkoutStatus: 'RESOLVED', payerEmail: 'buyer@example.com' },
    ];
    state.stores = [
      { id: 'trial', billingPlan: 'TRIAL', billingPreapprovalId: 'pre-old', billingPayerEmail: 'buyer@example.com' },
      { id: 'internal', billingPlan: 'INTERNAL', billingPreapprovalId: 'pre-internal', billingPayerEmail: 'internal@example.com' },
      { id: 'plain', billingPlan: 'TRIAL', billingPreapprovalId: null, billingPayerEmail: null },
    ];
    await syncPlans(quiet);
    expect(quiet.info).not.toHaveBeenCalled();
    expect(state.checkouts.find(row => row.id === 'quoted')?.checkoutStatus).toBe('QUOTED');
    expect(state.plans.map(plan => plan.providerId)).toEqual(previous);

    mp.seller(999);
    const log = { info: vi.fn(), warn: vi.fn() };
    const synced = await syncPlans(log);
    expect(synced).toHaveLength(4);
    expect(state.plans.map(plan => plan.sellerId)).toEqual(['999', '999', '999', '999']);
    expect(state.plans.map(plan => plan.providerId).every(id => !previous.includes(id))).toBe(true);
    expect(mp.calls.filter(call => call.method === 'POST' && call.path === '/preapproval_plan')).toHaveLength(8);
    expect(state.checkouts.map(row => row.checkoutStatus)).toEqual(['FAILED', 'FAILED', 'FAILED', 'RESOLVED']);
    expect(state.storeUpdates).toBe(0);
    expect(log.info).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith('Vendedor de MP cambió: planes recreados para el vendedor nuevo (4)');
    expect(log.warn).toHaveBeenCalledWith('Suscripciones vigentes de otro vendedor: 1 tiendas no internas.');
    const logged = JSON.stringify([log.info.mock.calls, log.warn.mock.calls]);
    expect(logged).not.toContain('buyer@example.com');
    expect(logged).not.toContain('internal@example.com');
    expect(logged).not.toContain('test-placeholder');
    expect(logged).not.toContain('999');
  });

  it('no anuncia el cambio si Mercado Pago rechaza la recreación', async () => {
    await syncPlans();
    mp.seller(999);
    mp.failOn('POST /preapproval_plan', 400, 'invalid plan test-placeholder buyer@example.com');
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(syncPlans(log)).rejects.toMatchObject({ logContext: { status: 400 } });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('la línea de fallo incluye estado y mensaje sin token ni email', () => {
    const line = syncFailureLine(new DomainError('oculto', 502, {
      status: 401,
      message: 'invalid access token test-placeholder buyer@example.com',
    }));
    expect(line).toBe('No se pudo sincronizar facturación. Mercado Pago respondió 401: invalid access token [redacted] [redacted-email]');
    expect(line).not.toContain('test-placeholder');
    expect(line).not.toContain('buyer@example.com');
    expect(syncFailureLine(new Error('socket'))).toBe('No se pudo sincronizar facturación. Revisá configuración y conectividad y reintentá.');
  });
});
