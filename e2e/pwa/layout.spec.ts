import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { data, me } from './fixtures.mjs';

async function session(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path === '/api/me' ? me : data });
  });
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1200, venta: 1250, fechaActualizacion: new Date().toISOString() } }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
}

async function shot(page: Page, name: string) {
  await mkdir('docs/pr-shots', { recursive: true });
  await page.screenshot({ path: `docs/pr-shots/${name}`, animations: 'disabled' });
}

test('canjes list clears the Nuevo canje bar without scrolling', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone-webkit');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  await session(page);
  await page.evaluate(() => { window.location.hash = '#/canjes'; });
  await expect(page.getByRole('heading', { level: 1, name: 'Canjes', exact: true })).toBeVisible();
  const dock = page.getByTestId('mobile-dock');
  await expect(dock).toContainText('Nuevo canje');
  const metrics = await page.evaluate(() => {
    const line = document.querySelector('.sale-line');
    const bar = document.querySelector('.mdock');
    const stage = document.querySelector('.stage');
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
    const safe = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    probe.remove();
    const dockBox = bar!.getBoundingClientRect();
    const stageBox = stage!.getBoundingClientRect();
    const checks = [...document.querySelectorAll('.sale-line .bulk-check')].map((node) => {
      const box = node.getBoundingClientRect();
      const top = Math.max(box.top, stageBox.top);
      const bottom = Math.min(box.bottom, stageBox.bottom);
      return { top, bottom, visible: bottom - top };
    }).filter((box) => box.visible >= 8);
    return {
      padding: line ? parseFloat(getComputedStyle(line).paddingBottom) : 0,
      dock: dockBox.height,
      safe,
      stageBottom: stageBox.bottom,
      dockTop: dockBox.top,
      covered: checks.filter((box) => box.top < dockBox.bottom && box.bottom > dockBox.top).length,
      visible: checks.length,
    };
  });
  expect(metrics.visible).toBeGreaterThan(0);
  expect(metrics.covered).toBe(0);
  expect(metrics.stageBottom).toBeLessThanOrEqual(metrics.dockTop + 1);
  expect(metrics.padding).toBeGreaterThanOrEqual(metrics.dock + metrics.safe - 1);
  await shot(page, 'qa-mobile-canjes.png');
});

test('client cards keep name, DNI and balance on two lines at 393px', async ({ page }, info) => {
  test.skip(info.project.name === 'android-chromium');
  if (info.project.name === 'iphone-webkit') await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  await session(page);
  await page.evaluate(() => { window.location.hash = '#/clientes'; });
  const card = page.getByTestId('client-row-pwa-client-long');
  await expect(card).toBeVisible();
  if (info.project.name === 'iphone-webkit') {
    const name = card.locator('.cl-name');
    const line = card.locator('.cl-line');
    await expect(name).toContainText('María Fernanda López Gutiérrez');
    await expect(line).toContainText('DNI 30111222333');
    await expect(line).toContainText('Saldo');
    const nameBox = (await name.boundingBox())!;
    const lineBox = (await line.boundingBox())!;
    expect(lineBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
    const overflow = await card.evaluate((node) => {
      const nameNode = node.querySelector('.cl-name')!;
      const dni = node.querySelector('.cl-dni')!;
      const balance = node.querySelector('.cl-balance')!;
      const clipped = (element: Element) => element.scrollWidth > element.clientWidth + 1;
      return { name: clipped(nameNode), dni: clipped(dni), balance: clipped(balance) };
    });
    expect(overflow).toEqual({ name: false, dni: false, balance: false });
    await shot(page, 'qa-mobile-clientes.png');
  } else {
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes', exact: true })).toBeVisible();
    await expect(page.getByText('María Fernanda López Gutiérrez')).toBeVisible();
    await shot(page, 'qa-desktop-clientes.png');
    await page.evaluate(() => { window.location.hash = '#/canjes'; });
    await expect(page.getByRole('heading', { level: 1, name: 'Canjes', exact: true })).toBeVisible();
    await shot(page, 'qa-desktop-canjes.png');
  }
});

test('Instalar app does not cover Importar on Ventas', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-chromium');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.clock.install();
  await session(page);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }),
  })));
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('button', { name: 'Instalar app' })).toBeVisible();
  await page.evaluate(() => { window.location.hash = '#/ven'; });
  await expect(page.getByRole('heading', { level: 1, name: 'Ventas', exact: true })).toBeVisible();
  const install = page.getByRole('button', { name: 'Instalar app' });
  const importar = page.getByRole('button', { name: 'Importar' });
  await expect(install).toBeVisible();
  await expect(importar).toBeVisible();
  const overlap = async () => {
    const left = (await install.boundingBox())!;
    const right = (await importar.boundingBox())!;
    const hits = left.x < right.x + right.width && left.x + left.width > right.x
      && left.y < right.y + right.height && left.y + left.height > right.y;
    expect(hits).toBe(false);
    expect(left.y + left.height).toBeLessThanOrEqual(right.y);
  };
  await overlap();
  await shot(page, 'qa-mobile-ventas-instalar.png');
  await page.getByRole('button', { name: 'Ahora no, no volver a mostrar' }).click();
  await expect(page.locator('.pwa-install.compact')).toBeVisible();
  await overlap();
  await shot(page, 'qa-mobile-ventas-instalar-compacto.png');
});
