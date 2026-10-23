import { expect, type Page } from '@playwright/test';
import { groupOf } from '../src/desk/nav';
import { ROUTE } from '../src/desk/hash-route';
import type { DeskTab } from '../src/desk/types';

/** Follow the visible navigation: desktop groups/page tabs or the phone bar/More. */
export async function openDeskSection(page: Page, id: string) {
  if (!Object.hasOwn(ROUTE, id)) throw new Error(`Unknown section: ${id}`);
  const tab = id as DeskTab;
  const sidebar = page.locator('aside.side');
  // Reloads can resolve before React restores the authenticated shell.
  await expect(sidebar.or(page.getByTestId('mobile-tab-bar'))).toBeVisible();
  if (await sidebar.isVisible()) {
    const direct = sidebar.getByTestId(`sidebar-tab-${id}`);
    if (await direct.isVisible()) {
      await direct.click();
    } else {
      const group = groupOf(tab);
      if (!group) throw new Error(`No desktop navigation group for ${id}`);
      await sidebar.getByTestId(`nav-group-${group}`).getByRole('button').click();
      await page.getByTestId(`group-tab-${id}`).click();
    }
  } else {
    const direct = page.getByTestId(`sidebar-tab-${id}`);
    if (!(await direct.isVisible())) await page.getByTestId('sidebar-tab-more').click();
    await direct.click();
  }
  await expect(page).toHaveURL(url => url.hash === `#/${ROUTE[tab]}`);
}

/** Expand secondary mobile list controls only when that list provides them. */
export async function expandListOptions(page: Page) {
  const options = page.locator('.mobile-list-options');
  if (await options.isVisible() && !(await options.evaluate(node => (node as HTMLDetailsElement).open))) {
    await options.locator('summary').click();
  }
}
