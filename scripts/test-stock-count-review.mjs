// Isolated component checks: synthetic services, no app server or database.
// Run: node scripts/test-stock-count-review.mjs
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';

const root = process.cwd();
const base = 'd215d8a7f19376744900414a789d185aee3dad0f';
const temp = await mkdtemp(path.join(root, '.stock-count-review-'));
const shots = path.join(root, 'docs/pr-shots');
await mkdir(shots, { recursive: true });
const source = 'src/desk/screens/StockCountScreen.tsx';
const baseline = execFileSync('git', ['show', `${base}:${source}`], { encoding: 'utf8' });
const baselineCss = execFileSync('git', ['show', `${base}:src/desk/desk.css`], { encoding: 'utf8' });
let server;
let browser;
try {
  await writeFile(path.join(temp, 'context.ts'), `const context = {
    user: { uid: 'fixture-owner' }, appSession: { membership: { role: 'OWNER' } },
    reloadInventory: async () => { window.fixtureReloads++; }
  }; export const useAppContext = () => context;`);
  await writeFile(path.join(temp, 'api.ts'), `
    const scenario = new URLSearchParams(location.search).get('scenario');
    const missing = scenario === 'complete' ? [] : Array.from({ length: 12 }, (_, i) => ({
      key: 'missing-' + i, inventoryItemId: 'missing-' + i, imei: '35209811774' + String(1188 + i),
      model: i % 2 ? 'iPhone 14 Pro Max' : 'iPhone 13 mini', capacity: '128GB', color: 'Rosa',
      price: 560000, currency: 'ARS', note: null
    }));
    const line = { key: 'matched', inventoryItemId: 'matched', imei: '352098117744521', model: 'iPhone 13', capacity: '128GB', color: 'Negro', price: 850000, currency: 'ARS', note: null };
    const count = { id: 'fixture-count', status: 'CLOSED', resolution: null,
      subtitle: 'Cerrado el 19/10 · 11:05 · contaron Lucía y Tomás',
      summary: 'Resultado sintético', scanCount: scenario === 'zero' ? 0 : 2, excludedNoImei: 3,
      startedAt: '2026-10-19T12:00:00Z', closedAt: '2026-10-19T14:05:00Z',
      buckets: { missing, matched: scenario === 'zero' ? [] : [line],
        surplus: scenario === 'zero' ? [] : [{ ...line, key: 'extra', inventoryItemId: null, imei: '352098117747702', model: '', price: null }], sold: [] }
    };
    window.fixtureRequests = []; window.fixtureReloads = 0;
    export const fetchStockCounts = async () => [count];
    export const fetchCurrentStockCount = async () => null;
    export const fetchStockCount = async () => count;
    export const resolveStockCount = async (...args) => {
      window.fixtureRequests.push(args);
      if (window.fixtureFailNext) { window.fixtureFailNext = false; throw new Error('No se pudo guardar el control (503)'); }
      return { ...count, resolution: 'ADJUSTED' };
    };
    export const fetchStockCountPreview = async () => ({});
    export const startStockCount = async () => ({});
    export const scanStockCount = async () => ({});
    export const closeStockCount = async () => count;
  `);
  await writeFile(path.join(temp, 'fixture.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { DeskProvider } from '/src/desk/ui';
    const before = new URLSearchParams(location.search).get('before') === '1';
    await import(before ? '/src/desk/desk.css?baseline448' : '/src/desk/desk.css');
    const { StockCountScreen } = await import(before ? '/${source}?baseline448' : '/${source}');
    createRoot(document.getElementById('root')).render(
      <div className="desk-app"><main style={{ overflow: 'auto', width: '100%' }}>
        <DeskProvider value={{ tab: 'inventory', go: () => {}, open: () => {}, openRecord: () => {}, close: () => {}, toast: () => {}, isStaff: false }}>
          <StockCountScreen standalone onBack={() => {}} />
        </DeskProvider>
      </main></div>
    );
  `);
  server = await createServer({
    root, configFile: false,
    optimizeDeps: { entries: [path.join(temp, 'fixture.tsx')] },
    plugins: [{
      name: 'stock-count-review-fixture', enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('/context/AppContext')) return path.join(temp, 'context.ts');
        if (id.endsWith('/services/stock-counts-api')) return path.join(temp, 'api.ts');
      },
      load(id) {
        if (id.endsWith(`${source}?baseline448`)) return baseline;
        if (id.endsWith('src/desk/desk.css?baseline448')) return baselineCss;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/fixture?')) return next();
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/fixture', `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button,input{font:inherit}</style></head><body><div id="root"></div><script type="module" src="/${path.relative(root, temp)}/fixture.tsx"></script></body></html>`));
        });
      },
    }, react()],
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  let checks = 0;
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 1536, height: 640 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://**', (route) => route.abort());
    const open = async (query) => {
      await page.goto(`${origin}/fixture?${query}`);
      await page.getByRole('button', { name: /Cerrado el 19\/10/ }).click();
      await expect(page.getByRole('button', { name: 'Faltan 12' })).toBeVisible();
    };
    if (viewport.width !== 1536) {
      await open('before=1&scenario=zero');
      await expect(page.getByRole('checkbox').first()).toBeChecked();
      await page.screenshot({ path: path.join(shots, `448-before-${viewport.width}.png`), fullPage: true });
    }
    await open('scenario=zero');
    await expect(page.getByTestId('stock-coverage')).toContainText('Sin escaneos');
    await expect(page.getByTestId('stock-adjust')).toBeDisabled();
    await expect(page.getByRole('checkbox').first()).not.toBeChecked();
    if (viewport.width !== 1536) await page.screenshot({ path: path.join(shots, `448-after-${viewport.width}.png`), fullPage: true });
    await page.getByRole('checkbox').first().check();
    await page.getByTestId('stock-adjust').click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Faltante');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    expect(await page.evaluate(() => window.fixtureRequests.length)).toBe(0);
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await page.getByTestId('stock-adjust').click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Let the shared opening animation settle before measuring the footer.
    await expect.poll(async () => Math.round((await dialog.boundingBox()).y)).toBeGreaterThanOrEqual(0);
    await page.waitForTimeout(350);
    const footer = dialog.getByRole('button', { name: 'Archivar 12 equipos seleccionados' });
    const rect = await footer.boundingBox();
    expect(rect.height).toBeGreaterThanOrEqual(48);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    const scroll = dialog.locator('.sheet-scroll');
    expect(await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (viewport.width !== 1440) expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.screenshot({ path: path.join(shots, `448-confirm-start-${viewport.width}.png`), fullPage: true });
    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(footer).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(shots, `448-confirm-${viewport.width}.png`), fullPage: true });
    await page.evaluate(() => { window.fixtureFailNext = true; });
    await footer.click();
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('503');
    expect(await alert.evaluate(el => {
      const box = el.getBoundingClientRect();
      const scroll = el.closest('.sheet-scroll').getBoundingClientRect();
      return box.top >= scroll.top && box.bottom <= scroll.bottom;
    })).toBe(true);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Sobran 0' }).click();
    await expect(page.getByTestId('stock-adjust')).toBeDisabled();
    await page.goto(`${origin}/fixture?scenario=partial`);
    await page.getByRole('button', { name: /Cerrado el 19\/10/ }).click();
    await expect(page.getByTestId('stock-coverage')).toContainText('Conteo con equipos sin escanear');
    await page.getByRole('button', { name: 'Sobran 1' }).click();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId('stock-adjust')).toBeDisabled();
    await page.goto(`${origin}/fixture?scenario=complete`);
    await page.getByRole('button', { name: /Cerrado el 19\/10/ }).click();
    await expect(page.getByTestId('stock-coverage')).toContainText('Sin faltantes en la comparación');
    await expect(page.getByTestId('stock-excluded')).toContainText('3 equipos excluidos');
    await expect(page.getByText('Nada en este grupo')).toBeVisible();
    expect(errors).toEqual([]);
    checks++;
    await page.close();
  }
  console.log(`${checks} viewport checks passed (390×844, 1440×900, 1536×640). Synthetic screenshots: docs/pr-shots/448-*.png`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
