import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { data, me } from './pwa/fixtures.mjs';

async function session(page: Page) {
  await page.route('**/api/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/me' ? me : data }));
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
}
async function shot(page: Page, name: string) {
  const dir = process.env.ISSUE_300_QA_SHOTS || process.env.ISSUE_300_SHOTS;
  if (!dir) return;
  if (process.env.ISSUE_300_QA_SHOTS && name === 'sheet-android') return;
  await page.evaluate(() => document.fonts.ready);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/issue-300-${process.env.ISSUE_300_QA_SHOTS ? 'qa-' : ''}${name}.png`, animations: 'disabled' });
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sheet = page.getByRole('dialog', { name: 'Instalá iManager' });
  if (!await sheet.count()) return;
  await expect.poll(() => sheet.evaluate((node) => getComputedStyle(node).transform)).toBe('none');
  const box = (await sheet.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await sheet.evaluate((node) => [...node.querySelectorAll('*')].every((child) => {
    if (child.closest('[hidden]')) return true;
    const rect = child.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth + 1;
  }))).toBe(true);
}

export function installHelpTests(production = false, platforms: readonly ('android' | 'iphone' | 'desktop')[] = ['android', 'iphone', 'desktop']) {
  for (const platform of platforms) {
    test.describe(`install help ${platform}`, () => {
      if (!production) test.use(platform === 'iphone' ? {
        viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      } : platform === 'android' ? {
        viewport: { width: 412, height: 852 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
      } : { viewport: { width: 1440, height: 900 } });
      test.beforeEach(async ({ page }, info) => {
        if (production) test.skip(!info.project.name.startsWith(platform), 'Platform-specific coverage');
        await page.setViewportSize(platform === 'desktop' ? { width: 1440, height: 900 } : { width: platform === 'iphone' ? 393 : 412, height: 852 });
      });
      if (platform === 'desktop') {
        test('leaves the desktop dashboard unchanged', async ({ page }) => {
          await page.clock.install(); await session(page); await page.clock.fastForward(31_000);
          await expect(page.getByTestId('install-app')).toHaveCount(0);
          await expect(page.getByTestId('install-card')).toHaveCount(0);
          await expect(page.getByTestId('sidebar-tab-more')).toHaveCount(0);
          await expect(page.locator('.side')).toBeVisible(); await fits(page);
          await shot(page, 'desktop');
        });
        return;
      }
      test('resolves the Más installation card in the first layout without shifting the profile', async ({ page }) => {
        await session(page);
        await page.evaluate(async () => {
          await document.fonts.ready;
          const state = window as typeof window & { moreLayouts: { card: boolean; top: number }[] };
          state.moreLayouts = [];
          const sample = () => {
            const profile = document.querySelector<HTMLElement>('[data-testid="more-profile"]');
            if (profile) state.moreLayouts.push({ card: !!document.querySelector('[data-testid="install-card"]'), top: profile.offsetTop });
          };
          new MutationObserver(sample).observe(document.querySelector('main.stage')!, { childList: true, subtree: true });
        });
        await page.getByTestId('sidebar-tab-more').tap();
        await expect(page.getByTestId('install-card')).toBeVisible();
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        const layouts = await page.evaluate(() => (window as typeof window & { moreLayouts: { card: boolean; top: number }[] }).moreLayouts);
        expect(layouts.length).toBeGreaterThan(0);
        expect(layouts.every((layout) => layout.card && layout.top === layouts[0].top)).toBe(true);
        await page.getByTestId('install-card').getByRole('button', { name: 'Instalar', exact: true }).tap();
        await expect(page.getByRole('dialog', { name: 'Instalá iManager' })).toBeVisible();
        expect(await page.getByTestId('more-profile').evaluate((node) => (node as HTMLElement).offsetTop)).toBe(layouts[0].top);
      });
      test('a single touch on the sheet X closes it and keeps Más active', async ({ page }) => {
        await session(page); await page.getByTestId('sidebar-tab-more').tap();
        const install = page.getByTestId('install-card').getByRole('button', { name: 'Instalar', exact: true });
        await install.focus(); await install.tap();
        const sheet = page.getByRole('dialog', { name: 'Instalá iManager' });
        await expect(sheet).toBeVisible(); await fits(page);
        if (platform === 'iphone') await shot(page, 'sheet-iphone');
        const box = (await sheet.getByRole('button', { name: 'Cerrar ayuda de instalación' }).boundingBox())!;
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await expect(sheet).toHaveCount(0);
        await expect(page).toHaveURL(/#\/mas$/);
        await expect(install).toBeFocused();
        await expect(page.locator('#root')).not.toHaveAttribute('inert');
      });
      test('shows the first Más card, platform steps and a working alternate accordion', async ({ page }) => {
        await session(page); await page.getByTestId('sidebar-tab-more').click();
        const card = page.getByTestId('install-card'); await expect(card).toBeVisible();
        expect(await card.evaluate((node) => node.nextElementSibling?.getAttribute('data-testid'))).toBe('more-profile');
        await expect(page.getByTestId('more-screen')).not.toContainText('Comisiones');
        if (platform === 'android') await shot(page, 'mas');
        const install = card.getByRole('button', { name: 'Instalar', exact: true });
        await install.click();
        const sheet = page.getByRole('dialog', { name: 'Instalá iManager' }); await expect(sheet).toBeVisible();
        await expect(sheet.getByText('Tu celular')).toBeVisible();
        await expect(sheet.getByRole('region', { name: `Pasos para ${platform === 'iphone' ? 'iPhone' : 'Android'}` })).toBeVisible();
        await expect(sheet.getByRole('listitem')).toHaveCount(7);
        await fits(page); await shot(page, `sheet-${platform}`);
        const alternate = sheet.getByRole('button', { name: platform === 'iphone' ? /¿Usás Android/ : /¿Usás iPhone/ });
        await expect(alternate).toHaveAttribute('aria-expanded', 'false');
        await alternate.scrollIntoViewIfNeeded(); await alternate.click();
        await expect(sheet.getByRole('listitem')).toHaveCount(11);
        await expect(sheet.getByRole('region', { name: `Pasos para ${platform === 'iphone' ? 'Android' : 'iPhone'}` })).toBeVisible();
        await alternate.click(); await expect(sheet.getByRole('listitem')).toHaveCount(7);
        await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0); await expect(install).toBeFocused();
        await install.click(); await sheet.getByRole('button', { name: 'Cerrar ayuda de instalación' }).click(); await expect(sheet).toHaveCount(0);
      });
      test('hides every installation entry in standalone', async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
        await page.clock.install(); await session(page); await page.clock.fastForward(31_000);
        await expect(page.getByTestId('install-app')).toHaveCount(0);
        await page.getByTestId('sidebar-tab-more').click(); await expect(page.getByTestId('install-card')).toHaveCount(0);
      });
      if (platform === 'android') {
        test('manual banner waits 30s, stays in Dashboard and dismissal leaves Más usable', async ({ page }) => {
          // Suppress browser-generated installability as well as synthetic prompts.
          await page.addInitScript(() => window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault(); event.stopImmediatePropagation();
          }, true));
          await page.clock.install(); await session(page);
          await expect(page.getByTestId('install-app')).toHaveCount(0);
          await page.clock.fastForward(29_000); await expect(page.getByTestId('install-app')).toHaveCount(0);
          await page.clock.fastForward(1_000); await page.clock.runFor(400);
          const banner = page.getByTestId('install-app'); await expect(banner).toContainText('Agregar a pantalla principal');
          await expect(banner).toContainText('Instalá iManager'); await expect(banner.getByRole('button', { name: 'Instalar app' })).toHaveCount(0);
          expect(await banner.evaluate((node) => node.closest('main.stage') !== null)).toBe(true);
          await fits(page); await shot(page, 'android-banner');
          await page.getByTestId('sidebar-tab-inventory').click();
          await expect(page.getByRole('heading', { level: 1, name: 'Inventario', exact: true })).toBeVisible();
          await page.clock.runFor(400); await expect(banner).toHaveCount(0);
          for (const screen of ['sales', 'reports', 'more']) {
            await page.getByTestId(`sidebar-tab-${screen}`).click();
            await page.clock.fastForward(31_000); await page.clock.runFor(400);
            await expect(banner).toHaveCount(0);
          }
          await page.getByTestId('sidebar-tab-dashboard').click(); await page.clock.fastForward(30_000); await page.clock.runFor(400);
          await banner.getByRole('button', { name: 'No volver a mostrar la instalación' }).click();
          await page.reload(); await expect(page.locator('.desk-app')).toBeVisible(); await page.clock.fastForward(31_000);
          await expect(banner).toHaveCount(0);
          await page.getByTestId('sidebar-tab-more').click(); await page.getByTestId('install-card').getByRole('button', { name: 'Instalar' }).click();
          await expect(page.getByRole('dialog', { name: 'Instalá iManager' })).toBeVisible();
        });
        test('Más invokes the native installer without a sheet, then hides after appinstalled', async ({ page }) => {
          await session(page);
          await page.evaluate(() => {
            const state = window as typeof window & { installCount: number }; state.installCount = 0;
            window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
              prompt: async () => { state.installCount += 1; }, userChoice: Promise.resolve({ outcome: 'dismissed' }),
            }));
          });
          await page.getByTestId('sidebar-tab-more').click(); await page.getByTestId('install-card').getByRole('button', { name: 'Instalar' }).click();
          expect(await page.evaluate(() => (window as typeof window & { installCount: number }).installCount)).toBe(1);
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
          await expect(page.getByTestId('install-card')).toHaveCount(0);
        });
      }
    });
  }
}
