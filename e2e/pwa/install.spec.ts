import { expect, test, type Page } from '@playwright/test';
import { me, data } from './fixtures.mjs';
import { mkdir } from 'node:fs/promises';

const shotDir = process.env.ISSUE_292_SHOTS;
async function screenshot(page: Page, name: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: `${shotDir}/${name}`, animations: 'disabled' });
}

async function session(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/me' ? me : data;
    await route.fulfill({ json: body });
  });
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1200, venta: 1250, fechaActualizacion: new Date().toISOString() } }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
}

test('iPhone Safari guide is delayed, fits the screen and stays dismissed after reload', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone-webkit', 'Safari installation guide');
  await page.clock.install();
  await session(page);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await page.clock.fastForward(30_000);
  const guide = page.getByTestId('install-app');
  await expect(guide).toContainText('Compartir');
  await expect(guide).toContainText('Agregar a inicio');
  const box = await guide.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(844);
  await page.getByRole('button', { name: 'Ahora no, no volver a mostrar' }).click();
  await page.reload();
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(guide).toHaveCount(0);
});

test('Android install action consumes a deferred native prompt only after a click', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-chromium', 'beforeinstallprompt');
  await page.clock.install();
  await session(page);
  await page.evaluate(() => {
    const state = window as typeof window & { pwaPromptCount?: number };
    state.pwaPromptCount = 0;
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => { state.pwaPromptCount! += 1; },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    }));
  });
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('button', { name: 'Instalar app' })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { pwaPromptCount?: number }).pwaPromptCount)).toBe(0);
  await page.getByRole('button', { name: 'Instalar app' }).click();
  expect(await page.evaluate(() => (window as typeof window & { pwaPromptCount?: number }).pwaPromptCount)).toBe(1);
  // Motion's exit animation does not finish under the fake clock, so verify the persisted
  // dismissal and that the invitation stays hidden after reopening.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('imanager:install-dismissed:android'))).toBe('yes');
  await page.reload();
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
});

test('standalone restores the test session and hides installation; email login remains usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.clock.install();
  await session(page);
  await page.reload();
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass(/ios-standalone/);
});

test('real service worker reopens the shell offline but never serves API/session from cache', async ({ page, context }, info) => {
  // Playwright's Linux WebKit fails reloading a worker-controlled page offline ("internal error").
  test.skip(info.project.name === 'iphone-webkit', 'offline reload is unsupported in Playwright WebKit');
  await session(page);
  const logs: string[] = [];
  page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.active) return 'active';
    if (registration) return `pending:${registration.installing?.state ?? registration.waiting?.state}`;
    try { await navigator.serviceWorker.register('/sw.js', { scope: '/' }); return 'none:registered-now'; }
    catch (error) { return `none:${String(error)}`; }
  }), { timeout: 30_000, message: `service worker never activated; console: ${logs.join(' | ')}` }).toBe('active');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const key of keys.filter((key) => key.startsWith('imanager-static-'))) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls;
  });
  expect(cached.some((url) => url.endsWith('/'))).toBe(true);
  expect(cached.some((url) => /\/api\/|\/__\//.test(url))).toBe(false);
  await page.unroute('**/api/**');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Backend no disponible' })).toBeVisible();
  const apiFailed = await page.evaluate(async () => {
    try { await fetch('/api/me'); return false; } catch { return true; }
  });
  expect(apiFailed).toBe(true);
  await context.setOffline(false);
});


test('Android retains its own install action after the legacy iOS guide and closing the invitation', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-chromium');
  await page.addInitScript(() => localStorage.setItem('imanager:install-dismissed', 'yes'));
  await page.clock.install(); await session(page);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }),
  })));
  await page.clock.fastForward(30_000);
  await page.getByRole('button', { name: 'Ahora no, no volver a mostrar' }).click();
  await expect(page.locator('.pwa-install.compact')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Instalar app' })).toBeVisible();
  await screenshot(page, 'issue-292-mobile-android-instalar.png');
});

test('standalone dollar uses brand keyboard focus and no tap outline; captures real inventory for the manifest', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await session(page); await page.goto('/#/inv');
  await expect(page.getByText(/iPhone 16 Pro/).first()).toBeVisible();
  const dollar = page.locator('.dolar-hit');
  await expect(dollar).toBeVisible();
  // Keyboard modality before focusing; browser decides :focus-visible.
  await page.keyboard.press('Tab'); await dollar.focus();
  expect(await dollar.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('solid');
  expect(await dollar.evaluate((button) => getComputedStyle(button).outlineColor)).toBe('rgb(255, 208, 0)');
  if (info.project.name === 'desktop-chromium') await screenshot(page, 'issue-292-desktop-dolar-focus.png');
  await dollar.click();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  // Explicit pointer modality after the sheet, even on browsers that keep
  // keyboard focus-visible after programmatic focus restoration.
  await page.locator('.dolar').click({ position: { x: 2, y: 2 } });
  await dollar.focus();
  expect(await dollar.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('none');
  if (info.project.name === 'iphone-webkit') await screenshot(page, 'issue-292-mobile-iphone-dolar.png');
  if (process.env.PWA_MANIFEST_SHOTS && ['desktop-chromium', 'iphone-webkit'].includes(info.project.name)) {
    await mkdir('public/screenshots', { recursive: true });
    await page.locator('.stage').click({ position: { x: 5, y: 5 } });
    await page.screenshot({ path: `public/screenshots/${info.project.name === 'desktop-chromium' ? 'desktop' : 'mobile'}.png`, animations: 'disabled', scale: 'css' });
  }
});

async function controlled(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    return !!navigator.serviceWorker.controller;
  }), { timeout: 30_000 }).toBe(true);
}
async function deploy(page: Page) {
  await page.request.post('/__test__/deploy');
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
}

test('new worker preserves modal input, shows update toast and reloads automatically when the modal closes', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await session(page); await controlled(page);
  await page.goto('/#/clientes');
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click();
  const draft = page.getByRole('textbox', { name: 'Nombre y apellido', exact: true });
  await draft.fill('Lucía · borrador sin guardar');
  await deploy(page);
  const toast = page.getByTestId('pwa-update-toast');
  await expect(toast).toContainText('Nueva versión disponible · Actualizar');
  await expect(draft).toHaveValue('Lucía · borrador sin guardar');
  if (info.project.name === 'iphone-webkit') await screenshot(page, 'issue-292-mobile-iphone-update-toast.png');
  if (info.project.name === 'desktop-chromium') await screenshot(page, 'issue-292-desktop-update-toast.png');
  await toast.getByRole('button', { name: 'Actualizar' }).click();
  await expect(toast).toContainText('Guardá o cerrá el formulario');
  await expect(draft).toHaveValue('Lucía · borrador sin guardar');
  const navigation = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await navigation;
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(toast).toHaveCount(0);
});

test('a new release reloads an idle tab without a hard refresh', async ({ page }) => {
  await session(page); await controlled(page);
  const navigation = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
  await deploy(page); await navigation;
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(page.getByTestId('pwa-update-toast')).toHaveCount(0);
});

test('mobile Desglose backdrop consumes pointerdown and click over report tabs', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-chromium');
  await session(page); await page.goto('/#/rep');
  const select = page.getByRole('combobox', { name: 'Columna de desglose' });
  await select.click();
  const tab = page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: 'Stock', exact: true });
  const box = await tab.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByRole('dialog', { name: 'Desglose' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/rep$/);
  await expect(select).toHaveText('Medio de pago');
  await expect(tab).toHaveAttribute('aria-pressed', 'false');
});
