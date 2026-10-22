import { expect, type Page } from '@playwright/test';

/**
 * The product toggle is the static HIDDEN_SECTIONS config (#489), not a store
 * setting/API. Override only that config in this browser's fake-data fixture;
 * routing, permissions, screens and the local test API still run unchanged.
 */
export async function enableHiddenSections(page: Page, sections: string[]) {
  await page.route('**/src/config/hiddenSections.ts*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace(/Object\.freeze\((\[[\s\S]*?\])\)/, (_, list: string) =>
      `Object.freeze(${list}.filter(id => !${JSON.stringify(sections)}.includes(id)))`);
    expect(body, 'Hidden-section fixture must override the actual config').not.toBe(source);
    await route.fulfill({ response, body });
  });
}
