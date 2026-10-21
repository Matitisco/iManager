import { expect, type Locator } from '@playwright/test';

/** Exercise the same disclosure as users; keep actions scoped away from the header X. */
export async function openSheetActions(sheet: Locator) {
  const menu = sheet.locator('.sheet-foot .sheet-action-menu');
  await expect(menu).toHaveCount(1);
  if (!(await menu.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await menu.locator('summary').click();
  }
}

export async function sheetAction(sheet: Locator, name: string) {
  const action = sheet.locator('.sheet-foot').getByRole('button', { name, exact: true, includeHidden: true });
  await expect(action).toBeAttached();
  if (!(await action.isVisible())) await openSheetActions(sheet);
  await expect(action).toBeVisible();
  return action;
}
