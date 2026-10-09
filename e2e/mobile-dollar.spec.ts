import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, updateStoreViaApi } from './utils';

const SHOTS = process.env.MOBILE_DOLLAR_SHOTS?.trim();
const UPDATED_AT = '2026-10-08T21:40:00-03:00';

const BLUE = { compra: 1280, venta: 1300, fechaActualizacion: UPDATED_AT };
const OFICIAL = { compra: 900, venta: 950, fechaActualizacion: UPDATED_AT };
const MEP = { compra: 1400, venta: 1450, fechaActualizacion: UPDATED_AT };

function quoteFor(url: string) {
  if (url.includes('/oficial')) return OFICIAL;
  if (url.includes('/bolsa')) return MEP;
  return BLUE;
}

async function mockDollar(page: Page, mode: 'ok' | 'fail' | 'hold' = 'ok') {
  let releaseHold: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { releaseHold = resolve; });
  await page.route('https://dolarapi.com/**', async (route) => {
    if (mode === 'fail') {
      await route.fulfill({ status: 503, body: 'caido' });
      return;
    }
    if (mode === 'hold') await held;
    await route.fulfill({ json: quoteFor(route.request().url()) });
  });
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1300,00', valor_cierre_ant: '1290,00' },
  }));
  return () => releaseHold?.();
}

async function seedStaleBlue(page: Page) {
  await page.addInitScript((updatedAt) => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [year, month, day] = today.split('-').map(Number);
    const priorDate = new Date(Date.UTC(year, month - 1, day));
    priorDate.setUTCDate(priorDate.getUTCDate() - 1);
    const prior = priorDate.toISOString().slice(0, 10);
    localStorage.setItem('imanager-desk-blue', JSON.stringify({
      source: 'dolarapi',
      quotes: {},
      days: {},
      houses: {
        blue: {
          quote: { buy: 1280, sell: 1300, updatedAt, fetchedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString() },
          days: { [prior]: { buy: 1290, sell: 1290 }, [today]: { buy: 1280, sell: 1300 } },
        },
      },
    }));
  }, UPDATED_AT);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function expectFits(page: Page) {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    const roots = ['.mhead', '.mtab', '.stage', '.dolar-toast', '.dolar-sheet', '.mdock'].flatMap((selector) => [...document.querySelectorAll(selector)]);
    const clippedByParent = (node: Element) => {
      let parent = node.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const overflow = getComputedStyle(parent).overflowX;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden' || overflow === 'clip') {
          const box = parent.getBoundingClientRect();
          if (box.width > 0 && box.left >= -1 && box.right <= width + 1) return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };
    for (const root of roots) {
      if (!(root instanceof Element)) continue;
      const style = getComputedStyle(root);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const nodes = [root, ...root.querySelectorAll('*')];
      for (const node of nodes) {
        if (!(node instanceof Element) || clippedByParent(node)) continue;
        const box = node.getBoundingClientRect();
        if (box.width < 1 && box.height < 1) continue;
        if (box.left < -1 || box.right > width + 1) {
          const label = node.getAttribute('data-testid') || (typeof node.className === 'string' ? node.className : node.tagName);
          outside.push(`${String(label).slice(0, 80)} [${Math.round(box.left)}…${Math.round(box.right)}]`);
          if (outside.length >= 8) return { extra, outside, chipClipped: false };
        }
      }
    }
    const chip = document.querySelector('.dolar.chip');
    const chipClipped = chip instanceof HTMLElement && chip.scrollWidth > chip.clientWidth + 1;
    return { extra, outside, chipClipped };
  });
  expect(report.outside).toEqual([]);
  expect(report.extra).toBeLessThanOrEqual(1);
  expect(report.chipClipped).toBe(false);
}

test.describe('phone dollar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows a loading chip and then the automatic store quote', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'mobile-dollar-auto');
    const release = await mockDollar(page, 'hold');
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');

    const widget = page.getByTestId('blue-widget');
    await expect(widget).toHaveAttribute('data-variant', 'chip');
    await expect(widget).toHaveAttribute('data-state', 'loading');
    await expect(widget).toHaveAttribute('data-mode', 'auto');
    await expect(widget.locator('.dolar-skel')).toHaveCount(2);
    await expectFits(page);
    await shot(page, 'dolar-390-cargando');

    release();
    await expect(widget).toHaveAttribute('data-state', 'ready');
    await expect(widget).toContainText('Blue');
    await expect(widget).toContainText('1.280');
    await expect(widget).toContainText('1.300');

    await createInventoryItemViaApi(request, email, { imei: '350000000000010', model: 'iPhone 13', price: 650000, color: 'Medianoche', condition: 'USADO' });
    await page.reload();
    await expect(widget).toHaveAttribute('data-state', 'ready');
    await page.getByTestId('sidebar-tab-inventory').click();
    await expect(page.getByText('≈ US$ 500').first()).toBeVisible();
    await expect(page.getByText('Los precios en dólares son aproximados, con la cotización de la tienda.')).toBeVisible();
    await expectFits(page);
    await shot(page, 'dolar-390-header');

    await widget.click();
    await expect(page.getByRole('heading', { name: 'Dólar blue' })).toBeVisible();
    await expect(page.getByTestId('blue-mode')).toHaveText('Automática');
    await expect(page.getByText('Fuente: DolarApi (cotización blue).')).toBeVisible();
    await expect(page.getByTestId('blue-refresh-now')).toHaveText(/Actualizar/);
    await page.getByTestId('blue-usd').fill('500');
    await expect(page.getByTestId('blue-result')).toContainText('650.000');
    await expectFits(page);
    await shot(page, 'dolar-390-detalle');

    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
    await page.getByTestId('blue-done').click();
    await expect(page.getByTestId('blue-overlay')).toHaveCount(0);
    await expectFits(page);
  });

  test('keeps the last quote when the source fails and retries', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'mobile-dollar-error');
    await seedStaleBlue(page);
    await mockDollar(page, 'fail');
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');

    const widget = page.getByTestId('blue-widget');
    await expect(widget).toHaveAttribute('data-state', 'error');
    await expect(widget).toHaveAttribute('data-quote', 'stale');
    await expect(widget).toContainText('1.300');
    await expect(widget).toContainText('21:40');
    await expect(page.getByTestId('blue-retry')).toBeVisible();
    await expect(page.getByTestId('blue-toast')).toContainText('Mostramos el de las 21:40');
    await expectFits(page);
    await shot(page, 'dolar-390-error');

    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await widget.getByRole('button', { name: 'Dólar blue' }).click();
    await expect(page.getByTestId('blue-alert')).toContainText('Mostramos el dato de las 21:40');
    await expect(page.getByTestId('blue-toast')).toBeHidden();
    await expectFits(page);
    await shot(page, 'dolar-390-error-detalle');
    await page.getByTestId('blue-done').click();

    await page.unroute('https://dolarapi.com/**');
    await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: quoteFor(route.request().url()) }));
    await page.getByTestId('blue-retry').click();
    await expect(widget).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('blue-toast')).toHaveCount(0);
  });

  test('shows an empty chip when there is no quote at all', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'mobile-dollar-empty');
    await page.addInitScript(() => localStorage.removeItem('imanager-desk-blue'));
    await mockDollar(page, 'fail');
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');

    const widget = page.getByTestId('blue-widget');
    await expect(widget).toHaveAttribute('data-state', 'error');
    await expect(widget).toHaveAttribute('data-quote', 'none');
    await expect(widget).toContainText('sin dato');
    await expect(page.getByTestId('blue-retry')).toBeVisible();
    await expect(page.getByTestId('blue-toast')).toContainText('No pudimos actualizar el dólar.');
    await expectFits(page);
    await shot(page, 'dolar-390-sin-cotizacion');

    await widget.getByRole('button', { name: 'Dólar blue' }).click();
    await expect(page.getByTestId('blue-alert')).toContainText('No hay cotización');
    await expect(page.getByTestId('blue-result')).toHaveText('—');
    await expectFits(page);
    await shot(page, 'dolar-390-sin-cotizacion-detalle');
    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
  });

  test('shows a manual store quote and the empty manual state', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'mobile-dollar-manual');
    await mockDollar(page, 'fail');
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');
    await updateStoreViaApi(request, email, { exchangeMode: 'manual', manualBuy: 1100, manualSell: 1250 });
    await page.reload();

    const widget = page.getByTestId('blue-widget');
    await expect(widget).toHaveAttribute('data-state', 'ready');
    await expect(widget).toHaveAttribute('data-mode', 'manual');
    await expect(widget).toContainText('Dólar');
    await expect(widget).toContainText('1.100');
    await expect(widget).toContainText('1.250');
    await expect(page.getByTestId('blue-retry')).toHaveCount(0);
    await expect(page.getByTestId('blue-toast')).toHaveCount(0);
    await expectFits(page);
    await shot(page, 'dolar-390-manual');

    await widget.getByRole('button', { name: 'Dólar' }).click();
    await expect(page.getByTestId('blue-mode')).toHaveText('Manual');
    await expect(page.getByText('Cotización cargada por la tienda.')).toBeVisible();
    await expect(page.getByTestId('blue-refresh-now')).toHaveCount(0);
    await page.getByTestId('blue-usd').fill('500');
    await expect(page.getByTestId('blue-result')).toContainText('625.000');
    await expectFits(page);
    await shot(page, 'dolar-390-manual-detalle');
    await page.getByTestId('blue-done').click();

    await updateStoreViaApi(request, email, { exchangeMode: 'manual', manualBuy: null, manualSell: null });
    await page.reload();
    await expect(widget).toHaveAttribute('data-state', 'error');
    await expect(widget).toHaveAttribute('data-mode', 'manual');
    await expect(widget).toContainText('sin dato');
    await expect(page.getByTestId('blue-retry')).toHaveCount(0);
    await expect(page.getByTestId('blue-toast')).toHaveCount(0);
    await widget.getByRole('button', { name: 'Dólar' }).click();
    await expect(page.getByTestId('blue-alert')).toContainText('Cargá la cotización en Configuración.');
    await expectFits(page);
    await shot(page, 'dolar-390-manual-vacio');
    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
  });

  test('uses the store DolarApi house instead of a browser source picker', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'mobile-dollar-oficial');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, 'Mi Tienda Ejemplo');
    await updateStoreViaApi(request, email, { exchangeMode: 'auto', exchangeSource: 'oficial', manualBuy: null, manualSell: null });
    await page.evaluate(() => localStorage.removeItem('imanager-desk-blue'));
    await page.reload();

    const widget = page.getByTestId('blue-widget');
    await expect(widget).toHaveAttribute('data-state', 'ready');
    await expect(widget).toHaveAttribute('data-mode', 'auto');
    await expect(widget).toContainText('Oficial');
    await expect(widget).toContainText('900');
    await expect(widget).toContainText('950');
    await widget.click();
    await expect(page.getByRole('heading', { name: 'Dólar oficial' })).toBeVisible();
    await expect(page.getByText('Fuente: DolarApi (cotización oficial).')).toBeVisible();
    await expect(page.getByRole('button', { name: 'DolarApi' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bluelytics' })).toHaveCount(0);
    await expectFits(page);
    await shot(page, 'dolar-390-oficial');
    await page.setViewportSize({ width: 360, height: 800 });
    await expectFits(page);
  });
});
