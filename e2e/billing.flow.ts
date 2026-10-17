import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '../backend/src/plugins/prisma';
import { bootstrapStoreViaApi, buildTestEmail, fetchSession, authHeaders } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
async function billing(page: Page) {
  await page.goto('/#/config');
  await page.getByRole('button', { name: /Plan y facturación/ }).click();
  await expect(page.getByTestId('billing-screen')).toBeVisible();
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.getByTestId('billing-screen').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
}
async function shot(page: Page, device: string, state: string) {
  if (!process.env.ISSUE_359_SHOTS) return;
  mkdirSync(process.env.ISSUE_359_SHOTS, { recursive: true });
  await page.screenshot({ path: `${process.env.ISSUE_359_SHOTS}/issue-359-${device}-${state}.png`, animations: 'disabled' });
}
export function registerBillingTests(device: string) {
  test.afterAll(async () => { await prisma.$disconnect(); });
  test(`prueba, precios USD, confirmación ARS y checkout de Mercado Pago · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'billing');
    await bootstrapStoreViaApi(page, request, email, 'Tienda del Centro');
    const session = await fetchSession(request, email);
    await expect(page.getByTestId('billing-access-banner')).toContainText('7 días restantes');
    await shot(page, device, 'trial');
    await billing(page);
    const payerEmail = 'cobros@tienda.test';
    await page.getByRole('textbox', { name: /Email del pagador/ }).fill(payerEmail);
    await expect(page.getByRole('heading', { name: 'Prueba gratuita · Plan Básico' })).toBeVisible();
    await expect(page.getByText(/Te quedan \d+ días de prueba sin tarjeta/)).toBeVisible();
    await expect(page.getByText('1 de 3 usuarios', { exact: false })).toBeVisible();
    await expect(page.getByText('Hasta 3 usuarios')).toBeVisible();
    await expect(page.getByText('Hasta 5 usuarios')).toBeVisible();
    await expect(page.getByText('US$ 22', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Anual/ }).click();
    await expect(page.getByText('US$ 198 por año, en un solo cobro')).toBeVisible();
    await shot(page, device, 'plans'); await fits(page);
    // Provider boundary simulated here; backend HTTP and persistence covered by integration suite.
    await page.route('**/api/billing/quote', route => route.fulfill({ json: { id: 'e2e-quote', key: 'BASIC_ANNUAL', usd: 198, amountArs: 277200, exchangeRate: 1400, payerEmail, expiresAt: '2099-01-01T00:00:00Z' } }));
    const payloads: unknown[] = [];
    let failCheckout = true;
    await page.route('**/api/billing/checkout', async route => {
      payloads.push(route.request().postDataJSON());
      if (failCheckout) {
        failCheckout = false;
        return route.fulfill({ status: 402, json: { error: 'Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.' } });
      }
      await new Promise(resolve => setTimeout(resolve, 400));
      return route.fulfill({ json: { initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=e2e' } });
    });
    await page.route('https://www.mercadopago.com.ar/**', route => route.fulfill({ contentType: 'text/html', body: '<main>Mercado Pago</main>' }));
    await page.getByRole('button', { name: 'Suscribirme a Básico' }).click();
    const quote = page.getByRole('dialog', { name: 'Antes de suscribirte' });
    await expect(quote).toHaveAttribute('data-layout', device === 'iphone' ? 'sheet' : 'dialog');
    await expect(quote).toHaveAttribute('aria-modal', 'true');
    await expect(quote).toContainText('277.200');
    await expect(quote).toContainText(payerEmail); expect(payloads).toHaveLength(0);
    await expect(quote).toContainText('Dólar blue vendedor');
    await expect(quote).toContainText('El débito es automático');
    await expect(quote).toContainText('El pago se completa en Mercado Pago');
    await expect(quote).toContainText('iManager no ve los datos de la tarjeta');
    await expect(page.getByRole('button', { name: 'Continuar en Mercado Pago' })).toHaveCSS('color', 'rgb(255, 255, 255)');
    if (device === 'iphone') {
      const padding = await quote.evaluate(el => Number.parseFloat(getComputedStyle(el).paddingBottom));
      expect(padding).toBeGreaterThanOrEqual(24);
    }
    await fits(page); await shot(page, device, 'ars');
    await page.keyboard.press('Escape');
    await expect(quote).toHaveCount(0);
    await page.getByRole('button', { name: 'Suscribirme a Básico' }).click();
    await page.getByTestId('billing-modal-backdrop').click({ position: { x: 12, y: 12 } });
    await expect(page.getByRole('dialog', { name: 'Antes de suscribirte' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Suscribirme a Básico' }).click();
    await page.getByRole('button', { name: 'Continuar en Mercado Pago' }).click();
    await expect(page.getByRole('dialog', { name: 'Antes de suscribirte' }).getByRole('alert')).toContainText('Este email no se puede usar con la cuenta de cobro actual');
    await expect(page.getByRole('dialog', { name: 'Antes de suscribirte' }).getByRole('alert')).not.toContainText('tarjeta');
    await expect(page.getByRole('button', { name: 'Continuar en Mercado Pago' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar en Mercado Pago' }).click();
    await expect(page.getByRole('button', { name: 'Abriendo Mercado Pago…' })).toBeVisible();
    await expect(page).toHaveURL(/https:\/\/www\.mercadopago\.com\.ar\/subscriptions\/checkout\?preapproval_id=e2e/);
    expect(payloads).toEqual([{ quoteId: 'e2e-quote' }, { quoteId: 'e2e-quote' }]);
    expect(JSON.stringify(payloads)).not.toContain('card');
  });
  test(`vencimiento solo lectura, límites, cancelación y acceso interno · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'billing-expired');
    await bootstrapStoreViaApi(page, request, email, 'Tienda Norte');
    const session = await fetchSession(request, email); const storeId = session.store!.id;
    await prisma.store.update({ where: { id: storeId }, data: { trialEndsAt: new Date(0), onboardingStartedAt: new Date(), onboardingStage: 'invite' } });
    await page.reload(); await expect(page.getByTestId('billing-access-banner')).toContainText('Modo solo lectura');
    const response = await request.post(`${api}/api/clients`, { headers: authHeaders(email), data: { name: 'No guardar' } });
    expect(response.status()).toBe(402);
    await billing(page); await shot(page, device, 'expired'); await fits(page);
    await prisma.store.update({ where: { id: storeId }, data: { onboardingCompletedAt: new Date(), billingPlan: 'BASIC', billingStatus: 'ACTIVE', billingPreapprovalId: 'test-subscription', billingPaidThrough: new Date(Date.now() + 10 * 86400000), billingPeriod: 'MONTHLY' } });
    await page.reload(); await expect(page.getByText('1 de 3 usuarios')).toBeVisible();
    await shot(page, device, 'active');
    await page.getByRole('button', { name: 'Cancelar suscripción', exact: true }).click();
    await page.route('**/api/billing/cancel', route => route.fulfill({ status: 502, json: { error: 'Provider failure' } }));
    await page.getByRole('button', { name: 'Sí, cancelar suscripción' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sí, cancelar suscripción' })).toBeVisible();
    await page.route('**/api/billing/cancel', async route => {
      await prisma.store.update({ where: { id: storeId }, data: { billingStatus: 'CANCELLED' } });
      await route.fulfill({ json: { ok: true } });
    });
    await page.getByRole('button', { name: 'Sí, cancelar suscripción' }).click();
    await expect(page.getByRole('status')).toContainText('Suscripción cancelada.');
    await shot(page, device, 'cancelled');
    await prisma.store.update({ where: { id: storeId }, data: { billingPlan: 'INTERNAL', billingStatus: 'ACTIVE' } });
    await page.reload();
    await expect(page.getByText('Acceso ilimitado', { exact: true })).toBeVisible();
    await expect(page.getByTestId('billing-access-banner')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Suscribirme|Cancelar suscripción/ })).toHaveCount(0);
    const write = await request.post(`${api}/api/clients`, { headers: authHeaders(email), data: { name: 'Cliente interno' } });
    expect(write.ok()).toBeTruthy(); await fits(page); await shot(page, device, 'internal');
  });
  const returnBilling = {
    plan: 'TRIAL', status: 'TRIAL', period: null, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null,
    trialDaysLeft: 7, readOnly: false, memberLimit: 3, members: 1, overLimit: false, canCancel: false,
    plans: [
      { key: 'BASIC_MONTHLY', name: 'Básico', plan: 'BASIC', period: 'MONTHLY', usd: 22, months: 1, users: 3 },
      { key: 'BUSINESS_MONTHLY', name: 'Negocio', plan: 'BUSINESS', period: 'MONTHLY', usd: 87, months: 1, users: 5 },
      { key: 'BASIC_ANNUAL', name: 'Básico', plan: 'BASIC', period: 'ANNUAL', usd: 198, months: 12, users: 3 },
      { key: 'BUSINESS_ANNUAL', name: 'Negocio', plan: 'BUSINESS', period: 'ANNUAL', usd: 783, months: 12, users: 5 },
    ],
  };
  test(`el retorno de Mercado Pago abre el plan y confirma el pago · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'billing-return');
    await bootstrapStoreViaApi(page, request, email, 'Tienda Sur');
    let calls = 0;
    await page.route('**/api/billing/refresh', async route => {
      calls += 1;
      const sent = `${route.request().url()} ${route.request().postData() ?? ''}`;
      expect(sent).not.toContain('pre-real');
      expect(sent).not.toContain('authorized');
      const active = calls > 1;
      await route.fulfill({ json: { ...returnBilling, plan: active ? 'BASIC' : 'TRIAL', status: active ? 'ACTIVE' : 'TRIAL', canCancel: active, memberLimit: 3, pendingCheckout: !active, recentlyActivated: active, paidThrough: active ? '2099-01-01T00:00:00Z' : null } });
    });
    await page.goto('/#/plan?preapproval_id=pre-real&status=authorized&external_reference=chk-1');
    await expect(page.getByTestId('billing-screen')).toBeVisible();
    await expect(page.getByTestId('billing-return-confirming')).toHaveText('Confirmando tu pago…');
    await expect(page.getByText('Listo. Tu plan Básico ya está activo.')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/#\/plan$/);
    expect(page.url()).not.toContain('pre-real');
    expect(page.url()).not.toContain('authorized');
    expect(calls).toBeGreaterThan(1);
    await fits(page);
  });
  test(`un retorno de otra tienda abre el plan sin error · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'billing-return-other');
    await bootstrapStoreViaApi(page, request, email, 'Tienda Oeste');
    const sent: string[] = [];
    await page.route('**/api/billing/refresh', async route => {
      sent.push(`${route.request().url()} ${route.request().postData() ?? ''}`);
      await route.continue();
    });
    await page.goto('/#/plan?preapproval_id=forged-id&status=authorized&external_reference=other-store');
    await expect(page.getByTestId('billing-screen')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suscribirme a Básico' })).toBeVisible();
    await expect(page).toHaveURL(/#\/plan$/);
    expect(page.url()).not.toContain('forged-id');
    expect(page.url()).not.toContain('other-store');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByTestId('billing-return-pending')).toHaveCount(0);
    expect(sent.some(body => body.includes('forged-id') || body.includes('other-store') || body.includes('authorized'))).toBe(false);
    await fits(page);
  });
}
