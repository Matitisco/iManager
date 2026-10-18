import path from 'node:path';
import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { reports } from './report-dropdown';

const shots = process.env.ISSUE_392_SHOTS?.trim();

async function capture(page: Page, device: string) {
  if (!shots) return;
  await page.screenshot({
    path: path.join(shots, `issue-392-after-${device}.png`),
    animations: 'disabled',
  });
}

async function rightEdge(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!.x + box!.width;
}

test.describe('report periods on desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('aligns periods right beside the tabs and on a wrapped line', async ({ page, request }, testInfo) => {
    await reports(page, request, { ...testInfo, title: 'period right desktop' });
    await page.evaluate(() => document.fonts.ready);
    const filters = page.locator('.gfilters');
    const tabs = filters.getByRole('group', { name: 'Tipo de reporte' });
    const periods = filters.getByRole('group', { name: 'Período', exact: true });
    await expect(periods.getByRole('button')).toHaveText(['Semana', 'Mes', '3 meses', 'Año', 'Personalizado']);
    expect(Math.abs(await rightEdge(periods) - await rightEdge(filters))).toBeLessThanOrEqual(2);
    const tabBox = (await tabs.boundingBox())!;
    const periodBox = (await periods.boundingBox())!;
    // Chips retain their different heights and the row's existing center alignment.
    expect(Math.abs(periodBox.y + periodBox.height / 2 - tabBox.y - tabBox.height / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(tabBox.x - (await filters.boundingBox())!.x)).toBeLessThanOrEqual(2);
    await capture(page, 'desktop');

    await tabs.getByRole('button', { name: 'Comisiones', exact: true }).click();
    await expect(periods).toBeVisible();
    await tabs.getByRole('button', { name: 'Ventas', exact: true }).click();

    await page.setViewportSize({ width: 1000, height: 800 });
    const wrappedTabs = (await tabs.boundingBox())!;
    expect((await periods.boundingBox())!.y).toBeGreaterThanOrEqual(wrappedTabs.y + wrappedTabs.height);
    expect(Math.abs(await rightEdge(periods) - await rightEdge(filters))).toBeLessThanOrEqual(2);
  });
});

test.describe('report periods on iPhone', () => {
  for (const width of [393, 320, 760]) {
    test(`right-aligns fitting chips and preserves scroll at ${width}px`, async ({ playwright, request, baseURL }, testInfo) => {
      const browser = await playwright.webkit.launch();
      try {
        const page = await browser.newPage({
          ...devices['iPhone 13'], viewport: { width, height: 852 }, deviceScaleFactor: 1, baseURL,
        });
        await reports(page, request, { ...testInfo, title: 'period right mobile' });
        await page.evaluate(() => document.fonts.ready);
        const filters = page.locator('.gfilters');
        const periods = filters.locator('.gperiods');
        const tabs = filters.getByRole('group', { name: 'Tipo de reporte' });
        await expect(filters).toHaveCSS('flex-direction', 'column');
        expect((await periods.boundingBox())!.y).toBeGreaterThanOrEqual((await tabs.boundingBox())!.y + (await tabs.boundingBox())!.height);
        for (const row of [tabs, periods]) {
          expect(Math.abs((await row.boundingBox())!.width - (await filters.boundingBox())!.width)).toBeLessThanOrEqual(2);
          await expect(row).toHaveCSS('overflow-x', 'auto');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        if (width === 393) await capture(page, 'mobile');

        const first = periods.getByRole('button').first();
        const last = periods.getByRole('button').last();
        const overflows = await periods.evaluate(node => node.scrollWidth > node.clientWidth);
        // At 760px all chips fit: their right edge must align without scrolling.
        if (width === 760) expect(overflows).toBe(false);
        if (overflows) {
          await periods.evaluate(node => { node.scrollLeft = node.scrollWidth; });
          expect(await periods.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        }
        expect(Math.abs(await rightEdge(last) - await rightEdge(periods))).toBeLessThanOrEqual(2);
        await periods.evaluate(node => { node.scrollLeft = 0; });
        expect((await first.boundingBox())!.x).toBeGreaterThanOrEqual((await periods.boundingBox())!.x - 1);
        if (overflows) {
          expect(Math.abs((await first.boundingBox())!.x - (await periods.boundingBox())!.x)).toBeLessThanOrEqual(2);
        }
      } finally {
        await browser.close();
      }
    });
  }
});
