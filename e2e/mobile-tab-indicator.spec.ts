import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail } from './utils';

const SHOTS = process.env.TAB_INDICATOR_SHOTS?.trim();

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

async function indicatorState(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="mobile-tab-bar"]');
    const pill = document.querySelector<HTMLElement>('[data-testid="mobile-tab-indicator"]');
    const active = bar?.querySelector<HTMLElement>('button.on');
    if (!bar || !pill || !active) return null;
    const pillBox = pill.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    const style = getComputedStyle(pill);
    return {
      dx: pillBox.left - activeBox.left,
      dw: pillBox.width - activeBox.width,
      x: pillBox.left,
      width: pillBox.width,
      transform: pill.style.transform,
      transition: pill.style.transition,
      duration: style.transitionDuration,
      timing: style.transitionTimingFunction,
      property: style.transitionProperty,
    };
  });
}

test.describe('mobile tab indicator', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('slides between sections from the bar, the hash and the back button', async ({ page, request }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const email = buildTestEmail(testInfo, 'tab-indicator');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Indicador ${testInfo.parallelIndex}`);

    const bar = page.getByTestId('mobile-tab-bar');
    const indicator = page.getByTestId('mobile-tab-indicator');
    await expect(bar.getByTestId('sidebar-tab-dashboard')).toHaveClass(/on/);
    await expect(indicator).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const origin = await bar.getByTestId('sidebar-tab-dashboard').boundingBox();
    expect(origin).not.toBeNull();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-390-before.png` });

    await page.addStyleTag({ content: '.mtab-indicator { transition-duration: 1200ms !important; }' });
    await bar.getByTestId('sidebar-tab-sales').click();
    await expect(page).toHaveURL(/#\/ven/);
    await expect(indicator).toBeVisible();
    const started = await indicatorState(page);
    expect(started?.transition).toContain('transform 220ms ease-out');
    expect(started?.transform.startsWith('translateX(')).toBe(true);
    await page.waitForTimeout(280);
    const during = await indicatorState(page);
    expect(during).not.toBeNull();
    expect(during!.x).toBeGreaterThan((origin?.x ?? 0) + 8);
    const salesBox = await bar.getByTestId('sidebar-tab-sales').boundingBox();
    expect(salesBox).not.toBeNull();
    expect(during!.x).toBeLessThan(salesBox!.x - 4);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-390-during.png` });

    await expect(indicator).toHaveCount(0);
    await expect(bar.getByTestId('sidebar-tab-sales')).toHaveClass(/on/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-390-after.png` });

    await page.evaluate(() => { window.location.hash = '#/inv'; });
    await expect(page).toHaveURL(/#\/inv/);
    await expect(indicator).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-inventory')).toHaveClass(/on/);
    await expect(indicator).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/#\/ven/);
    await expect(indicator).toBeVisible();
    await expect(bar.getByTestId('sidebar-tab-sales')).toHaveClass(/on/);
    await expect(indicator).toHaveCount(0);

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(indicator).toHaveCount(0);
    const inside = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const barBox = document.querySelector('[data-testid="mobile-tab-bar"]')!.getBoundingClientRect();
      return barBox.left >= -1 && barBox.right <= width + 1;
    });
    expect(inside).toBe(true);
  });

  test('does not animate the indicator when reduced motion is requested', async ({ page, request }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const email = buildTestEmail(testInfo, 'tab-indicator-reduced');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Indicador quieto ${testInfo.parallelIndex}`);

    await expect(page.getByTestId('mobile-tab-indicator')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-tab-dashboard')).toHaveClass(/on/);

    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page).toHaveURL(/#\/inv/);
    await expect(page.getByTestId('sidebar-tab-inventory')).toHaveClass(/on/);
    await expect(page.getByTestId('mobile-tab-indicator')).toHaveCount(0);
  });
});

test.describe('desktop tab indicator stays out of the sidebar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keeps the desktop sidebar without a sliding indicator', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'tab-indicator-desktop');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Indicador desk ${testInfo.parallelIndex}`);

    await expect(page.getByTestId('mobile-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('mobile-tab-indicator')).toHaveCount(0);
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-dashboard')).toHaveClass(/on/);
    const background = await page.getByTestId('sidebar-tab-dashboard').evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-1440.png` });

    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page).toHaveURL(/#\/inv/);
    await expect(page.getByTestId('mobile-tab-indicator')).toHaveCount(0);
    await expect(page.locator('.mtab-indicator')).toHaveCount(0);
  });
});
