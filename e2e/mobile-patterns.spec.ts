import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi } from './utils';

const SHOTS = process.env.MOBILE_PATTERN_SHOTS?.trim();

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

async function settleMotion(page: Page, selector: string) {
  await page.locator(selector).first().evaluate(async (node) => {
    const animations = node.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function expectFits(page: Page) {
  const readReport = () => page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    const roots = ['.mhead', '.mtab', '.stage', '.mdock', '.ov', '.sheet', '.ctx', '.dialog'].flatMap((selector) => [...document.querySelectorAll(selector)]);
    for (const root of roots) {
      const nodes = [root, ...root.querySelectorAll('*')];
      for (const node of nodes) {
        if (!(node instanceof Element) || node.closest('.toast')) continue;
        if (node.closest('.wchips, .gfilters, .dkanban') && !node.matches('.wchips, .gfilters, .dkanban')) continue;
        const box = node.getBoundingClientRect();
        if (box.width < 1 && box.height < 1) continue;
        if (box.left < -1 || box.right > width + 1) {
          const label = node.getAttribute('data-testid') || (typeof node.className === 'string' ? node.className : node.tagName);
          outside.push(`${String(label).slice(0, 70)} [${Math.round(box.left)}…${Math.round(box.right)}]`);
          if (outside.length >= 8) return { extra, outside };
        }
      }
    }
    return { extra, outside };
  });
  // Section changes and viewport resizing can overlap the tab pill transition.
  // Assert the settled geometry without mistaking an animation frame for overflow.
  await expect.poll(async () => (await readReport()).outside).toEqual([]);
  await expect.poll(async () => (await readReport()).extra).toBeLessThanOrEqual(1);
}

test.describe('desktop stays on the sidebar', () => {
  test('keeps inline actions and does not mount the phone dock', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'patterns-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Desk ${testInfo.parallelIndex}`);
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.getByRole('button', { name: 'Registrar equipo' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar modelo o color')).toBeVisible();
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('row-menu')).toHaveCount(0);
  });
});

test.describe('phone patterns', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pins the dock above the tab bar, covers it with sheets, and keeps chips in one row', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'patterns-phone');
    const model = `iPhone patron ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Patrones ${testInfo.parallelIndex}`);
    await createInventoryItemViaApi(request, email, {
      imei: String(Date.now()).padStart(15, '4').slice(-15),
      model,
      price: 650000,
    });
    await page.reload();
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();

    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar equipo' })).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar modelo o color')).toHaveCount(0);
    const chips = page.locator('.wchips');
    await expect(chips).toBeVisible();
    const chipStyle = await chips.evaluate((node) => {
      const style = getComputedStyle(node);
      return { wrap: style.flexWrap, overflow: style.overflowX };
    });
    expect(chipStyle.wrap).toBe('nowrap');
    expect(chipStyle.overflow).toBe('auto');
    await expect(page.getByTestId('row-menu')).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patterns-390-inventory.png`, fullPage: true });

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar equipo' }).click();
    const form = page.getByRole('dialog', { name: 'Registrar equipo' });
    await expect(form.locator('.sheet-grab')).toBeVisible();
    await expect(form.locator('.sheet-foot').getByRole('button', { name: 'Guardar equipo' })).toBeVisible();
    await expect(form.locator('.sheet-foot').getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await settleMotion(page, '.sheet');
    const placed = await page.evaluate(() => {
      const sheetNode = document.querySelector('.sheet')!;
      const sheet = sheetNode.getBoundingClientRect();
      const tabNode = document.querySelector('.mtab')!;
      const tab = tabNode.getBoundingClientRect();
      const foot = document.querySelector('.sheet-foot')!.getBoundingClientRect();
      const hit = document.elementsFromPoint(tab.left + tab.width / 2, tab.top + tab.height / 2);
      return {
        sheetBottom: sheet.bottom,
        height: window.innerHeight,
        footBottom: foot.bottom,
        sheetIndex: hit.findIndex((node) => node === sheetNode || sheetNode.contains(node)),
        tabIndex: hit.findIndex((node) => node === tabNode || tabNode.contains(node)),
        grab: document.querySelector('.sheet-grab')!.getBoundingClientRect().height,
      };
    });
    expect(placed.grab).toBeGreaterThan(0);
    expect(placed.sheetBottom).toBe(placed.height);
    expect(placed.footBottom).toBe(placed.height);
    expect(placed.sheetIndex).toBeGreaterThanOrEqual(0);
    expect(placed.tabIndex).toBeGreaterThan(placed.sheetIndex);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patterns-390-sheet.png` });
    await form.getByRole('button', { name: 'Cerrar' }).click();
    await expect(form).toBeHidden();

    await page.getByTestId('row-menu').click();
    const menu = page.locator('.ctx');
    await expect(menu.getByRole('button', { name: 'Editar' })).toBeVisible();
    await settleMotion(page, '.ctx');
    const menuBox = await page.evaluate(() => {
      const overlay = document.querySelector('.ov.ctxov')!.getBoundingClientRect();
      const ctx = document.querySelector('.ctx')!.getBoundingClientRect();
      const tab = document.querySelector('.mtab')!.getBoundingClientRect();
      const height = window.innerHeight;
      const x = tab.left + tab.width / 2;
      const y = tab.top + tab.height / 2;
      const hit = document.elementsFromPoint(x, y);
      const sheet = document.querySelector('.ctx')!;
      const tabNode = document.querySelector('.mtab')!;
      return {
        width: ctx.width,
        bottom: ctx.bottom,
        overlayBottom: overlay.bottom,
        scrim: getComputedStyle(document.querySelector('.ov.ctxov')!).backgroundColor,
        height,
        viewport: document.documentElement.clientWidth,
        sheetIndex: hit.findIndex((node) => node === sheet || sheet.contains(node)),
        tabIndex: hit.findIndex((node) => node === tabNode || tabNode.contains(node)),
      };
    });
    expect(menuBox.width).toBeGreaterThan(menuBox.viewport - 8);
    expect(menuBox.overlayBottom).toBeGreaterThanOrEqual(menuBox.height - 1);
    expect(menuBox.bottom).toBeGreaterThanOrEqual(menuBox.height - 1);
    expect(menuBox.scrim).toBe('rgba(17, 17, 17, 0.45)');
    expect(menuBox.sheetIndex).toBeGreaterThanOrEqual(0);
    expect(menuBox.tabIndex).toBeGreaterThan(menuBox.sheetIndex);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patterns-390-menu.png` });
    await menu.getByRole('button', { name: 'Archivar' }).click();
    const confirm = page.getByRole('dialog', { name: 'Archivar equipo' });
    await expect(confirm).toBeVisible();
    await settleMotion(page, '.sheet');
    const dialogBox = await confirm.boundingBox();
    const viewport = page.viewportSize()!;
    expect(dialogBox!.y).toBeGreaterThan(40);
    expect(dialogBox!.y + dialogBox!.height).toBeGreaterThanOrEqual(viewport.height - 2);
    await expectFits(page);
    await confirm.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByTestId('sidebar-tab-more').click();
    await page.getByTestId('sidebar-tab-service').click();
    await expect(page.getByRole('heading', { name: 'Servicio técnico' })).toBeVisible();
    await expect(page.getByTestId('page-back')).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Nueva orden' })).toBeVisible();
    await expect(page.getByText(/Propuesta tentativa/)).toHaveCount(0);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patterns-390-service.png`, fullPage: true });
    await page.getByTestId('page-back').click();
    await expect(page).toHaveURL(/#\/mas/);
    await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-commissions')).toBeVisible();

    await page.getByTestId('sidebar-tab-inventory').click();
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByTestId('mobile-dock')).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patterns-360-inventory.png`, fullPage: true });
  });
});
