import { expect, test as base, devices, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { data, me } from './pwa/fixtures.mjs';

const test = base.extend({
  page: async ({ playwright, baseURL }, use, info) => {
    const desktop = info.title.includes('desktop');
    const android = info.title.includes('Android');
    const browser = await (!desktop && !android && process.env.INSTALL_466_WEBKIT === '1' ? playwright.webkit : playwright.chromium).launch();
    const context = await browser.newContext({ baseURL, ...(desktop ? { viewport: { width: 1440, height: 900 } } : { ...devices[android ? 'Pixel 7' : 'iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }) });
    const page = await context.newPage();
    try { await use(page); } finally { await browser.close(); }
  },
});
async function boot(page: Page, standalone = false) {
  await page.addInitScript(({ standalone }) => {
    if (standalone) Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    // Keep the manual state deterministic; native paths use explicit single-use events below.
    window.addEventListener('beforeinstallprompt', event => {
      if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }, { standalone });
  await page.route('https://dolarapi.com/**', r => r.fulfill({ json: { compra: 1535, venta: 1555, fechaActualizacion: new Date().toISOString() } }));
  await page.route('https://api.bluelytics.com.ar/**', r => r.fulfill({ json: { blue: { value_buy: 1535, value_sell: 1555 } } }));
  await page.route('https://mercados.ambito.com/**', r => r.fulfill({ json: { venta: '1555,00' } }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/me' ? { ...me, user: { ...me.user, displayName: 'Matías Tiscornia' }, store: { ...me.store, name: 'Tienda Ejemplo' } } : { ...data, eligible: false, visible: false, dismissed: true, steps: { store: true, stock: true, sale: true, team: true, install: false } } });
  });
  await page.clock.install();
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(page.locator('.dscreen').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The real 30-second eligibility timer is advanced by Playwright.
}
async function waitForBanner(page: Page) {
  await page.clock.runFor(30_500);
  await expect(page.getByTestId('install-app')).toBeVisible();
}
async function shot(page: Page, name: string, fullPage = false) {
  await mkdir('docs/issue-466', { recursive: true });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => innerWidth));
  await page.screenshot({ path: `docs/issue-466/${name}.png`, animations: 'disabled', fullPage });
}
async function native(page: Page, outcome: 'accepted' | 'dismissed' = 'accepted') {
  await page.evaluate((outcome) => {
    const state = window as Window & { installCalls?: number };
    state.installCalls = 0;
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => { state.installCalls = (state.installCalls ?? 0) + 1; }, userChoice: Promise.resolve({ outcome }),
    }));
  }, outcome);
}
async function more(page: Page) { await page.getByTestId('sidebar-tab-more').click(); await expect(page.getByTestId('more-screen')).toBeVisible(); }
async function help(page: Page, mobile = true) {
  if (mobile) await more(page);
  await page.getByTestId('sidebar-tab-help').click();
  await expect(page.getByText('Siempre disponible, aunque hayas ocultado la invitación')).toBeVisible();
  // Navigation scroll behavior belongs to #450; frame this screen from its top for evidence.
  await page.locator('main.stage').evaluate(node => { node.scrollTop = 0; });
  await page.clock.runFor(7000);
}

test('iPhone banner, snooze, Más, expiry and form suppression', async ({ page }) => {
  await boot(page); await waitForBanner(page); await shot(page, 'iphone-dashboard');
  for (const button of await page.getByTestId('install-app').getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Ahora no', exact: true }).click();
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await expect(page.locator('.pwa-notice')).toContainText('Más › Instalar app');
  const notice = (await page.locator('.pwa-notice').boundingBox())!;
  const bar = (await page.getByTestId('mobile-tab-bar').boundingBox())!;
  expect(notice.y + notice.height).toBeLessThan(bar.y);
  await shot(page, 'iphone-ahora-no');
  await more(page); await expect(page.getByTestId('install-card')).toBeVisible(); await shot(page, 'iphone-mas');
  await page.getByTestId('sidebar-tab-dashboard').click();
  await page.clock.fastForward(7 * 86400000); await page.clock.runFor(30_500);
  await expect(page.getByTestId('install-app')).toBeVisible();
  // Real global form from Dashboard, with no business write.
  await page.getByRole('button', { name: /Nueva venta|Registrar venta/i }).first().click();
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await expect(page.locator('[role="dialog"]')).toBeVisible(); await shot(page, 'iphone-formulario');
});

test('iPhone permanent dismissal leaves Ayuda only and survives reload', async ({ page }) => {
  await boot(page); await waitForBanner(page);
  await page.getByRole('button', { name: 'No volver a mostrar', exact: true }).click();
  await more(page); await expect(page.getByTestId('install-card')).toHaveCount(0);
  await expect(page.locator('.pwa-notice')).toContainText('Ayuda'); await expect(page.locator('.pwa-notice')).not.toContainText('Más'); await shot(page, 'iphone-no-volver');
  await help(page); await shot(page, 'iphone-ayuda');
  await page.getByRole('button', { name: /Instalar la app en el celular/ }).click(); await expect(page.getByRole('dialog', { name: 'Instalá iManager' })).toBeVisible();
  await shot(page, 'iphone-guia'); await page.getByRole('button', { name: 'Cerrar ayuda de instalación' }).click();
  await page.reload(); await expect(page.locator('.desk-app')).toBeVisible(); await page.clock.runFor(31_000); await expect(page.getByTestId('install-app')).toHaveCount(0);
  await more(page); await expect(page.getByTestId('install-card')).toHaveCount(0);
});

test('Android white manual banner, late native prompt and native dismissal', async ({ page }) => {
  await boot(page); await waitForBanner(page);
  await expect(page.getByTestId('install-app')).toContainText('Agregar a pantalla principal');
  await expect(page.getByTestId('install-app')).toHaveCSS('background-color', 'rgb(255, 255, 255)'); await shot(page, 'android-manual');
  await native(page, 'dismissed'); await expect(page.getByTestId('install-app').getByRole('button', { name: 'Instalar app' })).toBeVisible(); await shot(page, 'android-native');
  await page.getByTestId('install-app').getByRole('button', { name: 'Instalar app' }).click();
  expect(await page.evaluate(() => (window as Window & { installCalls?: number }).installCalls)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('imanager:install-preference:v2')!).dismissedForever)).toBe(false);
  await more(page); await expect(page.getByTestId('install-card')).toBeVisible(); await expect(page.getByTestId('install-app')).toHaveCount(0);
});

test('iPhone standalone has no invitation or Más card', async ({ page }) => {
  await boot(page, true); await page.clock.runFor(31_000); await expect(page.getByTestId('install-app')).toHaveCount(0);
  await more(page); await expect(page.getByTestId('install-card')).toHaveCount(0); await shot(page, 'iphone-standalone');
});

test('desktop 1440 has only help entry and no automatic invitation', async ({ page }) => {
  await boot(page); await page.clock.runFor(31_000); await expect(page.getByTestId('install-app')).toHaveCount(0); await expect(page.getByTestId('install-card')).toHaveCount(0);
  await help(page, false); await shot(page, 'desktop-ayuda');
});
