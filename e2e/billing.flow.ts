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
// Simulate only the provider SDK boundary. Inputs stay inside frames, as in Secure Fields.
async function mockSecureFields(page: Page) {
  await page.route('https://sdk.mercadopago.com/js/v2', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.MercadoPago = class {
      constructor() {
        this.inputs = {};
        this.fields = {
          create: (type, options) => {
            const callbacks = {};
            let frame;
            return {
              on: (event, callback) => { callbacks[event] = callback; },
              update: () => {},
              mount: id => {
                frame = document.createElement('iframe'); frame.title = options.srLabel;
                frame.srcdoc = '<input aria-label="' + options.srLabel + '" style="box-sizing:border-box;width:100%;height:44px;border:0;background:#f9fafb;font:16px Arial;padding:12px" />';
                frame.onload = () => { this.inputs[type] = frame.contentDocument.querySelector('input'); callbacks.ready?.({}); };
                document.getElementById(id).appendChild(frame);
              },
              unmount: () => frame?.remove(),
            };
          },
          createCardToken: async () => {
            if (this.inputs.securityCode.value !== '123' || !this.inputs.cardNumber.value || !this.inputs.expirationDate.value) throw new Error('Invalid card');
            return { id: 'e2e-single-use-token' };
          },
        };
      }
      async getIdentificationTypes() { return [{ id: 'DNI', name: 'DNI' }]; }
    };
  ` }));
}
export function registerBillingTests(device: string) {
  test.afterAll(async () => { await prisma.$disconnect(); });
  test(`prueba, precios USD, confirmación ARS y tarjeta dentro de iManager · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'billing');
    await bootstrapStoreViaApi(page, request, email, 'Tienda del Centro');
    const session = await fetchSession(request, email);
    await expect(page.getByTestId('billing-access-banner')).toContainText('7 días restantes');
    await shot(page, device, 'trial');
    await billing(page);
    const payerEmail = 'cobros@tienda.test';
    await page.getByRole('textbox', { name: /Email del pagador/ }).fill(payerEmail);
    await expect(page.getByText('1 de 5 usuarios', { exact: false })).toBeVisible();
    await expect(page.getByText('Hasta 3 usuarios')).toBeVisible();
    await expect(page.getByText('Hasta 5 usuarios')).toBeVisible();
    await expect(page.getByText('US$ 22', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Anual/ }).click();
    await expect(page.getByText('US$ 198 por año, en un solo cobro')).toBeVisible();
    await shot(page, device, 'plans'); await fits(page);
    // Provider boundary simulated here; backend HTTP and persistence covered by integration suite.
    await page.route('**/api/billing/quote', route => route.fulfill({ json: { publicKey: 'public-key-placeholder', id: 'e2e-quote', key: 'BASIC_ANNUAL', usd: 198, amountArs: 277200, exchangeRate: 1400, payerEmail, expiresAt: '2099-01-01T00:00:00Z' } }));
    await mockSecureFields(page);
    const payloads: unknown[] = [];
    await page.route('**/api/billing/checkout', route => {
      payloads.push(route.request().postDataJSON());
      return route.fulfill({ json: { status: 'authorized' } });
    });
    await page.getByRole('button', { name: 'Suscribirme a Básico' }).click();
    const quote = page.getByTestId('billing-quote'); await expect(quote).toContainText('277.200');
    await expect(quote).toContainText(payerEmail); expect(payloads).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Confirmar suscripción con tarjeta' })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await quote.scrollIntoViewIfNeeded(); await fits(page); await shot(page, device, 'ars');
    await expect(quote).toContainText('No necesitás una cuenta de Mercado Pago.');
    await page.getByRole('textbox', { name: 'Nombre del titular' }).fill('APRO');
    await page.getByRole('textbox', { name: 'Documento del titular' }).fill('12345678');
    await page.frameLocator('[id$="-cardNumber"] iframe').getByRole('textbox').fill('4509953566233704');
    await page.frameLocator('[id$="-expirationDate"] iframe').getByRole('textbox').fill('11/30');
    const cvv = page.frameLocator('[id$="-securityCode"] iframe').getByRole('textbox');
    await cvv.fill('000');
    await page.getByRole('button', { name: 'Confirmar suscripción con tarjeta' }).click();
    await expect(page.getByRole('alert')).toContainText('Revisá el número');
    expect(payloads).toHaveLength(0);
    await cvv.fill('123');
    await shot(page, device, 'card'); await fits(page);
    await page.getByRole('button', { name: 'Confirmar suscripción con tarjeta' }).click();
    await expect(page.getByText(/Suscripción enviada/)).toBeVisible();
    expect(payloads).toEqual([{ quoteId: 'e2e-quote', cardTokenId: 'e2e-single-use-token' }]);
    await expect(page).toHaveURL(/#\/plan$/);
    await expect(page.getByTestId('billing-screen')).toBeVisible();
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
    await expect(page.getByText('Gratis de por vida', { exact: true })).toBeVisible();
    await expect(page.getByTestId('billing-access-banner')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Suscribirme|Cancelar suscripción/ })).toHaveCount(0);
    const write = await request.post(`${api}/api/clients`, { headers: authHeaders(email), data: { name: 'Cliente interno' } });
    expect(write.ok()).toBeTruthy(); await fits(page); await shot(page, device, 'internal');
  });
}
