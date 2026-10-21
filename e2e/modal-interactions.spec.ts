import { expect, test } from '@playwright/test';
import { data, me } from './pwa/fixtures.mjs';

for (const viewport of [{ width: 1440, height: 900 }, { width: 1536, height: 640 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
  test.describe(`modal interactions ${viewport.width}`, () => {
    test.use({ viewport });

    test('keeps a pending expense open, contains focus and preserves the failed draft', async ({ page }) => {
      let release: () => void = () => undefined;
      let received: () => void = () => undefined;
      const held = new Promise<void>(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { received = resolve; });
      let writes = 0;
      await page.addInitScript(() => {
        localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email: 'modal447@example.test' }));
        localStorage.setItem('imanager:install-dismissed:ios', 'yes');
        localStorage.setItem('imanager:install-dismissed:android', 'yes');
      });
      await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-21T12:00:00Z' } }));
      await page.route('https://api.bluelytics.com.ar/**', route => route.fulfill({ json: {} }));
      await page.route('https://mercados.ambito.com/**', route => route.fulfill({ json: {} }));
      // Every API request is synthetic. No backend or real credentials are used.
      await page.context().route('**/api/**', async route => {
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/expenses' && route.request().method() === 'POST') {
          writes += 1;
          received();
          await held;
          return route.fulfill({ status: 503, json: { error: 'Fallo sintético' }, headers });
        }
        return route.fulfill({ json: path === '/api/me' ? me : { ...data, expenses: [] }, headers });
      });

      try {
        await page.goto('/#/finanzas/gastos');
        const trigger = page.getByRole('button', { name: 'Nuevo gasto', exact: true });
        await trigger.click();
        const form = page.getByRole('dialog', { name: 'Nuevo gasto' });
        await form.evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))); });
        await expect(form).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(form.getByRole('button', { name: 'Guardar gasto' })).toBeFocused();
        await page.keyboard.press('Tab');
        const first = viewport.width < 760 ? form.getByRole('button', { name: 'Cerrar', exact: true }) : form.getByLabel('Fecha');
        await expect(first).toBeFocused();
        await form.getByLabel('Categoría').fill('Alquiler sintético');
        await form.getByLabel('Monto').fill('123');
        await form.getByLabel('Notas').fill('Conservar este borrador');
        await form.getByRole('button', { name: 'Guardar gasto' }).click();
        await started;
        await expect(form.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
        await page.keyboard.press('Escape');
        await page.locator('.ov').click({ position: { x: 2, y: 2 } });
        if (viewport.width < 760) await expect(form.getByRole('button', { name: 'Cerrar', exact: true })).toBeDisabled();
        await expect(form).toBeVisible();
        expect(writes).toBe(1);
        release();
        await expect(form.getByRole('button', { name: 'Guardar gasto' })).toBeEnabled();
        await expect(form.locator('.ferr')).not.toBeEmpty();
        await expect(form.getByLabel('Notas')).toHaveValue('Conservar este borrador');
        await expect(page.locator('.toast.show')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(form).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(writes).toBe(1);
      } finally { release(); }
    });
  });
}
