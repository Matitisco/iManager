import { expect, test, type Page } from '@playwright/test';

async function session(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/me' ? {
      user: { id: 'pwa-user', firebaseUid: 'test-pwa-owner-imanager-test', displayName: 'Ana', email: 'pwa.owner@imanager.test', avatarUrl: null },
      store: { id: 'pwa-store', name: 'Tienda PWA', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', exchangeMode: 'manual', manualBuy: 1200, manualSell: 1250 },
      membership: { role: 'OWNER', isDefault: true }, stores: [], onboardingRequired: false,
    } : { inventory: [], sales: [], clients: [], tradeIns: [], notifications: [], repairs: [], categories: [], catalogs: {}, members: [] };
    await route.fulfill({ json: body });
  });
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('mobile-store-name')).toHaveText('Tienda PWA');
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
  await expect(page.getByTestId('mobile-store-name')).toHaveText('Tienda PWA');
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
  await expect.poll(() => page.evaluate(() => localStorage.getItem('imanager:install-dismissed'))).toBe('yes');
  await page.reload();
  await expect(page.getByTestId('mobile-store-name')).toHaveText('Tienda PWA');
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
});

test('standalone restores the test session and hides installation; email login remains usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.clock.install();
  await session(page);
  await page.reload();
  await expect(page.getByTestId('mobile-store-name')).toHaveText('Tienda PWA');
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
    return registration?.active ? 'active' : registration ? `pending:${registration.installing?.state ?? registration.waiting?.state}` : 'none';
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
