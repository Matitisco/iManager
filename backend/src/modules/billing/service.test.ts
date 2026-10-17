import { beforeEach, describe, expect, it, vi } from 'vitest';

type Checkout = {
  id: string; storeId: string; planKey: string; providerPlanId: string; payerEmail: string;
  amountArs: number; openedAt: Date | null; checkoutStatus: string; providerSubscriptionId: string | null; createdAt: Date;
  expiresAt: Date;
};
type StoreRow = {
  id: string; billingPlan: string; billingStatus: string; trialEndsAt: Date | null; billingPaidThrough: Date | null;
  billingPeriod: string | null; billingPreapprovalId: string | null; billingPayerEmail: string | null; billingRemoteUpdatedAt: Date | null;
};

const harness = vi.hoisted(() => {
  const state = {
    checkouts: [] as Checkout[],
    store: null as StoreRow | null,
    plan: null as { key: string; providerId: string; amountArs: number } | null,
    storeUpdates: 0,
  };
  function matches(row: Checkout, where: Record<string, unknown>) {
    if (typeof where.id === 'string' && where.id !== row.id) return false;
    if (where.id && typeof where.id === 'object' && (where.id as { not?: string }).not === row.id) return false;
    if (typeof where.storeId === 'string' && where.storeId !== row.storeId) return false;
    if (typeof where.providerSubscriptionId === 'string' && where.providerSubscriptionId !== row.providerSubscriptionId) return false;
    if (typeof where.providerPlanId === 'string' && where.providerPlanId !== row.providerPlanId) return false;
    if (where.openedAt && typeof where.openedAt === 'object' && (where.openedAt as { not?: unknown }).not === null && row.openedAt === null) return false;
    if (typeof where.checkoutStatus === 'string' && where.checkoutStatus !== row.checkoutStatus) return false;
    if (where.checkoutStatus && typeof where.checkoutStatus === 'object') {
      const list = (where.checkoutStatus as { in?: string[] }).in;
      if (list && !list.includes(row.checkoutStatus)) return false;
    }
    if (Array.isArray(where.OR)) {
      const ok = (where.OR as Record<string, unknown>[]).some(branch => {
        if ('providerSubscriptionId' in branch) return branch.providerSubscriptionId === row.providerSubscriptionId;
        if ('id' in branch) return branch.id === row.id;
        return false;
      });
      if (!ok) return false;
    }
    return true;
  }
  const prisma = {
    state,
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    store: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.store?.id === where.id ? state.store : null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (state.store?.id !== where.id) throw new Error('missing store');
        return state.store;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.storeUpdates += 1;
        Object.assign(state.store!, data);
        return state.store;
      }),
    },
    storeMember: { count: vi.fn(async () => 1) },
    billingPlan: {
      findUnique: vi.fn(async ({ where }: { where: { key?: string; providerId?: string } }) => {
        if (!state.plan) return null;
        if (where.key && where.key !== state.plan.key) return null;
        if (where.providerId && where.providerId !== state.plan.providerId) return null;
        return state.plan;
      }),
      findUniqueOrThrow: vi.fn(async (args: { where: { key?: string; providerId?: string } }) => {
        const row = await prisma.billingPlan.findUnique(args);
        if (!row) throw new Error('missing plan');
        return row;
      }),
      findMany: vi.fn(async () => []),
    },
    billingCheckout: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => state.checkouts.find(row => matches(row, where)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => state.checkouts.filter(row => matches(row, where))),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.checkouts.find(item => item.id === where.id);
        if (!row) throw new Error('missing checkout');
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = state.checkouts.filter(row => matches(row, where));
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
      }),
    },
  };
  return { prisma, getRemoteSubscription: vi.fn(), mpRequest: vi.fn() };
});

vi.mock('../../plugins/prisma.js', () => ({ prisma: harness.prisma }));
vi.mock('./mercadopago.js', async () => {
  const actual = await vi.importActual<typeof import('./mercadopago.js')>('./mercadopago.js');
  return { ...actual, getRemoteSubscription: harness.getRemoteSubscription, mpRequest: harness.mpRequest };
});

import { openCheckout, reconcilePreapproval, refreshBilling } from './service.js';

const planRemote = {
  id: 'plan-1', init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan-1',
  auto_recurring: { transaction_amount: 22000, currency_id: 'ARS', frequency: 1, frequency_type: 'months' },
};
function remote(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'pre-1', preapproval_plan_id: 'plan-1', external_reference: 'chk-1', payer_email: null as string | null,
    status: 'authorized', init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=pre-1',
    last_modified: now.toISOString(), date_created: new Date(now.getTime() - 1000).toISOString(),
    auto_recurring: { currency_id: 'ARS', frequency: 1, frequency_type: 'months', transaction_amount: 22000 },
    summarized: { charged_quantity: 1, last_charged_date: now.toISOString() },
    ...overrides,
  };
}
function seed(overrides: Partial<Checkout> = {}) {
  const store: StoreRow = {
    id: 'store-1', billingPlan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 86_400_000),
    billingPaidThrough: null, billingPeriod: null, billingPreapprovalId: null, billingPayerEmail: null, billingRemoteUpdatedAt: null,
  };
  const checkout: Checkout = {
    id: 'chk-1', storeId: 'store-1', planKey: 'BASIC_MONTHLY', providerPlanId: 'plan-1', payerEmail: 'buyer@example.com',
    amountArs: 22000, openedAt: new Date(), checkoutStatus: 'CREATED', providerSubscriptionId: 'pre-1', createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000), ...overrides,
  };
  harness.prisma.state.store = store;
  harness.prisma.state.plan = { key: 'BASIC_MONTHLY', providerId: 'plan-1', amountArs: 22000 };
  harness.prisma.state.checkouts = [checkout];
  harness.prisma.state.storeUpdates = 0;
  return { store, checkout };
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(harness.prisma));
});

describe('reconciliación de suscripciones', () => {
  it.each([null, ''])('vincula el intento por providerSubscriptionId aunque payer_email sea %s', async email => {
    const { store } = seed();
    harness.getRemoteSubscription.mockResolvedValue(remote({ payer_email: email }));
    await expect(reconcilePreapproval('pre-1', 'store-1')).resolves.toBe(true);
    expect(store.billingPreapprovalId).toBe('pre-1');
    expect(store.billingPlan).toBe('BASIC');
    expect(store.billingPayerEmail).toBe('buyer@example.com');
  });

  it('un intento nuevo cancelado queda FAILED y no toca la tienda', async () => {
    const { store, checkout } = seed({ providerSubscriptionId: null, checkoutStatus: 'CREATED' });
    harness.getRemoteSubscription.mockResolvedValue(remote({ status: 'cancelled', payer_email: null, summarized: undefined }));
    await expect(reconcilePreapproval('pre-1', 'store-1')).resolves.toBe(true);
    expect(checkout.checkoutStatus).toBe('FAILED');
    expect(checkout.providerSubscriptionId).toBe('pre-1');
    expect((checkout as { providerStatus?: string }).providerStatus).toBe('cancelled');
    expect(store.billingPreapprovalId).toBeNull();
    expect(harness.prisma.state.storeUpdates).toBe(0);
  });

  it('el checkout de un preapproval cancelado responde 402 y libera el intento', async () => {
    const { store, checkout } = seed({ openedAt: null, checkoutStatus: 'QUOTED', providerSubscriptionId: null });
    const created = remote({ status: 'cancelled', payer_email: '', summarized: undefined });
    harness.mpRequest.mockImplementation(async (path: string, method = 'GET') => {
      if (path.startsWith('/preapproval_plan/')) return planRemote;
      if (path === '/preapproval' && method === 'POST') return created;
      throw new Error(`unexpected ${method} ${path}`);
    });
    harness.getRemoteSubscription.mockResolvedValue(created);
    await expect(openCheckout('store-1', 'chk-1')).rejects.toMatchObject({
      statusCode: 402,
      message: 'Mercado Pago canceló la suscripción. Volvé a intentarlo.',
    });
    expect(checkout.checkoutStatus).toBe('FAILED');
    expect(store.billingPlan).toBe('TRIAL');
    expect(store.billingPreapprovalId).toBeNull();
    const post = harness.mpRequest.mock.calls.find(call => call[0] === '/preapproval' && call[1] === 'POST');
    expect(post?.[2]).toEqual({
      reason: 'iManager Básico mensual',
      external_reference: 'chk-1',
      payer_email: 'buyer@example.com',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 22000, currency_id: 'ARS', start_date: store.trialEndsAt!.toISOString() },
      back_url: 'http://127.0.0.1:3000/#/plan',
      status: 'pending',
    });
    expect(post?.[2]).not.toHaveProperty('preapproval_plan_id');
    expect(post?.[2]).not.toHaveProperty('card_token_id');
  });

  it('activa un preapproval sin plan asociado cuando el importe coincide con la cotización', async () => {
    const { store } = seed();
    harness.getRemoteSubscription.mockResolvedValue(remote({ preapproval_plan_id: undefined }));
    await expect(reconcilePreapproval('pre-1', 'store-1')).resolves.toBe(true);
    expect(store.billingPreapprovalId).toBe('pre-1');
    expect(store.billingPlan).toBe('BASIC');
  });

  it('no activa un preapproval sin plan si el importe no es el cotizado', async () => {
    const { store } = seed();
    harness.getRemoteSubscription.mockResolvedValue(remote({
      preapproval_plan_id: undefined,
      auto_recurring: { currency_id: 'ARS', frequency: 1, frequency_type: 'months', transaction_amount: 1 },
    }));
    await expect(reconcilePreapproval('pre-1', 'store-1')).resolves.toBe(false);
    expect(store.billingPreapprovalId).toBeNull();
    expect(harness.prisma.state.storeUpdates).toBe(0);
  });

  it('refresh libera un intento viejo sin suscripción en Mercado Pago', async () => {
    const { checkout } = seed({
      providerSubscriptionId: null, checkoutStatus: 'CREATING', openedAt: new Date(Date.now() - 3 * 60_000),
      createdAt: new Date(Date.now() - 3 * 60_000),
    });
    harness.mpRequest.mockResolvedValue({ results: [] });
    await refreshBilling('store-1');
    expect(checkout.checkoutStatus).toBe('FAILED');
    const urls = harness.mpRequest.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('external_reference=chk-1'))).toBe(true);
    expect(urls.some(url => url.includes('payer_email') || url.includes('forged'))).toBe(false);
  });
});
