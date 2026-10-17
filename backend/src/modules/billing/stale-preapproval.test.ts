import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../lib/domain-error.js';
import { MPRejectedRequest } from './mercadopago.js';

type Row = {
  id: string; billingPlan: string; billingStatus: string; billingPreapprovalId: string | null;
  billingPayerEmail: string | null; billingPaidThrough: Date | null; billingPeriod: string | null;
  billingRemoteUpdatedAt: Date | null; trialEndsAt: Date | null;
};

const state = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock('../../plugins/prisma.js', () => {
  const row = (id: string) => state.rows.find(item => item.id === id) ?? null;
  const prisma = {
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    store: {
      findMany: vi.fn(async () => state.rows
        .filter(item => item.billingPlan !== 'INTERNAL' && item.billingPreapprovalId)
        .map(item => ({ id: item.id, billingPreapprovalId: item.billingPreapprovalId }))),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => row(where.id)),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const found = row(where.id);
        if (!found) throw new Error('missing store');
        return found;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const found = row(where.id);
        if (!found) throw new Error('missing store');
        Object.assign(found, data);
        return found;
      }),
    },
    storeMember: { count: vi.fn(async () => 1) },
    billingCheckout: { findFirst: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 0 })) },
    billingPlan: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  };
  return { prisma };
});

vi.mock('./mercadopago.js', async () => {
  const actual = await vi.importActual<typeof import('./mercadopago.js')>('./mercadopago.js');
  return { ...actual, getRemoteSubscription: vi.fn(), mpRequest: vi.fn() };
});

import { getRemoteSubscription } from './mercadopago.js';
import { reconcileSubscriptions, refreshBilling } from './service.js';

const remoteOf = getRemoteSubscription as unknown as ReturnType<typeof vi.fn>;

function store(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id, billingPlan: 'BASIC', billingStatus: 'ACTIVE', billingPreapprovalId: `pre-${id}`,
    billingPayerEmail: 'buyer@example.com', billingPaidThrough: new Date(Date.now() + 86_400_000),
    billingPeriod: 'MONTHLY', billingRemoteUpdatedAt: new Date(), trialEndsAt: new Date(Date.now() - 86_400_000),
    ...overrides,
  };
}
function stale(message = 'the preapprovalId is not valid for callerId') {
  return new MPRejectedRequest('No pudimos consultar Mercado Pago. Reintentá en unos minutos.', 502, { status: 400, message, causes: [] });
}

beforeEach(() => {
  state.rows = [];
  remoteOf.mockReset();
});

describe('preapproval de otro vendedor', () => {
  it('libera cada tienda obsoleta y no frena al resto', async () => {
    state.rows = [
      store('stuck', { billingPreapprovalId: 'old-1' }),
      store('down', { billingPreapprovalId: 'pre-down' }),
      store('later', { billingPreapprovalId: 'pre-ok' }),
      store('internal', { billingPlan: 'INTERNAL', billingPreapprovalId: 'pre-internal', billingPayerEmail: 'internal@example.com' }),
    ];
    remoteOf.mockImplementation(async (id: string) => {
      if (id === 'old-1') throw stale('the preapprovalId is not valid for callerId buyer@example.com');
      if (id === 'pre-down') throw new DomainError('No pudimos consultar Mercado Pago. Reintentá en unos minutos.', 502, { status: 503, message: 'unavailable', causes: [] });
      return { id, external_reference: '', payer_email: null, status: 'cancelled', preapproval_plan_id: undefined, init_point: null, last_modified: new Date().toISOString(), date_created: new Date().toISOString(), auto_recurring: { currency_id: 'ARS', frequency: 1, frequency_type: 'months', transaction_amount: 22000 } };
    });
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(reconcileSubscriptions(log)).rejects.toMatchObject({ logContext: { status: 503 } });
    expect(state.rows.find(item => item.id === 'stuck')).toMatchObject({ billingPreapprovalId: null, billingStatus: 'EXPIRED' });
    expect(state.rows.find(item => item.id === 'stuck')?.billingPaidThrough!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(state.rows.find(item => item.id === 'down')?.billingPreapprovalId).toBe('pre-down');
    expect(state.rows.find(item => item.id === 'internal')).toMatchObject({ billingPlan: 'INTERNAL', billingPreapprovalId: 'pre-internal' });
    expect(remoteOf.mock.calls.map(call => call[0])).toContain('pre-ok');
    expect(log.info).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith('Suscripción de otro vendedor descartada para la tienda stuck.');
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('buyer@example.com');
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('internal@example.com');
  });

  it('refresh deja la tienda vencida y no toca un plan interno', async () => {
    state.rows = [
      store('qa', { billingPreapprovalId: 'old-qa' }),
      store('internal', { billingPlan: 'INTERNAL', billingPreapprovalId: 'pre-internal' }),
    ];
    remoteOf.mockImplementation(async (id: string) => {
      if (id === 'old-qa') throw new MPRejectedRequest('No pudimos consultar Mercado Pago. Reintentá en unos minutos.', 502, { status: 404, message: 'not found', causes: [] });
      throw new Error(`unexpected ${id}`);
    });
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(refreshBilling('qa', log)).resolves.toMatchObject({ status: 'EXPIRED', canCancel: false, plan: 'BASIC' });
    expect(state.rows.find(item => item.id === 'qa')?.billingPreapprovalId).toBeNull();
    expect(log.info).toHaveBeenCalledWith('Suscripción de otro vendedor descartada para la tienda qa.');
    await refreshBilling('internal', log);
    expect(state.rows.find(item => item.id === 'internal')?.billingPreapprovalId).toBe('pre-internal');
    expect(remoteOf.mock.calls.map(call => call[0])).not.toContain('pre-internal');
  });
});
