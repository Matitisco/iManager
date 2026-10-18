import { test, expect } from '@playwright/test';
import { buildTestEmail, loginViaUi } from './utils';

for (const width of [390, 1440]) {
  test(`collects name → stock → skip without changing onboarding at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const events: Array<{ name: string; props?: Record<string, unknown> }> = [];
    await page.route('**/api/events', async route => {
      events.push(...route.request().postDataJSON().events);
      await route.fulfill({ status: 204 });
    });
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
    await page.route('https://mercados.ambito.com/**', route => route.fulfill({ json: {} }));
    await loginViaUi(page, buildTestEmail(info, 'analytics'));
    await page.getByTestId('onboarding-store-name').fill('Palermo');
    await page.getByTestId('onboarding-submit').click();
    await expect(page.getByRole('heading', { name: 'Cargá tu stock' })).toBeVisible();
    await page.getByRole('button', { name: 'Saltar por ahora' }).click();
    await expect(page.getByRole('button', { name: 'Primeros pasos, 1 de 5' })).toBeVisible();
    await expect.poll(() => [...new Set(events.filter(e => ['onboarding_name_viewed', 'onboarding_stock_viewed', 'stock_method_chosen'].includes(e.name)).map(e => e.name))]).toEqual(['onboarding_name_viewed', 'onboarding_stock_viewed', 'stock_method_chosen']);
    expect(events.find(e => e.name === 'stock_method_chosen')?.props).toEqual({ method: 'skip' });
    expect(events.every(e => !('userId' in e) && !('storeId' in e))).toBe(true);
  });
}
