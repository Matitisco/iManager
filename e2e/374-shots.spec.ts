import { expect, test } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const settings = {
  enabled: true,
  frequency: 'MONTHLY',
  recipients: ['natan@iphoneveron.test'],
  lastSentAt: null,
  lastPeriodLabel: null,
  lastError: null,
};

for (const width of [390, 1440]) {
  test(`reporte automático ${width}`, async ({ page }) => {
    const mobile = width === 390;
    await page.setViewportSize({ width, height: mobile ? 844 : 900 });
    await page.addInitScript(() => {
      localStorage.setItem('imanager:install-dismissed:ios', 'yes');
      localStorage.setItem('imanager:install-dismissed:android', 'yes');
    });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-19T12:00:00Z' } }));
    await page.context().route('**/api/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const json = (value: unknown, status = 200) => route.fulfill({ json: value, status, headers: cors });
      if (path === '/api/me') {
        return json({
          ...me,
          user: { ...me.user, displayName: 'Natan', email: 'natan@iphoneveron.test' },
          store: { ...me.store, name: 'iPhone Veron', email: 'natan@iphoneveron.test', instagram: 'iphoneveron', phone: '1144445555' },
          membership: { role: 'OWNER', isDefault: true },
          onboardingRequired: false,
        });
      }
      if (path === '/api/onboarding/progress') {
        return json({ stage: 'done', eligible: false, active: false, dismissed: true, stock: 1, sales: true, team: true, catalog: false, installed: false, visible: false, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: true } });
      }
      if (path.endsWith('/members')) return json({ members: [] });
      if (path === '/api/invitations') return json({ invitations: [] });
      if (path === '/api/stores/current/periodic-report') return json({ settings });
      if (path === '/api/notifications') return json({ notifications: [] });
      return json({ inventory: [], sales: [], clients: [], tradeIns: [], repairs: [], categories: [], catalogs: {}, drafts: [] });
    });
    await page.goto('/');
    await page.getByTestId('login-email').fill('natan@iphoneveron.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.desk-app')).toBeVisible();
    await page.goto('/#/config');
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
    const row = page.getByRole('button', { name: /Reporte automático/ });
    await expect(row).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/pr-shots/374-config-${width}.png`, animations: 'disabled' });
    await row.click();
    await expect(page.getByRole('dialog', { name: 'Reporte automático' })).toBeVisible();
    await expect(page.getByTestId('periodic-report-recipients')).toHaveValue('natan@iphoneveron.test');
    await page.screenshot({ path: `docs/pr-shots/374-form-${width}.png`, animations: 'disabled' });
  });
}
