import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, createInventoryItemViaApi, fetchSales, fetchTradeIns } from './utils';

const shots = process.env.ISSUE_288_SHOTS;

async function shot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${shots}/issue-288-${name}.png`, animations: 'disabled' });
}

async function expectPhoneSheetCoversNavigation(page: Page, dialog: Locator) {
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect.poll(() => dialog.evaluate((sheet) => Math.abs(sheet.getBoundingClientRect().bottom - window.innerHeight))).toBeLessThan(1);
  const geometry = await dialog.evaluate((sheet) => {
    const overlay = sheet.closest('.ov')!;
    const navigation = document.querySelector('[data-testid="mobile-tab-bar"]')!;
    const nav = navigation.getBoundingClientRect();
    const rect = overlay.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const elements = document.elementsFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2);
    return {
      overlay: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      sheetWidth: sheetRect.width,
      sheetIndex: elements.findIndex((node) => node === sheet || sheet.contains(node)),
      navIndex: elements.findIndex((node) => node === navigation || navigation.contains(node)),
      bottomCovered: [1, window.innerWidth / 2, window.innerWidth - 1].every((x) => {
        const top = document.elementFromPoint(x, window.innerHeight - 1);
        return top === sheet || (top != null && sheet.contains(top));
      }),
      height: window.innerHeight, width: window.innerWidth,
    };
  });
  expect(geometry.overlay).toEqual({ top: 0, left: 0, right: geometry.width, bottom: geometry.height });
  expect(geometry.sheetWidth).toBe(geometry.width);
  expect(geometry.sheetIndex).toBeGreaterThanOrEqual(0);
  expect(geometry.navIndex).toBeGreaterThan(geometry.sheetIndex);
  expect(geometry.bottomCovered).toBe(true);
  await expect(page.getByTestId('mobile-dock')).toBeHidden();
}

async function openSale(page: Page, phone: boolean, code: string) {
  if (phone) await page.getByTestId('sales-timeline').getByText('Ana Pérez', { exact: true }).click();
  else await page.getByRole('row').filter({ hasText: 'Ana Pérez' }).click();
  const dialog = page.getByRole('dialog', { name: code, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const device of [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, phone: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, phone: true },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport });
    test('keeps cancelled trade copy, technical notices and sale overlays consistent', async ({ page, request }, testInfo) => {
      test.setTimeout(120_000);
      const email = `qa288-${device.name}-${testInfo.parallelIndex}-${Date.now()}@imanager.test`;
      await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-11T12:00:00-03:00' } }));
      await bootstrapStoreViaApi(page, request, email, 'iManager · Ventas y canjes');
      await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 14', capacity: '128GB', price: 650000 });
      await page.reload();
      await page.getByTestId('sidebar-tab-sales').click();
      await (device.phone ? page.getByTestId('mobile-dock') : page).getByRole('button', { name: 'Registrar venta', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Registrar venta' });
      await form.getByLabel('Cliente').fill('Ana Pérez');
      await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('iPhone 14');
      await form.getByRole('option', { name: /iPhone 14/ }).click();
      await form.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
      await expect(form).toBeHidden();
      const initial = (await fetchSales(request, email)).sales[0];
      const code = `V-${String(initial.saleNumber).padStart(4, '0')}`;
      const detail = await openSale(page, device.phone, code);
      if (device.phone) await expectPhoneSheetCoversNavigation(page, detail);
      await detail.getByRole('button', { name: 'Editar', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Editar operación' });
      await expect(editor).toBeVisible();
      if (device.phone) {
        await expectPhoneSheetCoversNavigation(page, editor);
        await editor.getByTestId('sale-trade-fold').locator('summary').click();
      }
      await editor.getByRole('checkbox', { name: 'Tiene canje' }).check();
      await editor.getByLabel('Equipo recibido').fill('iPhone 11 64GB');
      await editor.getByLabel('Valor tomado').fill('200000');
      await expect(page.locator('.toast.show')).toBeHidden();
      if (device.phone) {
        await editor.locator('.sheet-scroll').evaluate((node) => { node.scrollTop = node.scrollHeight; });
        await expect(editor.getByRole('button', { name: 'Guardar cambios' })).toBeInViewport();
        await expectPhoneSheetCoversNavigation(page, editor);
        await editor.locator('.sheet-scroll').evaluate((node) => { node.scrollTop = 0; });
      }
      await shot(page, `${device.name}-edicion-venta`);
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(editor).toBeHidden();
      const toast = page.locator('.toast.show');
      await expect(toast).toContainText('estado técnico del recibido: Pendiente');
      await expect(toast).not.toContainText('recibido en revisión');
      await shot(page, `${device.name}-aviso-pendiente`);
      const trade = (await fetchTradeIns(request, email)).tradeIns[0];
      expect(trade.status).toBe('PENDIENTE');

      const savedDetail = await openSale(page, device.phone, code);
      await expect(savedDetail.getByText('Pendiente', { exact: true })).toBeVisible();
      await expect(page.locator('.toast.show')).toBeHidden();
      if (device.phone) await expectPhoneSheetCoversNavigation(page, savedDetail);
      await shot(page, `${device.name}-detalle-venta`);
      await savedDetail.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(editor.getByRole('checkbox', { name: 'Tiene canje' })).toBeChecked();
      await editor.getByRole('checkbox', { name: 'Tiene canje' }).uncheck();
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(editor).toBeHidden();
      const removed = (await fetchTradeIns(request, email)).tradeIns[0];
      expect(removed).toMatchObject({ id: trade.id, status: 'CANCELADO', confirmationStatus: 'CANCELLED', removedFromSaleNumber: initial.saleNumber });
      expect((await fetchSales(request, email)).sales[0]).toMatchObject({ id: initial.id, status: 'COMPLETADA', tradeInId: null });

      // Reload to prove the message comes from persisted history, not an optimistic UI label.
      await page.reload();
      if (device.phone) await page.getByTestId('sidebar-tab-more').click();
      await page.getByTestId('sidebar-tab-tradeins').click();
      const record = device.phone ? page.getByTestId('tradeins-timeline') : page.getByRole('table', { name: 'Canjes' });
      await expect(record.getByText(`Canje quitado de la venta ${code}`, { exact: true })).toBeVisible();
      await expect(record).not.toContainText('Operación cancelada');
      const pill = record.locator('.spill').filter({ hasText: 'Cancelado' });
      await expect(pill).toHaveAttribute('style', /--pc: #DC4C4C/i);
      await expect(pill.locator('svg')).toHaveAttribute('data-icon', 'cerrar');
      const chip = page.getByRole('button', { name: 'Cancelado', exact: true });
      await chip.scrollIntoViewIfNeeded();
      await expect(chip.locator('svg')).toHaveAttribute('data-icon', 'cerrar');
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await expect(chip).toHaveCSS('background-color', 'rgb(220, 76, 76)');
      if (device.phone) {
        const chips = page.locator('.dbar .wchips');
        await expect(chips).toHaveCSS('flex-wrap', 'nowrap');
        const tops = await chips.locator('button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top));
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      }
      await shot(page, `${device.name}-cancelado-canje-quitado`);
    });
  });
}
