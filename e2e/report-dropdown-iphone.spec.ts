import { devices, expect, test } from '@playwright/test';
import { reports, screenshot } from './report-dropdown';

// Focus, keyboard and close behavior are measured after the popup reaches its final position.
test.use({ ...devices['iPhone 13'], browserName: 'webkit', contextOptions: { reducedMotion: 'reduce' } });

test.describe('report dropdown iPhone', () => {
  test('opens a bottom sheet above navigation, traps focus and selects a dimension', async ({ page, request }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('imanager:install-dismissed:ios', 'yes');
      localStorage.setItem('imanager:install-dismissed:android', 'yes');
    });
    const control = await reports(page, request, testInfo);
    const dialog = page.getByRole('dialog', { name: 'Desglose' });
    const viewport = page.viewportSize()!;
    const openSelector = async (input: 'pointer' | 'keyboard' = 'pointer') => {
      if (input === 'keyboard') await control.press('Enter');
      else await control.click();
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(page.getByRole('listbox')).toBeFocused();
      await expect.poll(async () => {
        const settled = await dialog.boundingBox();
        return settled ? Math.round(settled.y + settled.height) : null;
      }).toBe(viewport.height);
    };
    await openSelector();
    const box = await dialog.boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(viewport.width);
    for (const option of await page.getByRole('option').all()) expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    const tabBarInert = await page.getByTestId('mobile-tab-bar').evaluate((node) => !!node.closest('[inert]'));
    expect(tabBarInert).toBe(true);
    await screenshot(page, 'issue-287-mobile-iphone.png');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cerrar selector' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('listbox')).toBeFocused();
    await page.getByRole('option', { name: 'Modelo', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(control).toHaveText('Modelo');
    await expect(control).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Por modelo' })).toBeVisible();
    await openSelector();
    await page.getByRole('button', { name: 'Cerrar selector' }).click();
    await expect(dialog).toHaveCount(0);
    await openSelector();
    await page.locator('.ds-select-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(dialog).toHaveCount(0);
    await expect(control).toBeFocused();
    await expect(control).toHaveText('Modelo');
    // The backdrop temporarily consumes compatibility clicks; verify keyboard reopening here.
    await openSelector('keyboard');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(control).toBeFocused();
  });
});
