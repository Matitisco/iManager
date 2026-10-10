import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi } from './utils';

const SHOTS = process.env.ISSUE_224_SHOTS?.trim();
const NEGATIVE_WARNING = 'El precio de salida no puede ser menor que el valor tomado';

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1270, value_sell: 1290 }, last_update: '2026-10-08T21:10:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1300,00', valor_cierre_ant: '1290,00' },
  }));
}

async function settleSheet(page: Page) {
  const sheet = page.locator('.sheet').last();
  await sheet.evaluate(async (node) => {
    const animations = node.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function shot(page: Page, name: string, target?: Page | Locator) {
  if (!SHOTS) return;
  await (target ?? page).screenshot({ path: `${SHOTS}/${name}.png` });
}

async function labelMetrics(box: Locator) {
  return box.evaluate((node) => {
    const label = node.closest('label');
    if (!label) return null;
    const style = getComputedStyle(label);
    const input = getComputedStyle(node);
    return {
      display: style.display,
      gap: style.gap,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      inputWidth: input.width,
    };
  });
}

async function fillNegativeTrade(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Cliente').fill('Mostrador');
  await dialog.getByLabel('Equipo recibido').fill('iPhone 11');
  await dialog.getByLabel('Valor tomado').fill('500000');
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Pixel libre');
  await dialog.getByLabel('Precio completo de salida').fill('400000');
  await expect(dialog.getByLabel('Diferencia')).toHaveValue('');
  await expect(dialog.getByText(NEGATIVE_WARNING)).toBeVisible();
  await expect(dialog.getByText(/Diferencia a cobrar/)).toHaveCount(0);
  await expect(dialog.getByText(/\$\s*-/)).toHaveCount(0);
  return dialog;
}

test('hides a negative trade difference and keeps completion marks compact', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'completion-visual');
  await mockDollar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootstrapStoreViaApi(page, request, email, `Visual ${testInfo.parallelIndex}`);
  await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '7').slice(-15),
    model: 'iPhone listo',
    price: 800000,
    cost: 500000,
    color: 'Negro',
  });

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const desktopTrade = await fillNegativeTrade(page);
  await settleSheet(page);
  await desktopTrade.getByLabel('Diferencia').scrollIntoViewIfNeeded();
  await shot(page, 'desktop-1440-trade-difference', desktopTrade);
  await desktopTrade.locator('.op-summary').scrollIntoViewIfNeeded();
  await shot(page, 'desktop-1440-trade-warning', desktopTrade);
  await desktopTrade.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(desktopTrade.getByText(NEGATIVE_WARNING).first()).toBeVisible();
  await expect(page.getByText(/\$\s*-/)).toHaveCount(0);

  await desktopTrade.getByLabel('Precio completo de salida').fill('600000');
  await expect(desktopTrade.getByLabel('Diferencia')).not.toHaveValue('');
  await expect(desktopTrade.getByText(/Diferencia a cobrar/)).toBeVisible();
  await desktopTrade.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(desktopTrade).toBeHidden();

  await page.getByTestId('sidebar-tab-inventory').click();
  const desktopBadge = page.getByTestId('needs-completion');
  await expect(desktopBadge).toBeVisible();
  await expect(desktopBadge).toHaveText(/para completar/i);
  const desktopRow = page.getByRole('row').filter({ has: desktopBadge });
  const desktopBadgeBox = await desktopBadge.boundingBox();
  const desktopRowBox = await desktopRow.boundingBox();
  expect(desktopBadgeBox && desktopRowBox && desktopBadgeBox.width < desktopRowBox.width / 2).toBeTruthy();
  await shot(page, 'desktop-1440-inventory-label', page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
  await page.getByTestId('sidebar-tab-inventory').click();
  const phoneBadge = page.getByTestId('needs-completion');
  await expect(phoneBadge).toBeVisible();
  const phoneCard = page.locator('.inv-card').filter({ has: phoneBadge });
  await expect(phoneCard).toBeVisible();
  const chip = await phoneBadge.evaluate((node) => {
    const style = getComputedStyle(node);
    const own = node.getBoundingClientRect();
    const card = node.closest('.inv-card')?.getBoundingClientRect();
    return {
      color: style.color,
      width: own.width,
      cardWidth: card?.width ?? 0,
      display: style.display,
    };
  });
  expect(chip.color).toBe('rgb(154, 52, 18)');
  expect(['inline-flex', 'flex']).toContain(chip.display);
  expect(chip.width).toBeGreaterThan(20);
  expect(chip.width).toBeLessThan(chip.cardWidth * 0.6);
  await shot(page, 'phone-390-inventory-label', page);

  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filtros' });
  const completion = filters.getByRole('checkbox', { name: 'Solo equipos para completar' });
  const disponible = filters.getByRole('checkbox', { name: 'Disponible' });
  await expect(completion).toBeVisible();
  expect(await labelMetrics(completion)).toEqual(await labelMetrics(disponible));
  await settleSheet(page);
  await shot(page, 'phone-390-filters', filters);
  await filters.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByTestId('sidebar-tab-more').click();
  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nuevo canje' }).click();
  const phoneTrade = await fillNegativeTrade(page);
  await settleSheet(page);
  await phoneTrade.getByLabel('Diferencia').scrollIntoViewIfNeeded();
  await shot(page, 'phone-390-trade-difference', phoneTrade);
  await phoneTrade.locator('.op-summary').scrollIntoViewIfNeeded();
  await shot(page, 'phone-390-trade-warning', phoneTrade);
});
