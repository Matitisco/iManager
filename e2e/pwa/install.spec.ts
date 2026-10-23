import { expect, test, type Page } from '@playwright/test';
import { me, data } from './fixtures.mjs';
import { mkdir } from 'node:fs/promises';

const shotDir = process.env.ISSUE_292_SHOTS;
async function screenshot(page: Page, name: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: `${shotDir}/${name}`, animations: 'disabled' });
}
async function qaScreenshot(page: Page, name: string) {
  const dir = process.env.ISSUE_300_QA_SHOTS;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/issue-300-qa-${name}.png`, animations: 'disabled' });
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

async function openInventory(page: Page) {
  // Desktop opens the Stock group; mobile retains the Equipos shortcut.
  const stock = page.getByRole('button', { name: 'Stock', exact: true });
  if (await stock.isVisible()) await stock.click();
  else await page.getByRole('button', { name: 'Equipos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
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
  await page.getByRole('button', { name: 'No volver a mostrar', exact: true }).click();
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
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('imanager:install-preference:v2')!).dismissedForever)).toBe(false);
  await page.reload();
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
});

test('@smoke standalone restores the test session and hides installation; email login remains usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.clock.install();
  await session(page);
  await page.reload();
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass(/ios-standalone/);
});

test('@smoke real service worker reopens the shell offline but never serves API/session from cache', async ({ page, context }, info) => {
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
  // The shell comes back from the app cache. The session is the last one stored
  // on the device, not a cached /api/me response.
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backend no disponible' })).toHaveCount(0);
  const apiFailed = await page.evaluate(async () => {
    try { await fetch('/api/me'); return false; } catch { return true; }
  });
  expect(apiFailed).toBe(true);
  await context.setOffline(false);
});


test('Android preserves legacy dismissal and leaves installation available in Ayuda', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-chromium');
  await page.addInitScript(() => localStorage.setItem('imanager:install-dismissed', 'yes'));
  await page.clock.install(); await session(page);
  await page.clock.fastForward(30_000);
  await expect(page.getByTestId('install-app')).toHaveCount(0);
  await page.getByTestId('sidebar-tab-more').click();
  await expect(page.getByTestId('install-card')).toHaveCount(0);
  await page.getByTestId('sidebar-tab-help').click();
  await page.getByRole('button', { name: /Instalar la app en el celular/ }).click();
  await expect(page.getByRole('dialog', { name: 'Instalá iManager' })).toBeVisible();
  await screenshot(page, 'issue-292-mobile-android-instalar.png');
});

test('standalone dollar uses brand keyboard focus and no tap outline; captures real inventory for the manifest', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await session(page);
  await openInventory(page);
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
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
  // The pill sits under the sidebar or the sticky header, so a corner click never lands.
  // A real pointer hit on the stage switches modality before the programmatic focus.
  await page.locator('main.stage').click({ position: { x: 8, y: 8 } });
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
async function deploy(page: Page, mode = 'all') {
  await page.request.post(`/__test__/deploy?mode=${mode}`);
  if (mode !== 'version') await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  else await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

async function applyVisibleUpdate(page: Page) {
  const toast = page.getByTestId('pwa-update-toast');
  await expect(toast).toBeVisible();
  await expect(page.locator('#boot-splash')).toHaveCount(0);
  const navigation = page.waitForEvent('load');
  await toast.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await navigation;
}

test('new worker preserves modal input, shows update toast and waits for confirmation after the modal closes', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await session(page); await controlled(page);
  await page.evaluate(() => { window.location.hash = '#/clientes'; });
  await expect(page.getByRole('heading', { level: 1, name: 'Clientes', exact: true })).toBeVisible();
  const dockNuevo = page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo cliente', exact: true });
  if (await dockNuevo.count()) await dockNuevo.click();
  else await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click();
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
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(draft).toHaveCount(0);
  await applyVisibleUpdate(page);
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(toast).toHaveCount(0);
});

test('a new release keeps the foreground tab until the user updates', async ({ page }) => {
  await session(page); await controlled(page);
  await deploy(page);
  await applyVisibleUpdate(page);
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(page.getByTestId('pwa-update-toast')).toHaveCount(0);
});

test('version.json offers an update when the worker never claims the open page', async ({ page }) => {
  await session(page);
  await deploy(page, 'version');
  await applyVisibleUpdate(page);
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(page.getByTestId('pwa-update-toast')).toHaveCount(0);
});

test('version.json keeps the draft and offers an update after the form closes', async ({ page }) => {
  await session(page);
  await page.evaluate(() => { window.location.hash = '#/ven'; });
  await expect(page.getByRole('heading', { level: 1, name: 'Ventas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar venta', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  const draft = dialog.getByRole('combobox', { name: 'Cliente' });
  await draft.fill('Borrador de venta sin guardar');
  await deploy(page, 'version');
  const toast = page.getByTestId('pwa-update-toast');
  await expect(toast).toContainText('Nueva versión disponible · Actualizar');
  await expect(draft).toHaveValue('Borrador de venta sin guardar');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
  await expect(dialog).toBeHidden();
  await applyVisibleUpdate(page);
  await expect(page.locator('.desk-app')).toBeVisible();
  await expect(toast).toHaveCount(0);
});

test.describe('update after persistence', () => {
  // Keep the delayed POST in Playwright's router. WebKit can otherwise hand it
  // directly to the worker/server; worker-driven updates are covered above.
  test.use({ serviceWorkers: 'block' });
  test('a pending update preserves the save and applies only after confirmation', async ({ page }) => {
    await session(page);
    await page.evaluate(() => { window.location.hash = '#/clientes'; });
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes', exact: true })).toBeVisible();
    let releaseSave!: () => void;
    let receivedSave!: () => void;
    const saving = new Promise<void>((resolve) => { receivedSave = resolve; });
    const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
    let saved: typeof data.clients[number] | undefined;
    await page.route('**/api/clients', async (route) => {
      if (route.request().method() === 'POST') {
        saved = { ...data.clients[0], ...route.request().postDataJSON(), id: 'qa-saved-client' };
        receivedSave();
        await gate;
        await route.fulfill({ json: { client: saved } });
      } else await route.fulfill({ json: { clients: saved ? [saved, ...data.clients] : data.clients } });
    });
    await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
    await dialog.getByRole('textbox', { name: 'Nombre y apellido', exact: true }).fill('Cliente guardado antes de actualizar');
    await deploy(page, 'version');
    const toast = page.getByTestId('pwa-update-toast');
    await expect(toast).toContainText('Nueva versión disponible · Actualizar');
    let documentRequests = 0;
    // History metadata updates also emit framenavigated. Only a main-frame
    // document request represents the reload that must wait for persistence.
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests += 1;
    });
    await dialog.getByRole('button', { name: 'Guardar cliente', exact: true }).click();
    await saving;
    // Hold persistence longer than the safety observer's 100 ms debounce.
    await page.waitForTimeout(300);
    await expect(dialog).toBeVisible(); await expect(toast).toBeVisible();
    expect(documentRequests).toBe(0);
    releaseSave();
    await expect(dialog).toBeHidden();
    expect(documentRequests).toBe(0);
    await applyVisibleUpdate(page);
    await expect(page.locator('.desk-app')).toBeVisible();
    await expect(toast).toHaveCount(0);
    await expect(page.getByText('Cliente guardado antes de actualizar', { exact: true }).first()).toBeVisible();
    expect(documentRequests).toBe(1);
  });
});

test('mobile update toast stays above the sales bottom actions', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-chromium', 'Mobile geometry');
  await session(page); await controlled(page);
  await page.getByTestId('sidebar-tab-sales').tap();
  await page.getByRole('button', { name: 'Buscar', exact: true }).tap();
  const search = page.getByPlaceholder('Buscar cliente, equipo o número');
  await search.fill('Lucía'); await search.blur();
  await deploy(page, 'version');
  const toast = page.getByTestId('pwa-update-toast'); await expect(toast).toBeVisible();
  const dock = page.getByTestId('mobile-dock'); await expect(dock).toBeVisible();
  const toastBox = (await toast.boundingBox())!;
  const dockBox = (await dock.boundingBox())!;
  expect(toastBox.y).toBeGreaterThanOrEqual(12);
  expect(toastBox.y).toBeLessThan(100);
  expect(toastBox.y + toastBox.height).toBeLessThan(dockBox.y);
  await expect(dock.getByRole('button', { name: 'Registrar venta', exact: true })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Importar', exact: true })).toBeVisible();
  if (info.project.name === 'iphone-webkit') await qaScreenshot(page, 'toast-mobile');
  await dock.getByRole('button', { name: 'Registrar venta', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: 'Registrar venta' })).toBeVisible();
});

test('mobile Desglose backdrop consumes pointerdown and click over report tabs', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-chromium');
  await page.addInitScript(() => {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  await session(page);
  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-reports').click();
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
  const select = page.getByRole('combobox', { name: 'Columna de desglose' });
  const tab = page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: 'Stock', exact: true });
  await tab.scrollIntoViewIfNeeded();
  const box = await tab.boundingBox();
  // Opening by event keeps the tabs on screen; a normal click scrolls the selector and the tap misses the backdrop.
  await select.dispatchEvent('click');
  await expect(page.getByRole('dialog', { name: 'Desglose' })).toBeVisible();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByRole('dialog', { name: 'Desglose' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/analisis\/reportes$/);
  await expect(select).toHaveText('Medio de pago');
  await expect(tab).toHaveAttribute('aria-pressed', 'false');
});


test('new worker activates after a hard reload with multiple controlled tabs open', async ({ page, context }) => {
  await session(page); await controlled(page);
  const second = await context.newPage();
  await second.goto('/', { waitUntil: 'domcontentloaded' }); await controlled(second);
  // An open form keeps both clients alive while controllerchange occurs.
  await openInventory(page);
  await page.getByRole('button', { name: 'Registrar equipo', exact: true }).click();
  const before = await page.evaluate(() => caches.keys());
  const release = Number(await (await page.request.post('/__test__/deploy?mode=sw')).text());
  await second.reload({ waitUntil: 'domcontentloaded' });
  await second.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect.poll(() => page.evaluate(async (previous) => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    const cacheKeys = await caches.keys();
    return { active: registration.active?.state, waiting: !!registration.waiting, installing: !!registration.installing,
      release: cacheKeys.some((key) => key.startsWith('imanager-static-e2e-') && !previous.includes(key)) };
  }, before), { timeout: 30_000 }).toEqual({ active: 'activated', waiting: false, installing: false, release: true });
  // Query the actual controlling worker in both tabs. WebKit can retain an
  // 'activating' snapshot on its ServiceWorker objects after activation.
  for (const tab of [page, second]) {
    await expect.poll(async () => {
      try {
        return await tab.evaluate(() => new Promise<number>((resolve) => {
          const channel = new MessageChannel();
          const timeout = window.setTimeout(() => { channel.port1.close(); resolve(-1); }, 1000);
          channel.port1.onmessage = (event) => { window.clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
          navigator.serviceWorker.controller?.postMessage('TEST_RELEASE', [channel.port2]);
        }));
      } catch (error) {
        // An idle tab reloads on controllerchange; poll its new controlling worker.
        if (error instanceof Error && error.message.includes('Execution context was destroyed')) return -1;
        throw error;
      }
    }).toBe(release);
  }
  await second.close();
});
