import { openDeskSection } from '../navigation';
import { expect, test, type Page } from '@playwright/test';
import { ACTION_ERROR_MESSAGE, SERVER_ERROR_MESSAGE } from '../../src/lib/user-message';
import { data, me } from './fixtures.mjs';

async function openCanjeConfirmation(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  if (mobile) {
    await page.getByTestId('sidebar-tab-more').click();
    await page.getByTestId('more-screen').getByTestId('sidebar-tab-tradeins').click();
  } else await openDeskSection(page, 'tradeins');
  await expect(page.getByRole('heading', { level: 1, name: 'Canjes', exact: true })).toBeVisible();
  const row = page.locator(mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'iPhone recibido 1' });
  await expect(row).toBeVisible();
  if (mobile) {
    await row.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 300, button: 0 });
    await expect(page.locator('.ctx')).toBeVisible();
    await row.dispatchEvent('pointerup', { pointerType: 'touch' });
  } else await row.click({ button: 'right' });
  await page.locator('.ctx').getByRole('button', { name: 'Anular', exact: true }).click();
  return page.getByRole('dialog', { name: /Anular (venta|canje)/ });
}

test('installed shell keeps the canje dialog open with a neutral failure message and allows retry', async ({ page, context }) => {
  const dialog = await openCanjeConfirmation(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await dialog.getByRole('button', { name: 'Anular', exact: true }).click();
    await expect(dialog.locator('.ferr')).toHaveText(ACTION_ERROR_MESSAGE);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Anular', exact: true })).toBeEnabled();
    await expect(page.locator('body')).not.toContainText(/Failed to fetch|Load failed|NetworkError/);
  } finally { await context.setOffline(false); }
  await dialog.getByRole('button', { name: 'Anular', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.toast')).toContainText('Anulado');
});

test.describe('HTTP errors in the canje dialog', () => {
  // Intercept HTTP responses deterministically; the offline test above uses a real SW.
  test.use({ serviceWorkers: 'block' });
  test('shows a generic 5xx and preserves the Spanish 4xx validation', async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/me' ? me : data }));
    const dialog = await openCanjeConfirmation(page);
    let attempts = 0;
    await page.route('**/api/operations/tradeins/trades/*/void', (route) => {
      attempts += 1;
      return route.fulfill(attempts === 1
        ? { status: 503, contentType: 'text/html', body: '<html>Service unavailable</html>' }
        : { status: 409, json: { error: 'El equipo pertenece a una operación activa.' } });
    });
    await dialog.getByRole('button', { name: 'Anular', exact: true }).click();
    await expect(dialog.locator('.ferr')).toHaveText(SERVER_ERROR_MESSAGE);
    await dialog.getByRole('button', { name: 'Anular', exact: true }).click();
    await expect(dialog.locator('.ferr')).toHaveText('El equipo pertenece a una operación activa.');
    await expect(dialog).toBeVisible();
    expect(attempts).toBe(2);
  });
});
