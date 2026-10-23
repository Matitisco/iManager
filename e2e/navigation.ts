import { expect, type Page } from '@playwright/test';
import { groupOf, moreTestId } from '../src/desk/nav';
import { ROUTE } from '../src/desk/hash-route';
import type { DeskTab } from '../src/desk/types';

/** Follow the exclusive accordion on desktop or the phone bar/More. */
export async function openDeskSection(page: Page, id: string) {
  if (!Object.hasOwn(ROUTE, id)) throw new Error(`Unknown section: ${id}`);
  const tab = id as DeskTab;
  await expect(page.locator('.desk-app')).toBeVisible();
  const sidebar = page.locator('aside.side');
  await expect(sidebar.or(page.getByTestId('mobile-tab-bar'))).toBeVisible();
  if (!(await sidebar.isVisible())) {
    const barDestination = page.getByTestId('mobile-tab-bar').getByTestId(`sidebar-tab-${id}`);
    if (await barDestination.isVisible()) {
      await barDestination.click();
      await expect(page).toHaveURL(url => url.hash === `#/${ROUTE[tab]}`);
      return;
    }
    if (!(await page.getByTestId('more-screen').isVisible())) await page.getByTestId('sidebar-tab-more').click();
  }
  const menu = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(menu).toBeVisible();
  const group = groupOf(tab) ?? (['notifications', 'help', 'settings'].includes(id) ? 'cuenta' : null);
  if (group) {
    const trigger = menu.getByTestId(`nav-group-${group}`).locator('button[aria-expanded]').first();
    if (await trigger.count() && await trigger.getAttribute('aria-expanded') === 'false') await trigger.click();
  }
  // Some destinations also live in the bottom bar and use a distinct More id.
  const destination = menu.getByTestId(moreTestId(tab));
  await (await sidebar.isVisible() ? menu.getByTestId(`sidebar-tab-${id}`) : destination).click();
  await expect(page).toHaveURL(url => url.hash === `#/${ROUTE[tab]}`);
}

/** Expand secondary mobile list controls only when that list provides them. */
export async function expandListOptions(page: Page) {
  const options = page.locator('.mobile-list-options');
  if (await options.isVisible() && !(await options.evaluate(node => (node as HTMLDetailsElement).open))) {
    await options.locator('summary').click();
  }
}
