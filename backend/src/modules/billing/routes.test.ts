import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, resolveAppUserMock, refreshBilling, reconcilePreapproval } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
  refreshBilling: vi.fn(),
  reconcilePreapproval: vi.fn(),
}));

vi.mock('../../middleware/authenticate.js', () => ({ authenticate: authenticateMock }));
vi.mock('../../middleware/resolve-app-user.js', () => ({ resolveAppUser: resolveAppUserMock }));
vi.mock('./service.js', () => ({
  billingDetails: vi.fn(), quoteCheckout: vi.fn(), openCheckout: vi.fn(), cancelSubscription: vi.fn(),
  reconcilePreapproval, reconcileInvoice: vi.fn(), refreshBilling,
}));

import { registerApiErrorHandler } from '../../lib/api-error.js';
import { billingRoutes, mercadoPagoWebhookRoutes } from './routes.js';

function signature(id: string, ts: number, secret = 'test-secret') {
  const hash = createHmac('sha256', secret).update(`id:${id};request-id:req;ts:${ts};`).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

async function buildApp() {
  const app = Fastify({ logger: false });
  registerApiErrorHandler(app);
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(mercadoPagoWebhookRoutes, { prefix: '/webhooks' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MP_WEBHOOK_SECRET', 'test-secret');
  authenticateMock.mockImplementation(async (request: { headers: { authorization?: string } }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) => {
    if (!request.headers.authorization?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Missing bearer token' });
  });
  resolveAppUserMock.mockImplementation(async (request: { headers: { 'x-test-role'?: string }; appUser?: unknown }) => {
    request.appUser = { userId: 'user-1', storeId: 'store-1', role: request.headers['x-test-role'] === 'STAFF' ? 'STAFF' : 'OWNER', sections: null, sensitiveAccess: null };
  });
  refreshBilling.mockResolvedValue({ plan: 'TRIAL', status: 'TRIAL' });
  reconcilePreapproval.mockResolvedValue(true);
});

describe('seguridad del checkout', () => {
  it('rechaza un webhook con firma inválida o vencida y no reconcilia', async () => {
    const app = await buildApp();
    const stale = Math.floor(Date.now() / 1000) - 600;
    const missing = await app.inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=pre-1', payload: { type: 'subscription_preapproval', data: { id: 'pre-1' } } });
    const forged = await app.inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=pre-1', headers: { 'x-request-id': 'req', 'x-signature': signature('pre-1', stale).replace(/[a-f]/, '0') }, payload: { type: 'subscription_preapproval', data: { id: 'pre-1' } } });
    const expired = await app.inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=pre-1', headers: { 'x-request-id': 'req', 'x-signature': signature('pre-1', stale) }, payload: { type: 'subscription_preapproval', data: { id: 'pre-1' }, status: 'authorized' } });
    expect([missing.statusCode, forged.statusCode, expired.statusCode]).toEqual([401, 401, 401]);
    expect(reconcilePreapproval).not.toHaveBeenCalled();
    await app.close();
  });

  it('acepta la misma notificación dos veces sin confiar en el estado del cuerpo', async () => {
    const app = await buildApp();
    const ts = Math.floor(Date.now() / 1000);
    const headers = { 'x-request-id': 'req', 'x-signature': signature('pre-1', ts) };
    const payload = { type: 'subscription_preapproval', data: { id: 'pre-1' }, status: 'authorized' };
    const first = await app.inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=pre-1', headers, payload });
    const second = await app.inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=pre-1', headers, payload });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(reconcilePreapproval).toHaveBeenCalledTimes(2);
    expect(reconcilePreapproval).toHaveBeenCalledWith('pre-1');
    await app.close();
  });

  it('el retorno ignora preapproval_id y status forjados y solo refresca la tienda del owner', async () => {
    const app = await buildApp();
    const headers = { authorization: 'Bearer test.owner' };
    const response = await app.inject({
      method: 'POST', url: '/api/billing/refresh?preapproval_id=forged&status=authorized', headers,
      payload: { preapproval_id: 'forged', status: 'authorized', id: 'forged' },
    });
    expect(response.statusCode).toBe(200);
    expect(refreshBilling).toHaveBeenCalledTimes(1);
    expect(refreshBilling).toHaveBeenCalledWith('store-1');
    const staff = await app.inject({ method: 'POST', url: '/api/billing/refresh', headers: { ...headers, 'x-test-role': 'STAFF' } });
    expect(staff.statusCode).toBe(403);
    const anon = await app.inject({ method: 'POST', url: '/api/billing/checkout', payload: { quoteId: 'chk-1' } });
    expect(anon.statusCode).toBe(401);
    expect(refreshBilling).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
