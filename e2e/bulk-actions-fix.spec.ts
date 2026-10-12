import { mkdirSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createSaleViaApi, createTradeInViaApi } from './utils';

const shots = 'docs/pr-shots';
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });

async function scrollToEnd(page: import('@playwright/test').Page, target: import('@playwright/test').Locator) {
  await target.evaluate((node) => {
    node.scrollIntoView({ block: 'end', inline: 'nearest' });
    let current: HTMLElement | null = node instanceof HTMLElement ? node : null;
    while (current) {
      if (current.scrollHeight > current.clientHeight + 1) current.scrollTop = current.scrollHeight;
      current = current.parentElement;
    }
    const scrolling = document.scrollingElement;
    if (scrolling) scrolling.scrollTop = scrolling.scrollHeight;
    window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  });
}

async function openPhoneSection(page: import('@playwright/test').Page, hash: string) {
  const install = page.getByRole('button', { name: 'Ahora no, no volver a mostrar' });
  if (await install.isVisible().catch(() => false)) await install.click();
  await page.evaluate((next) => { window.location.hash = next; }, hash);
}

test.describe('bulk action follow-up on iPhone', () => {
  test.use({ ...iphone, viewport: { width: 390, height: 844 } });

  test('keeps long press, client lines and the last canje checkbox clear', async ({ page, request }, testInfo) => {
    mkdirSync(shots, { recursive: true });
    const email = buildTestEmail(testInfo, 'bulk-fix-phone');
    await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1500, venta: 1540, fechaActualizacion: new Date().toISOString() } }));
    await bootstrapStoreViaApi(page, request, email, 'iManager · Ajustes');
    await createClientViaApi(request, email, {
      name: 'María Fernanda López Gutiérrez',
      dni: '30111222333',
      phone: '2615551234',
      email: 'maria.fernanda.lopez@ejemplo-largo.com',
      pendingBalance: 1250000,
    });
    const today = new Date().toISOString();
    for (let index = 0; index < 8; index += 1) {
      await createTradeInViaApi(request, email, {
        date: today,
        clientName: `Cliente canje ${index}`,
        deviceReceived: `iPhone recibido ${index}`,
        deviceGiven: `Equipo entregado ${index}`,
        takeValue: 350 + index,
      });
    }
    await page.reload();
    await openPhoneSection(page, '#/clientes');
    const name = page.locator('.cl-name').first();
    const line = page.locator('.cl-line').first();
    await expect(name).toBeVisible();
    await expect(name).toHaveCSS('white-space', 'normal');
    await expect(line).toContainText('DNI 30111222333');
    await expect(line).toContainText('Saldo');
    const nameBox = (await name.boundingBox())!;
    const lineBox = (await line.boundingBox())!;
    expect(lineBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
    const clipped = await name.evaluate((node) => node.scrollWidth > node.clientWidth + 1 || (node.textContent ?? '').includes('…'));
    const dniClipped = await line.locator('.cl-dni').evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(clipped).toBe(false);
    expect(dniClipped).toBe(false);
    await page.screenshot({ path: `${shots}/issue-285-fix-mobile-iphone-clientes.png`, animations: 'disabled' });

    const card = page.locator('.phone-row').first();
    await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 180, clientY: 420, button: 0 });
    await expect(page.getByRole('checkbox', { name: /Seleccionar María/ })).toBeChecked();
    await card.dispatchEvent('pointerup', { pointerType: 'touch' });
    await card.dispatchEvent('contextmenu');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /Seleccionar María/ })).toBeChecked();
    await page.screenshot({ path: `${shots}/issue-285-fix-mobile-iphone-longpress.png`, animations: 'disabled' });

    await openPhoneSection(page, '#/canjes');
    await expect(page.getByTestId('mobile-dock')).toContainText('Nuevo canje');
    const checks = page.getByRole('checkbox', { name: /Seleccionar C-/ });
    await expect(checks).toHaveCount(8);
    const dock = page.getByTestId('mobile-dock');
    const visibleAboveDock = async () => {
      const dockBox = (await dock.boundingBox())!;
      const stage = (await page.locator('.stage').boundingBox())!;
      for (const check of await checks.all()) {
        const box = await check.boundingBox();
        if (!box) continue;
        const visibleTop = Math.max(box.y, stage.y);
        const visibleBottom = Math.min(box.y + box.height, stage.y + stage.height);
        if (visibleBottom - visibleTop < 8) continue;
        expect(visibleBottom).toBeLessThanOrEqual(dockBox.y + 1);
      }
    };
    await visibleAboveDock();
    const checkbox = checks.last();
    await scrollToEnd(page, checkbox);
    await expect(checkbox).toBeInViewport();
    const checkBox = (await checkbox.boundingBox())!;
    const dockBox = (await dock.boundingBox())!;
    expect(checkBox.y + checkBox.height).toBeLessThanOrEqual(dockBox.y + 1);
    await page.screenshot({ path: `${shots}/issue-285-fix-mobile-iphone-canjes.png`, animations: 'disabled' });
  });
});

test.describe('bulk action follow-up on desktop sales', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keeps sale codes and large amounts on one line', async ({ page, request }, testInfo) => {
    mkdirSync(shots, { recursive: true });
    const email = buildTestEmail(testInfo, 'bulk-fix-desktop');
    await bootstrapStoreViaApi(page, request, email, 'iManager · Ventas');
    const start = Date.now();
    for (let index = 0; index < 9; index += 1) {
      await createSaleViaApi(request, email, {
        date: new Date(start + index * 60_000).toISOString(),
        clientName: `Cliente venta ${index + 1}`,
        deviceLabel: `iPhone ${index + 1}`,
        amount: index === 8 ? 12_500_000 : 350_000 + index,
        paymentMethod: 'EFECTIVO',
        status: 'COMPLETADA',
      });
    }
    await page.reload();
    await page.getByTestId('sidebar-tab-sales').click();
    const code = page.locator('b.keep', { hasText: '#V-0009' });
    await expect(code).toBeVisible();
    await expect(code).toHaveCSS('white-space', 'nowrap');
    const amount = page.locator('b.keep', { hasText: /12\.500\.000|12,500,000/ });
    await expect(amount).toHaveCSS('white-space', 'nowrap');
    const wrapped = await code.evaluate((node) => node.scrollHeight > node.clientHeight + 2);
    const amountWrapped = await amount.evaluate((node) => node.scrollHeight > node.clientHeight + 2);
    expect(wrapped).toBe(false);
    expect(amountWrapped).toBe(false);
    await page.screenshot({ path: `${shots}/issue-285-fix-desktop-ventas.png`, animations: 'disabled', fullPage: false });
  });
});
