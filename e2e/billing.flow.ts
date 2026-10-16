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
  test(`prueba, precios USD, confirmación ARS y enlace MP · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'billing');
    await bootstrapStoreViaApi(page, request, email, 'Tienda del Centro');
    const session = await fetchSession(request, email);
    await expect(page.getByTestId('billing-access-banner')).toContainText('7 días restantes');
    await shot(page, device, 'trial');
    await billing(page);
    const payerEmail = 'cobros@tienda.test';
    await page.getByRole('textbox', { name: /Email del pagador/ }).fill(payerEmail);
    await expect(page.getByText('US$ 22', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Anual/ }).click();
    await expect(page.getByText('US$ 198 por año, en un solo cobro')).toBeVisible();
    await shot(page, device, 'plans'); await fits(page);
    // Provider boundary simulated here; backend HTTP and persistence covered by integration suite.
    await page.route('**/api/billing/quote', route => route.fulfill({ json: { id: 'e2e-quote', key: 'BASIC_ANNUAL', usd: 198, amountArs: 277200, exchangeRate: 1400, payerEmail, expiresAt: '2099-01-01T00:00:00Z' } }));
    let checkoutRequested = false;
    const hosted = new URL('https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=e2e-plan');
    hosted.searchParams.set('external_reference', session.store!.id); hosted.searchParams.set('payer_email', payerEmail);
    await page.route('**/api/billing/checkout', route => { checkoutRequested = true; return route.fulfill({ json: { initPoint: hosted.toString() } }); });
    await page.route('https://www.mercadopago.com.ar/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Checkout hospedado simulado</h1>' }));
    await page.getByRole('button', { name: 'Suscribirme a Básico' }).click();
    const quote = page.getByTestId('billing-quote'); await expect(quote).toContainText('277.200');
    await expect(quote).toContainText(payerEmail); expect(checkoutRequested).toBe(false);
    await expect(page.getByRole('button', { name: 'Continuar a Mercado Pago' })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await quote.scrollIntoViewIfNeeded(); await fits(page); await shot(page, device, 'ars');
    await page.getByRole('button', { name: 'Continuar a Mercado Pago' }).click();
    await expect(page).toHaveURL(hosted.toString());
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
    await page.reload(); await expect(page.getByText('1 de 1 usuario')).toBeVisible();
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
    await expect(page.getByText('Gratis de por vida', { exact: true })).toBeVisible();
    await expect(page.getByTestId('billing-access-banner')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Suscribirme|Cancelar suscripción/ })).toHaveCount(0);
    const write = await request.post(`${api}/api/clients`, { headers: authHeaders(email), data: { name: 'Cliente interno' } });
    expect(write.ok()).toBeTruthy(); await fits(page); await shot(page, device, 'internal');
  });
}
