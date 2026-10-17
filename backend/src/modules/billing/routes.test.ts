import { createHmac } from 'node:crypto';
import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateMock, resolveAppUserMock, refreshBilling, reconcilePreapproval, openCheckout } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
  refreshBilling: vi.fn(),
  reconcilePreapproval: vi.fn(),
  openCheckout: vi.fn(),
}));

vi.mock('../../middleware/authenticate.js', () => ({ authenticate: authenticateMock }));
vi.mock('../../middleware/resolve-app-user.js', () => ({ resolveAppUser: resolveAppUserMock }));
vi.mock('./service.js', () => ({
  billingDetails: vi.fn(), quoteCheckout: vi.fn(), openCheckout, cancelSubscription: vi.fn(),
  reconcilePreapproval, reconcileInvoice: vi.fn(), refreshBilling,
}));

import { registerApiErrorHandler } from '../../lib/api-error.js';
import { DomainError } from '../../lib/domain-error.js';
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

  it('sin secreto rechaza el webhook, avisa y no reconcilia', async () => {
    vi.stubEnv('MP_WEBHOOK_SECRET', '  ');
    const lines: string[] = [];
    const app = Fastify({ logger: { level: 'warn', stream: new Writable({ write(chunk, _encoding, callback) { lines.push(String(chunk)); callback(); } }) } });
    registerApiErrorHandler(app);
    await app.register(mercadoPagoWebhookRoutes, { prefix: '/webhooks' });
    const response = await app.inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=pre-1', payload: { type: 'subscription_preapproval', data: { id: 'pre-1' }, status: 'authorized' } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Firma inválida.' });
    expect(reconcilePreapproval).not.toHaveBeenCalled();
    expect(lines.join('\n')).toContain('MP_WEBHOOK_SECRET is missing');
    expect(lines.join('\n')).not.toContain('Bearer');
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
    expect(refreshBilling).toHaveBeenCalledWith('store-1', console, { replaceAbandoned: false });
    const replace = await app.inject({ method: 'POST', url: '/api/billing/refresh', headers, payload: { replaceAbandoned: true, preapproval_id: 'forged' } });
    expect(replace.statusCode).toBe(200);
    expect(refreshBilling).toHaveBeenLastCalledWith('store-1', console, { replaceAbandoned: true });
    const staff = await app.inject({ method: 'POST', url: '/api/billing/refresh', headers: { ...headers, 'x-test-role': 'STAFF' } });
    expect(staff.statusCode).toBe(403);
    const anon = await app.inject({ method: 'POST', url: '/api/billing/checkout', payload: { quoteId: 'chk-1' } });
    expect(anon.statusCode).toBe(401);
    expect(refreshBilling).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('el checkout devuelve el error de Mercado Pago para el modal y registra la configuración sin el email', async () => {
    const lines: string[] = [];
    const app = Fastify({ logger: { level: 'info', stream: new Writable({ write(chunk, _encoding, callback) { lines.push(String(chunk)); callback(); } }) } });
    registerApiErrorHandler(app);
    await app.register(billingRoutes, { prefix: '/api/billing' });
    openCheckout.mockRejectedValueOnce(new DomainError(
      'Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.',
      402,
      { kind: 'provider', status: 400, message: 'Both payer and collector must be real or test users. payer [redacted-email]', causes: [] },
    ));
    const rejected = await app.inject({
      method: 'POST', url: '/api/billing/checkout', headers: { authorization: 'Bearer test.owner' }, payload: { quoteId: 'chk-1' },
    });
    expect(rejected.statusCode).toBe(402);
    expect(rejected.json()).toEqual({ error: 'Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.' });
    expect(rejected.body).not.toContain('tarjeta');
    expect(rejected.body).not.toContain('@');
    openCheckout.mockRejectedValueOnce(new DomainError(
      'La facturación no está disponible en este momento. Contactá a iManager.',
      503,
      { kind: 'config', status: 401, message: 'invalid access token [redacted]', causes: [] },
    ));
    const config = await app.inject({
      method: 'POST', url: '/api/billing/checkout', headers: { authorization: 'Bearer test.owner' }, payload: { quoteId: 'chk-1' },
    });
    expect(config.statusCode).toBe(503);
    expect(config.json()).toEqual({ error: 'La facturación no está disponible en este momento. Contactá a iManager.' });
    const logged = lines.join('\n');
    expect(logged).toContain('billing config error');
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain('buyer@example.com');
    expect(logged).not.toContain('test-placeholder');
    expect(logged).not.toContain('tarjeta');
    await app.close();
  });
});
