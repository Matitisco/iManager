import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { useIntegrationApp } from './integration-helpers.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { mockMercadoPago } from './billing-http.js';
import { refreshBilling, syncFailureLine, syncPlans, reconcileSubscriptions } from '../modules/billing/service.js';
import * as blue from '../lib/blue-rate.js';

const { getApp } = useIntegrationApp();
let mp: ReturnType<typeof mockMercadoPago>;
beforeEach(() => { mp = mockMercadoPago(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const headers = () => buildAuthHeaders();
async function trial() {
  const context = await seedStoreContext();
  await prisma.store.update({ where: { id: context.store!.id }, data: { billingPlan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 7 * 86_400_000) } });
  return context.store!.id;
}
async function opened(key = 'BASIC_MONTHLY') {
  const storeId = await trial(); await syncPlans();
  const quote = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key, payerEmail: 'buyer@example.com' } });
  expect(quote.statusCode).toBe(200);
  // A previously confirmed intention for webhook tests, without creating a remote contract.
  await prisma.billingCheckout.update({ where: { id: quote.json().id }, data: { openedAt: new Date() } });
  const planId = (await prisma.billingPlan.findUniqueOrThrow({ where: { key } })).providerId;
  return { storeId, planId, quote: quote.json() };
}
function subscription(storeId: string, planId: string, quoteId: string, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const remote = { id: 'subscription-1', external_reference: quoteId, preapproval_plan_id: planId, payer_email: 'buyer@example.com', status: 'authorized', date_created: new Date(now.getTime() - 1000).toISOString(), last_modified: now.toISOString(), auto_recurring: { currency_id: 'ARS', frequency: 1, frequency_type: 'months', transaction_amount: 22000 }, summarized: { charged_quantity: 1, last_charged_date: now.toISOString() }, ...overrides };
  mp.subscriptions.set(String(remote.id), remote); return remote;
}
function signedWebhook(id: string) {
  const ts = Math.floor(Date.now() / 1000);
  const hash = createHmac('sha256', 'test-secret').update(`id:${id.toLowerCase()};request-id:req;ts:${ts};`).digest('hex');
  return `ts=${ts},v1=${hash}`;
}
const webhook = (id = 'subscription-1', extra: Record<string, unknown> = {}, signed = true) => getApp().inject({
  method: 'POST', url: `/webhooks/mercadopago?data.id=${encodeURIComponent(id)}`,
  headers: signed ? { 'x-request-id': 'req', 'x-signature': signedWebhook(id) } : undefined,
  payload: { type: 'subscription_preapproval', data: { id }, ...extra },
});

describe('suscripciones con HTTP de Mercado Pago simulado', () => {
  it('db push defaults deja las tiendas y cuentas existentes internas sin bloqueo ni límite', async () => {
    const { store } = await seedStoreContext();
    const response = await getApp().inject({ url: '/api/me', headers: headers() });
    expect(response.json().billing).toMatchObject({ plan: 'INTERNAL', readOnly: false, memberLimit: null });
    expect((await prisma.user.findFirstOrThrow()).billingLegacy).toBe(true);
    const quote = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(quote.statusCode).toBe(409); expect(mp.calls).toHaveLength(0);
    expect(store?.billingPlan).toBe('INTERNAL');
  });
  it('ambas altas de tienda dan siete días solo a las cuentas nuevas y preservan legacy sin tienda', async () => {
    for (const [uid, path] of [['new-store', '/api/stores'], ['new-onboarding', '/api/onboarding']]) {
      const h = buildAuthHeaders({ uid });
      const response = await getApp().inject({ method: 'POST', url: path, headers: h, payload: path.includes('onboarding') ? { storeName: 'Nueva' } : { name: 'Nueva' } });
      expect(response.statusCode, response.body).toBeLessThan(300);
      const session = await getApp().inject({ url: '/api/me', headers: h });
      expect(session.json().billing).toMatchObject({ plan: 'TRIAL', trialDaysLeft: 7, memberLimit: 3 });
    }
    await seedStoreContext({ createStore: false });
    await getApp().inject({ method: 'POST', url: '/api/stores', headers: headers(), payload: { name: 'Anterior' } });
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing.plan).toBe('INTERNAL');
  });
  it('crea exactamente cuatro planes ARS sin free_trial e idempotentes bajo concurrencia', async () => {
    await Promise.all([syncPlans(), syncPlans()]);
    expect(mp.calls.filter(call => call.path === '/preapproval_plan' && call.method === 'POST')).toHaveLength(4);
    expect((await prisma.billingPlan.findMany({ orderBy: { key: 'asc' } })).map(plan => Number(plan.amountArs))).toEqual([198000, 22000, 783000, 87000]);
    for (const call of mp.calls.filter(call => call.method === 'POST')) expect(call.body.auto_recurring).not.toHaveProperty('free_trial');
    const ids = [...mp.plans.keys()];
    vi.spyOn(blue, 'currentBlueRate').mockResolvedValue(1500);
    await syncPlans(); expect([...mp.plans.keys()]).toEqual(ids);
    expect(Number((await prisma.billingPlan.findUniqueOrThrow({ where: { key: 'BASIC_MONTHLY' } })).amountArs)).toBe(33000);
  });
  it('recupera un alta remota cuando la transacción anterior no llegó a persistir el ID', async () => {
    mp.failOn('PUT /preapproval_plan/plan-1');
    await expect(syncPlans()).rejects.toMatchObject({ statusCode: 502 });
    expect(await prisma.billingPlan.count()).toBe(0);
    mp.failOn(''); await syncPlans();
    expect(mp.plans.size).toBe(4); expect(await prisma.billingPlan.count()).toBe(4);
  });
  it('recrea los planes cuando cambia el vendedor y no modifica las tiendas', async () => {
    const storeId = await trial();
    await prisma.store.update({ where: { id: storeId }, data: { billingPreapprovalId: 'pre-old', billingPayerEmail: 'buyer@example.com' } });
    const internal = await seedStoreContext({ firebaseUid: 'internal-owner', email: 'internal@example.com' });
    await prisma.store.update({ where: { id: internal.store!.id }, data: { billingPreapprovalId: 'pre-internal', billingPayerEmail: 'internal@example.com' } });
    await syncPlans();
    const previous = await prisma.billingPlan.findMany({ orderBy: { key: 'asc' } });
    expect(previous.map(plan => plan.sellerId)).toEqual(['123', '123', '123', '123']);
    const quote = {
      storeId, planKey: 'BASIC_MONTHLY', providerPlanId: previous[0]!.providerId, payerEmail: 'buyer@example.com',
      amountArs: 22000, exchangeRate: 1000, expiresAt: new Date(Date.now() + 60_000),
    };
    const rows = await Promise.all(['QUOTED', 'CREATING', 'CREATED', 'RESOLVED'].map(checkoutStatus => prisma.billingCheckout.create({
      data: { ...quote, checkoutStatus, ...(checkoutStatus === 'QUOTED' ? {} : { openedAt: new Date() }) },
    })));
    const same = { info: vi.fn(), warn: vi.fn() };
    await syncPlans(same);
    expect(same.info).not.toHaveBeenCalled();
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: rows[0]!.id } })).checkoutStatus).toBe('QUOTED');
    expect((await prisma.billingPlan.findMany({ orderBy: { key: 'asc' } })).map(plan => plan.providerId)).toEqual(previous.map(plan => plan.providerId));

    mp.seller(999);
    const log = { info: vi.fn(), warn: vi.fn() };
    expect(await syncPlans(log)).toHaveLength(4);
    const next = await prisma.billingPlan.findMany({ orderBy: { key: 'asc' } });
    expect(next.map(plan => plan.sellerId)).toEqual(['999', '999', '999', '999']);
    const oldIds = new Set(previous.map(plan => plan.providerId));
    expect(next.every(plan => !oldIds.has(plan.providerId))).toBe(true);
    expect(mp.calls.filter(call => call.method === 'POST' && call.path === '/preapproval_plan')).toHaveLength(8);
    const statuses = await Promise.all(rows.map(row => prisma.billingCheckout.findUniqueOrThrow({ where: { id: row.id } })));
    expect(statuses.map(row => row.checkoutStatus)).toEqual(['FAILED', 'FAILED', 'FAILED', 'RESOLVED']);
    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(store).toMatchObject({ billingPlan: 'TRIAL', billingPreapprovalId: 'pre-old', billingPayerEmail: 'buyer@example.com' });
    expect(await prisma.store.findUniqueOrThrow({ where: { id: internal.store!.id } })).toMatchObject({ billingPlan: 'INTERNAL', billingPreapprovalId: 'pre-internal', billingPayerEmail: 'internal@example.com' });
    expect(log.info).toHaveBeenCalledWith('Vendedor de MP cambió: planes recreados para el vendedor nuevo (4)');
    expect(log.warn).toHaveBeenCalledWith('Suscripciones vigentes de otro vendedor: 1 tiendas no internas.');
    const logged = JSON.stringify([log.info.mock.calls, log.warn.mock.calls]);
    expect(logged).not.toContain('buyer@example.com');
    expect(logged).not.toContain('internal@example.com');
    expect(logged).not.toContain('test-placeholder');
  });
  it('descarta preapprovals de otro vendedor y sigue con las demás tiendas', async () => {
    async function stuck(preapprovalId: string, firebaseUid: string, email: string) {
      const context = await seedStoreContext({ firebaseUid, email });
      const id = context.store!.id;
      await prisma.store.update({ where: { id }, data: {
        billingPlan: 'BASIC', billingStatus: 'ACTIVE', billingPeriod: 'MONTHLY', billingPreapprovalId: preapprovalId,
        billingPayerEmail: email, billingPaidThrough: new Date(Date.now() + 86_400_000), trialEndsAt: new Date(Date.now() - 86_400_000),
      } });
      return id;
    }
    const caller = await stuck('old-caller', 'owner-a', 'buyer@example.com');
    const missing = await stuck('missing-pre', 'owner-b', 'other@example.com');
    const internal = await seedStoreContext({ firebaseUid: 'internal-owner', email: 'internal@example.com' });
    await prisma.store.update({ where: { id: internal.store!.id }, data: { billingPreapprovalId: 'pre-internal', billingPayerEmail: 'internal@example.com' } });
    mp.failOn('GET /preapproval/old-caller', 400, 'the preapprovalId is not valid for callerId buyer@example.com');
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(reconcileSubscriptions(log)).resolves.toBe(2);
    for (const id of [caller, missing]) {
      const row = await prisma.store.findUniqueOrThrow({ where: { id } });
      expect(row.billingPreapprovalId).toBeNull();
      expect(row.billingStatus).toBe('EXPIRED');
      expect(row.billingPaidThrough!.getTime()).toBeLessThanOrEqual(Date.now());
    }
    expect(await prisma.store.findUniqueOrThrow({ where: { id: internal.store!.id } })).toMatchObject({ billingPlan: 'INTERNAL', billingPreapprovalId: 'pre-internal' });
    expect(log.info).toHaveBeenCalledWith(`Suscripción de otro vendedor descartada para la tienda ${caller}.`);
    expect(log.info).toHaveBeenCalledWith(`Suscripción de otro vendedor descartada para la tienda ${missing}.`);
    const logged = JSON.stringify(log.info.mock.calls);
    expect(logged).not.toContain('buyer@example.com');
    expect(logged).not.toContain('other@example.com');
    expect(logged).not.toContain('internal@example.com');
    expect(logged).not.toContain('test-placeholder');
  });
  it('Plan y facturación suelta un preapproval ajeno y vuelve a permitir la suscripción', async () => {
    const storeId = await trial();
    await syncPlans();
    await prisma.store.update({ where: { id: storeId }, data: {
      billingPlan: 'BASIC', billingStatus: 'ACTIVE', billingPeriod: 'MONTHLY', billingPreapprovalId: 'old-seller-pre',
      billingPayerEmail: 'buyer@example.com', billingPaidThrough: new Date(Date.now() + 86_400_000), trialEndsAt: new Date(Date.now() - 86_400_000),
    } });
    mp.failOn('GET /preapproval/old-seller-pre', 400, 'the preapprovalId is not valid for callerId buyer@example.com');
    const log = { info: vi.fn(), warn: vi.fn() };
    const details = await refreshBilling(storeId, log);
    expect(details).toMatchObject({ status: 'EXPIRED', canCancel: false, plan: 'BASIC' });
    expect(new Date(details.paidThrough!).getTime()).toBeLessThanOrEqual(Date.now());
    const quote = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(quote.statusCode, quote.body).toBe(200);
    expect(log.info).toHaveBeenCalledWith(`Suscripción de otro vendedor descartada para la tienda ${storeId}.`);
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('buyer@example.com');
    const screen = await getApp().inject({ method: 'POST', url: '/api/billing/refresh', headers: headers() });
    expect(screen.statusCode).toBe(200);
    expect(screen.json()).toMatchObject({ status: 'EXPIRED', canCancel: false });
  });
  it('registra el estado y el mensaje de Mercado Pago cuando la sincronización falla', async () => {
    mp.failOn('POST /preapproval_plan', 401, 'invalid access token test-placeholder buyer@example.com');
    let line = '';
    try { await syncPlans(); } catch (cause) { line = syncFailureLine(cause); }
    expect(line).toBe('No se pudo sincronizar facturación. Mercado Pago respondió 401: invalid access token [redacted] [redacted-email]');
    expect(line).not.toContain('test-placeholder');
    expect(line).not.toContain('buyer@example.com');
    expect(await prisma.billingPlan.count()).toBe(0);
  });
  it('requiere autenticación/owner y aísla cotizaciones de otra tienda', async () => {
    const { quote } = await opened();
    expect((await getApp().inject({ url: '/api/billing', headers: headers() })).json()).toMatchObject({ pendingCheckout: false, recentlyActivated: false });
    expect((await getApp().inject({ url: '/api/billing' })).statusCode).toBe(401);
    await seedStoreContext({ firebaseUid: 'staff', role: 'STAFF' });
    expect((await getApp().inject({ url: '/api/billing', headers: buildAuthHeaders({ uid: 'staff' }) })).statusCode).toBe(403);
    await seedStoreContext({ firebaseUid: 'other' });
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: buildAuthHeaders({ uid: 'other' }), payload: { quoteId: quote.id } })).statusCode).toBe(404);
  });
  it('crea preapproval por API con token, plan, referencia y email de la cotización', async () => {
    const { storeId, quote } = await opened('BASIC_ANNUAL');
    expect(quote).toMatchObject({ usd: 198, amountArs: 198000, exchangeRate: 1000, payerEmail: 'buyer@example.com' });
    expect(quote).not.toHaveProperty('publicKey');
    const response = await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().initPoint).toMatch(/^https:\/\/www\.mercadopago\.com\.ar\/subscriptions\/checkout\?preapproval_id=/);
    const calls = mp.calls.filter(call => call.method === 'POST' && call.path === '/preapproval');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      reason: 'iManager Básico anual', payer_email: 'buyer@example.com', external_reference: quote.id, status: 'pending', back_url: 'http://127.0.0.1:3000/#/plan',
      auto_recurring: { frequency: 12, frequency_type: 'months', transaction_amount: 198000, currency_id: 'ARS' },
    });
    expect(calls[0].body).not.toHaveProperty('preapproval_plan_id');
    expect(calls[0].body).not.toHaveProperty('card_token_id');
    expect(JSON.stringify(calls)).not.toContain('single-use-token');
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBeNull();
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing).toMatchObject({ plan: 'TRIAL', paidThrough: null });
  });
  it('rechaza datos de tarjeta y no llama al proveedor', async () => {
    const { quote } = await opened(); const before = mp.calls.length;
    for (const payload of [{}, { quoteId: quote.id, cardTokenId: 'token' }, { quoteId: quote.id, cardNumber: 'synthetic-pan' }]) {
      expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload })).statusCode).toBe(400);
    }
    expect(mp.calls).toHaveLength(before);
    expect(JSON.stringify(mp.calls)).not.toContain('synthetic-pan');
  });
  it('un doble envío concurrente crea una sola suscripción', async () => {
    const { quote } = await opened();
    const responses = await Promise.all([1, 2].map(() => getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })));
    expect(responses.map(response => response.statusCode).sort()).toEqual([200, 409]);
    expect(mp.calls.filter(call => call.method === 'POST' && call.path === '/preapproval')).toHaveLength(1);
  });
  it('una respuesta incierta no bloquea otro cobro cuando Mercado Pago no tiene el contrato', async () => {
    const { quote } = await opened();
    mp.failOn('POST /preapproval');
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(502);
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('CREATING');
    mp.failOn('');
    const again = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BUSINESS_MONTHLY', payerEmail: 'another@example.com' } });
    expect(again.statusCode, again.body).toBe(200);
    expect(again.body).not.toContain('en proceso');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
  });
  it('refresh sin reemplazo recupera una creación remota autorizada', async () => {
    const { storeId, planId, quote } = await opened();
    mp.failOn('POST /preapproval');
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(502);
    const remote = subscription(storeId, planId, quote.id);
    mp.failOn('');
    const result = await getApp().inject({ method: 'POST', url: '/api/billing/refresh', headers: headers() });
    expect(result.json()).toMatchObject({ status: 'ACTIVE', canCancel: true });
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).providerSubscriptionId).toBe(remote.id);
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === `/preapproval/${remote.id}`)).toHaveLength(0);
  });
  it('un contrato cancelado anterior no activa la tienda y el intento incierto se puede reintentar', async () => {
    const { storeId, planId, quote } = await opened();
    await prisma.store.update({ where: { id: storeId }, data: { billingPreapprovalId: 'old-cancelled', billingPayerEmail: 'buyer@example.com', billingStatus: 'CANCELLED', billingPaidThrough: new Date(0), billingRemoteUpdatedAt: new Date(0) } });
    subscription(storeId, planId, quote.id, { id: 'old-cancelled', status: 'cancelled', external_reference: storeId, summarized: undefined });
    mp.failOn('POST /preapproval');
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(502);
    mp.failOn('');
    await getApp().inject({ method: 'POST', url: '/api/billing/refresh', headers: headers() });
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('CREATING');
    const again = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(again.statusCode, again.body).toBe(200);
    expect(again.json().id).not.toBe(quote.id);
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(store).toMatchObject({ billingPreapprovalId: 'old-cancelled', billingStatus: 'CANCELLED', billingPlan: 'TRIAL' });
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === '/preapproval/old-cancelled')).toHaveLength(0);
  });
  it('un checkout pendiente abandonado se cancela y deja empezar otro', async () => {
    const { storeId, quote } = await opened();
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(200);
    const createdId = (await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).providerSubscriptionId;
    expect(createdId).toEqual(expect.any(String));
    expect(mp.subscriptions.get(createdId!)?.status).toBe('pending');
    const kept = await getApp().inject({ method: 'POST', url: '/api/billing/refresh', headers: headers() });
    expect(kept.json()).toMatchObject({ pendingCheckout: true, status: 'TRIAL' });
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === `/preapproval/${createdId}`)).toHaveLength(0);
    const again = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(again.statusCode, again.body).toBe(200);
    expect(again.body).not.toContain('en proceso');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
    expect(mp.subscriptions.get(createdId!)?.status).toBe('cancelled');
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === `/preapproval/${createdId}`).map(call => call.body)).toContainEqual({ status: 'cancelled' });
    const reopened = await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: again.json().id } });
    expect(reopened.statusCode, reopened.body).toBe(200);
    expect(mp.calls.filter(call => call.method === 'POST' && call.path === '/preapproval')).toHaveLength(2);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBeNull();
  });
  it('actualizar estado cancela el preapproval pendiente y una cotización citada no consulta Mercado Pago', async () => {
    const { quote } = await opened();
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(200);
    const replaced = await getApp().inject({ method: 'POST', url: '/api/billing/refresh', headers: headers(), payload: { replaceAbandoned: true } });
    expect(replaced.statusCode, replaced.body).toBe(200);
    expect(replaced.json()).toMatchObject({ pendingCheckout: false, status: 'TRIAL', canCancel: false });
    expect(replaced.body).not.toContain('buyer@example.com');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
    const quoted = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(quoted.statusCode).toBe(200);
    const before = mp.calls.length;
    const next = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_ANNUAL', payerEmail: 'buyer@example.com' } });
    expect(next.statusCode, next.body).toBe(200);
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quoted.json().id } })).checkoutStatus).toBe('FAILED');
    expect(mp.calls).toHaveLength(before);
  });
  it.each(['authorized', 'paused'] as const)('un intento %s anterior bloquea otro cobro', async status => {
    const { storeId, planId, quote } = await opened();
    await prisma.billingCheckout.update({ where: { id: quote.id }, data: { checkoutStatus: 'CREATED', providerSubscriptionId: 'subscription-1' } });
    subscription(storeId, planId, quote.id, { status });
    const blocked = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BUSINESS_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json().error).toBe('Ya tenés una suscripción. Cancelala y esperá al fin del período abonado para elegir otro plan.');
    expect(blocked.body).not.toContain('en proceso');
    expect(mp.calls.filter(call => call.method === 'POST' && call.path === '/preapproval')).toHaveLength(0);
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === '/preapproval/subscription-1')).toHaveLength(0);
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('RESOLVED');
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingStatus).toBe('ACTIVE');
  });
  it.each([
    ['missing-pre', 404, 'not found'],
    ['old-seller', 400, 'the preapprovalId is not valid for callerId buyer@example.com'],
  ] as const)('un preapproval %s no bloquea la nueva cotización', async (id, status, message) => {
    const { quote } = await opened();
    await prisma.billingCheckout.update({ where: { id: quote.id }, data: { checkoutStatus: 'CREATED', providerSubscriptionId: id } });
    if (status !== 404) mp.failOn(`GET /preapproval/${id}`, status, message);
    const again = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(again.statusCode, again.body).toBe(200);
    expect(again.body).not.toContain('en proceso');
    expect(again.body).not.toContain('callerId');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === `/preapproval/${id}`)).toHaveLength(0);
  });
  it('un corte de Mercado Pago no da por abandonado un intento que podría estar autorizado', async () => {
    const { quote } = await opened();
    await prisma.billingCheckout.update({ where: { id: quote.id }, data: { checkoutStatus: 'CREATED', providerSubscriptionId: 'down-pre' } });
    mp.failOn('GET /preapproval/down-pre', 503, 'unavailable');
    const again = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(again.statusCode).toBe(502);
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('CREATED');
    expect(mp.calls.filter(call => call.method === 'PUT' && call.path === '/preapproval/down-pre')).toHaveLength(0);
  });
  it('un rechazo explícito permite otra cotización con un nuevo token', async () => {
    const { quote } = await opened(); mp.failOn('POST /preapproval', 400);
    const rejected = await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } });
    expect(rejected.statusCode).toBe(402);
    expect(rejected.json().error).toBe('Mercado Pago no pudo iniciar la suscripción. Revisá el email del pagador o probá de nuevo en unos minutos.');
    expect(rejected.body).not.toContain('mock failure');
    expect(rejected.body).not.toContain('tarjeta');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
    mp.failOn('');
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } })).statusCode).toBe(200);
  });
  it('un email real contra un cobrador de prueba no menciona la tarjeta', async () => {
    const { quote } = await opened();
    mp.failOn('POST /preapproval', 400, 'Both payer and collector must be real or test users. payer buyer@example.com');
    const rejected = await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } });
    expect(rejected.statusCode).toBe(402);
    expect(rejected.json().error).toBe('Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.');
    expect(rejected.body).not.toContain('buyer@example.com');
    expect(rejected.body).not.toContain('tarjeta');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
  });
  it('credenciales inválidas de Mercado Pago son un error de configuración', async () => {
    const { quote } = await opened();
    mp.failOn('POST /preapproval', 401, 'invalid access token');
    const rejected = await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } });
    expect(rejected.statusCode).toBe(503);
    expect(rejected.json().error).toBe('La facturación no está disponible en este momento. Contactá a iManager.');
    expect(rejected.body).not.toContain('tarjeta');
    expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: quote.id } })).checkoutStatus).toBe('FAILED');
  });
  it('un plan que Mercado Pago no confirma pide reintentar', async () => {
    const { quote, planId } = await opened();
    mp.failOn(`GET /preapproval_plan/${planId}`, 422, 'invalid plan buyer@example.com');
    const rejected = await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } });
    expect(rejected.statusCode).toBe(402);
    expect(rejected.json().error).toBe('No pudimos validar el plan con Mercado Pago. Reintentá.');
    expect(rejected.body).not.toContain('buyer@example.com');
    expect(rejected.body).not.toContain('tarjeta');
  });
  it('impide abrir un importe distinto o una cotización vencida', async () => {
    const { quote, planId } = await opened();
    mp.plans.get(planId)!.auto_recurring = { frequency: 1, frequency_type: 'months', currency_id: 'ARS', transaction_amount: 23000 };
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(409);
    await prisma.billingCheckout.update({ where: { id: quote.id }, data: { expiresAt: new Date(0) } });
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(409);
  });
  it('revalida cotización blue y actualiza el plan antes de mostrar ARS', async () => {
    await opened(); vi.spyOn(blue, 'currentBlueRate').mockResolvedValue(1400);
    const quote = await getApp().inject({ method: 'POST', url: '/api/billing/quote', headers: headers(), payload: { key: 'BASIC_MONTHLY', payerEmail: 'buyer@example.com' } });
    expect(quote.json().amountArs).toBe(30800);
    expect(mp.calls.at(-1)).toMatchObject({ method: 'PUT', body: { auto_recurring: { transaction_amount: 30800 } } });
  });
  it('con secreto rechaza firmas y discrepancias antes de consultar MP', async () => {
    vi.stubEnv('MP_WEBHOOK_SECRET', 'test-secret');
    expect((await webhook('subscription-1', {}, false)).statusCode).toBe(401); expect(mp.calls).toHaveLength(0);
    expect((await getApp().inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=subscription-1', headers: { 'x-request-id': 'req', 'x-signature': signedWebhook('subscription-1') }, payload: { type: 'subscription_preapproval', data: { id: 'another-id' } } })).statusCode).toBe(400);
    expect(mp.calls).toHaveLength(0);
  });
  it('valida firma correcta, reconsulta y activa únicamente el pago confirmado', async () => {
    const { storeId, planId, quote } = await opened(); subscription(storeId, planId, quote.id);
    vi.stubEnv('MP_WEBHOOK_SECRET', 'test-secret');
    const response = await getApp().inject({ method: 'POST', url: '/webhooks/mercadopago?data.id=subscription-1', headers: { 'x-request-id': 'req', 'x-signature': signedWebhook('subscription-1') }, payload: { type: 'subscription_preapproval', data: { id: 'subscription-1' }, status: 'cancelled' } });
    expect(response.statusCode).toBe(200);
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing).toMatchObject({ plan: 'BASIC', status: 'ACTIVE', readOnly: false, memberLimit: 3 });
    expect(mp.calls.filter(call => call.path === '/preapproval/subscription-1')).toHaveLength(2);
  });
  it('sin secreto rechaza el webhook y no consulta la suscripción', async () => {
    const { storeId, planId, quote } = await opened();
    subscription(storeId, planId, quote.id);
    vi.stubEnv('MP_WEBHOOK_SECRET', '');
    const before = mp.calls.length;
    const response = await webhook();
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('Firma inválida.');
    expect(mp.calls).toHaveLength(before);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBeNull();
  });
  it('con secreto no confía en pending ni extiende desde next_payment_date', async () => {
    const { storeId, planId, quote } = await opened();
    subscription(storeId, planId, quote.id, { status: 'pending', summarized: undefined, next_payment_date: '2099-01-01T00:00:00Z' });
    await webhook('subscription-1', { status: 'authorized' });
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBeNull();
    subscription(storeId, planId, quote.id, { summarized: undefined, next_payment_date: '2099-01-01T00:00:00Z' });
    await webhook();
    await prisma.store.update({ where: { id: storeId }, data: { trialEndsAt: new Date(0) } });
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing).toMatchObject({ readOnly: true, status: 'EXPIRED' });
  });
  it.each(['external_reference', 'preapproval_plan_id'])('no activa si no coincide %s', async field => {
    const { storeId, planId, quote } = await opened(); subscription(storeId, planId, quote.id, { [field]: 'wrong' });
    await webhook();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBeNull();
  });
  it('activa por el intento cuando la suscripción no trae plan asociado', async () => {
    const { storeId, planId, quote } = await opened();
    const remote = subscription(storeId, planId, quote.id);
    delete (remote as { preapproval_plan_id?: string }).preapproval_plan_id;
    await webhook();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPlan).toBe('BASIC');
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBe('subscription-1');
  });
  it('no activa una suscripción sin plan si el importe no es el cotizado', async () => {
    const { storeId, planId, quote } = await opened();
    const remote = subscription(storeId, planId, quote.id);
    delete (remote as { preapproval_plan_id?: string }).preapproval_plan_id;
    remote.auto_recurring = { currency_id: 'ARS', frequency: 1, frequency_type: 'months', transaction_amount: 1 };
    await webhook();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBeNull();
  });
  it.each([null, '', 'otra@example.com'])('activa aunque payer_email sea %s', async email => {
    const { storeId, planId, quote } = await opened(); subscription(storeId, planId, quote.id, { payer_email: email });
    await webhook();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBe('subscription-1');
  });
  it('facturas reconsultan authorized_payments y la suscripción, con entrega repetida y fuera de orden', async () => {
    const { storeId, planId, quote } = await opened(); const remote = subscription(storeId, planId, quote.id);
    mp.invoices.set('invoice-1', 'subscription-1');
    for (let i = 0; i < 2; i++) await getApp().inject({ method: 'POST', url: '/webhooks/mercadopago', payload: { type: 'subscription_authorized_payment', data: { id: 'invoice-1' } } });
    const before = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    remote.status = 'paused'; remote.last_modified = '2020-01-01T00:00:00Z'; delete (remote as { summarized?: unknown }).summarized;
    await webhook();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPaidThrough).toEqual(before.billingPaidThrough);
    expect(await prisma.billingCheckout.count()).toBe(1);
  });
  it('el vencimiento bloquea todas las escrituras del negocio, pero permite lecturas/facturación', async () => {
    const storeId = await trial();
    await prisma.store.update({ where: { id: storeId }, data: { trialEndsAt: new Date(0) } });
    for (const url of ['/api/clients', '/api/inventory', '/api/sales', '/api/cash', '/api/import/analyze-text', '/api/invitations']) {
      const response = await getApp().inject({ method: 'POST', url, headers: headers(), payload: {} });
      expect(response.statusCode, url).toBe(402);
    }
    expect((await getApp().inject({ url: '/api/clients', headers: headers() })).statusCode).toBe(200);
    expect((await getApp().inject({ url: '/api/billing', headers: headers() })).statusCode).toBe(200);
    expect(await prisma.client.count()).toBe(0);
  });
  it.each([['BASIC', 3], ['BUSINESS', 5], ['TRIAL', 3]])('%s permite el último lugar y rechaza invitaciones al alcanzar %s', async (plan, limit) => {
    const storeId = await trial();
    await prisma.store.update({ where: { id: storeId }, data: { billingPlan: String(plan) } });
    for (let i = 1; i < Number(limit) - 1; i++) {
      const extra = await prisma.user.create({ data: { firebaseUid: `extra-${i}` } });
      await prisma.storeMember.create({ data: { storeId, userId: extra.id, role: 'STAFF' } });
    }
    expect((await getApp().inject({ method: 'POST', url: '/api/invitations', headers: headers(), payload: { role: 'STAFF' } })).statusCode).toBeLessThan(300);
    const invitations = await Promise.all(['a', 'b'].map(() => prisma.storeInvitation.create({ data: { storeId, role: 'STAFF', expiresAt: new Date(Date.now() + 60000) } })));
    const responses = await Promise.all(invitations.map((invite, i) => getApp().inject({ method: 'POST', url: '/api/invitations/accept', headers: buildAuthHeaders({ uid: `new-${i}` }), payload: { token: invite.token } })));
    expect(responses.map(response => response.statusCode).sort()).toEqual([200, 409]);
    expect(await prisma.storeMember.count({ where: { storeId } })).toBe(Number(limit));
    expect((await getApp().inject({ method: 'POST', url: '/api/invitations', headers: headers(), payload: { role: 'STAFF' } })).statusCode).toBe(409);
  });
  it('cancelar exige confirmación del proveedor, es idempotente y preserva período abonado', async () => {
    const { storeId, planId, quote } = await opened(); subscription(storeId, planId, quote.id); await webhook();
    mp.failOn('PUT /preapproval/subscription-1');
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/cancel', headers: headers() })).statusCode).toBe(502);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingStatus).toBe('ACTIVE');
    mp.failOn('');
    for (let i = 0; i < 2; i++) expect((await getApp().inject({ method: 'POST', url: '/api/billing/cancel', headers: headers() })).statusCode).toBe(200);
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing).toMatchObject({ status: 'CANCELLED', readOnly: false, canCancel: false });
  });
  it('permite volver a suscribirse tras cancelar y vencer, sin reactivar eventos viejos', async () => {
    const { storeId, planId, quote } = await opened(); const old = subscription(storeId, planId, quote.id); await webhook();
    await getApp().inject({ method: 'POST', url: '/api/billing/cancel', headers: headers() });
    await prisma.store.update({ where: { id: storeId }, data: { billingPaidThrough: new Date(0), billingRemoteUpdatedAt: new Date(Date.now() - 5000), trialEndsAt: new Date(0) } });
    subscription(storeId, planId, quote.id, { id: 'subscription-2' });
    await webhook('subscription-2'); old.status = 'authorized'; old.last_modified = new Date().toISOString(); await webhook();
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPreapprovalId).toBe('subscription-2');
  });
  it('un plan anual habilita un año pagado y vence sin necesitar otro webhook', async () => {
    const { storeId, planId, quote } = await opened('BUSINESS_ANNUAL');
    const charged = new Date();
    subscription(storeId, planId, quote.id, { auto_recurring: { currency_id: 'ARS', frequency: 12, frequency_type: 'months', transaction_amount: 783000 }, summarized: { charged_quantity: 1, last_charged_date: charged.toISOString() } });
    await webhook();
    const stored = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(stored.billingPlan).toBe('BUSINESS'); expect(stored.billingPeriod).toBe('ANNUAL');
    expect(stored.billingPaidThrough!.getUTCFullYear()).toBe(charged.getUTCFullYear() + 1);
    await prisma.store.update({ where: { id: storeId }, data: { trialEndsAt: new Date(0), billingPaidThrough: new Date(0) } });
    expect((await getApp().inject({ method: 'POST', url: '/api/clients', headers: headers(), payload: { name: 'No guardar' } })).statusCode).toBe(402);
    expect((await getApp().inject({ url: '/api/clients', headers: headers() })).statusCode).toBe(200);
  });
  it('un pago de Básico con equipo excedido conserva datos y permite al owner reducirlo', async () => {
    const { storeId, planId } = await opened();
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: { firebaseUid: `paid-${i}` } });
      await prisma.storeMember.create({ data: { storeId, userId: user.id, role: 'STAFF' } });
    }
    const extra = await prisma.user.create({ data: { firebaseUid: 'extra-paid' } });
    const member = await prisma.storeMember.create({ data: { storeId, userId: extra.id, role: 'STAFF' } });
    const quoteId = (await prisma.billingCheckout.findFirstOrThrow({ where: { storeId } })).id;
    subscription(storeId, planId, quoteId); await webhook();
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing).toMatchObject({ plan: 'BASIC', overLimit: true, readOnly: true });
    expect((await getApp().inject({ method: 'DELETE', url: `/api/stores/${storeId}/members/${member.id}`, headers: headers() })).statusCode).toBe(200);
    expect((await getApp().inject({ url: '/api/me', headers: headers() })).json().billing.readOnly).toBe(false);
  });
  it('cancelar conserva un cobro reciente aunque todavía no haya llegado su webhook', async () => {
    const { storeId, planId, quote } = await opened(); const remote = subscription(storeId, planId, quote.id); await webhook();
    const charge = new Date(Date.now() - 1000);
    await prisma.store.update({ where: { id: storeId }, data: { billingPaidThrough: new Date(0) } });
    remote.summarized = { charged_quantity: 2, last_charged_date: charge.toISOString() };
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/cancel', headers: headers() })).statusCode).toBe(200);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).billingPaidThrough!.getTime()).toBeGreaterThan(Date.now());
  });
  it('rechaza condiciones remotas alteradas y devuelve 5xx ante un recurso inválido', async () => {
    const { quote, planId } = await opened();
    const remote = mp.plans.get(planId)!;
    remote.auto_recurring = { frequency: 12, frequency_type: 'months', currency_id: 'ARS', transaction_amount: 22000 };
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(409);
    remote.auto_recurring = {};
    expect((await getApp().inject({ method: 'POST', url: '/api/billing/checkout', headers: headers(), payload: { quoteId: quote.id } })).statusCode).toBe(502);
  });
  it('refresh recupera el retorno del checkout sin confiar en un ID enviado por el browser', async () => {
    const { storeId, planId, quote } = await opened(); subscription(storeId, planId, quote.id);
    const response = await getApp().inject({ method: 'POST', url: '/api/billing/refresh?preapproval_id=forged&status=authorized', headers: headers(), payload: { id: 'arbitrary', preapproval_id: 'forged', status: 'authorized' } });
    expect(response.json()).toMatchObject({ plan: 'BASIC', status: 'ACTIVE' });
    expect(mp.calls.some(call => call.path.includes('forged') || call.path.includes('arbitrary'))).toBe(false);
  });
  it('el script actualiza el importe de contratos existentes y reconcilia sin exportar filas', async () => {
    const { storeId, planId, quote } = await opened(); subscription(storeId, planId, quote.id); await webhook();
    vi.spyOn(blue, 'currentBlueRate').mockResolvedValue(1300); await syncPlans(); await reconcileSubscriptions();
    expect(mp.calls.some(call => call.path === '/preapproval/subscription-1' && call.method === 'PUT' && (call.body.auto_recurring as { transaction_amount?: number })?.transaction_amount === 28600)).toBe(true);
  });
});
