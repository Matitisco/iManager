import { expect, test } from '@playwright/test';
import { selectDeskOption } from './utils';
import { reports, screenshot } from './report-dropdown';

test.describe('report dropdown desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('custom menu supports keyboard, selection and cancellation', async ({ page, request }, testInfo) => {
    const control = await reports(page, request, testInfo);
    await control.click();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    await expect(page.getByRole('option', { name: 'Medio de pago' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('dialog', { name: 'Desglose' })).toHaveCount(0);
    const box = await list.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
    await screenshot(page, 'issue-287-desktop.png');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Por vendedor' })).toBeVisible();
    await selectDeskOption(page, control, 'Modelo');
    await expect(page.getByRole('heading', { name: 'Por modelo' })).toBeVisible();
    await control.click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    await expect(control).toBeFocused();
    await expect(control).toHaveText('Modelo');
    await control.click();
    await page.getByRole('heading', { name: 'Reportes' }).click();
    await expect(list).toHaveCount(0);
    await expect(control).toHaveText('Modelo');
  });
});
