// Real component with synthetic context only; no app deployment, API or database.
// Run: node scripts/test-inventory-filter-panel.mjs
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';

const root = process.cwd();
const base = '9b30ecf277783ef9a1ccf69f723772262a479612';
const source = 'src/desk/screens/InventoryScreen.tsx';
const baseline = execFileSync('git', ['show', `${base}:${source}`], { encoding: 'utf8' });
const baselineCss = execFileSync('git', ['show', `${base}:src/desk/desk.css`], { encoding: 'utf8' });
const temp = await mkdtemp(path.join(root, '.inventory-filter-review-'));
const shots = path.join(root, 'docs/issue-449');
await mkdir(shots, { recursive: true });
let server;
let browser;
try {
  await writeFile(path.join(temp, 'context.ts'), `
    const scenario = new URLSearchParams(location.search).get('scenario');
    const colors = ['Azul océano / Plata', 'AZUL OCEANO / PLATA', 'Negro', 'Verde', 'Rojo', 'Rosa', 'Dorado', 'Blanco', 'Titanio natural', 'Azul medianoche metalizado con reflejos plateados', 'Plata / Gris espacial', 'Verde bosque oscuro'];
    const context = {
      appSession: { store: { name: 'Stock sintético' } }, operationNotifications: [], operationDrafts: [],
      listsLoaded: scenario !== 'loading',
      inventory: scenario === 'empty' || scenario === 'loading' ? [] : colors.map((color, i) => ({
        id: String(i + 1), model: 'Equipo de prueba ' + (i + 1), imei: String(i + 1).padEnd(15, '0'),
        capacity: '128 GB', color, condition: i === 0 ? 'USADO' : 'NUEVO', grade: i === 0 ? 'A+' : '',
        batteryHealth: i === 0 ? '83-85%' : '100%', cost: 100, price: (i + 1) * 1000,
        status: i === 0 ? 'EN_REVISION' : 'DISPONIBLE', needsCompletion: i === 0
      }))
    }; export const useAppContext = () => context;
  `);
  await writeFile(path.join(temp, 'fixture.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { DeskProvider } from '/src/desk/ui';
    const before = new URLSearchParams(location.search).has('before');
    await import(before ? '/src/desk/desk.css?baseline449' : '/src/desk/desk.css');
    const { InventoryScreen } = await import(before ? '/${source}?baseline449' : '/${source}?review449');
    createRoot(document.getElementById('root')).render(
      <div className="desk-app"><main style={{ width: '100%', overflow: 'auto' }}>
        <DeskProvider value={{ tab: 'inventory', go: () => {}, open: () => {}, openRecord: () => {}, close: () => {}, toast: () => {}, isStaff: false }}>
          <InventoryScreen />
        </DeskProvider>
      </main></div>
    );
  `);
  server = await createServer({
    root, configFile: false,
    optimizeDeps: { entries: [path.join(temp, 'fixture.tsx')] },
    plugins: [{
      name: 'inventory-filter-panel-fixture', enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('/context/AppContext')) return path.join(temp, 'context.ts');
      },
      async load(id) {
        if (id.endsWith(`${source}?baseline449`) || id.endsWith(`${source}?review449`)) {
          const code = id.endsWith('?baseline449') ? baseline : await readFile(path.join(root, source), 'utf8');
          // Test-only trigger: desktop exposes column filters rather than this mobile panel.
          return code.replace('<div className="dright">', '<div className="dright"><button hidden type="button" aria-label="Filtros" onClick={openFilters} />');
        }
        if (id.endsWith('src/desk/desk.css?baseline449')) return baselineCss;
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
  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 1536, height: 640 }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // No requests to remote services (including fonts); no service worker or PWA cache.
    await page.route('https://**', (route) => route.abort());
    const open = async (query = '') => {
      await page.goto(`${origin}/fixture?${query}`);
      // Desktop normally uses column filters. Exercise the same Sheet at desktop sizes.
      const trigger = page.getByRole('button', { name: 'Filtros', exact: true, includeHidden: true });
      if (viewport.width > 760) await trigger.evaluate((el) => el.click());
      else await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
      await expect(dialog).toBeVisible();
      await dialog.evaluate(async (el) => { await Promise.all(el.getAnimations().map((a) => a.finished)); });
      return dialog;
    };
    const screenshot = (state) => page.screenshot({ path: path.join(shots, `${state}-${viewport.width}.png`), animations: 'disabled' });
    const before = await open('before=1');
    const oldLabel = before.getByRole('checkbox', { name: 'Solo equipos para completar' }).locator('..');
    expect((await oldLabel.boundingBox()).width).toBe(18);
    await screenshot('before');
    console.log(`${viewport.width}: reproduced main label width 18px`);
    let dialog = await open();
    const scroll = dialog.locator('.sheet-scroll');
    const footer = dialog.locator('.sheet-foot');
    const assertLayout = async () => {
      expect(await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const label of await dialog.locator('label.chk:visible').all()) {
        const box = await label.boundingBox();
        expect(box.width).toBeGreaterThan(viewport.width < 760 ? viewport.width - 65 : 400);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(await label.evaluate((el) => {
          const text = el.querySelector('span').getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return text.right <= box.right + 1 && text.left >= box.left && text.bottom <= box.bottom + 1;
        })).toBe(true);
      }
      for (const action of await footer.getByRole('button').all()) {
        const box = await action.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(48);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    };
    await assertLayout();
    await screenshot('after');
    console.log(`${viewport.width}: labels and footer fit`);
    await dialog.getByText('Solo equipos para completar', { exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Solo equipos para completar' })).toBeChecked();
    await dialog.getByText('En revisión', { exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: 'En revisión' })).toBeChecked();
    await dialog.getByRole('button', { name: '≥ 80%' }).click();
    await expect(dialog.getByRole('button', { name: '≥ 80%' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', { name: 'Todas', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('textbox', { name: 'Máximo', exact: true }).fill('2000');
    await expect(dialog.getByRole('button', { name: '≥ 80%' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByText('Color · 0 seleccionados')).toBeVisible();
    await screenshot('frequent');
    await dialog.getByText('Color · 0 seleccionados').click();
    const search = dialog.getByRole('searchbox', { name: 'Buscar color' });
    await search.fill('oceano');
    await dialog.getByText('Azul océano / Plata', { exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Azul océano / Plata', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'AZUL OCEANO / PLATA', exact: true })).not.toBeChecked();
    await search.fill('inexistente');
    await expect(dialog.getByText('No hay colores con esa búsqueda. Probá otro nombre.')).toBeVisible();
    await expect(dialog.getByText('Color · 1 seleccionado')).toBeVisible();
    await search.fill('');
    await expect(dialog.locator('.inv-colors input[type=checkbox]')).toHaveCount(12);
    await assertLayout();
    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(dialog.getByRole('checkbox', { name: 'Verde bosque oscuro' })).toBeVisible();
    await screenshot('colors');
    await footer.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByTestId('inventory-total')).toContainText('1 de 12');
    await page.getByRole('button', { name: 'Filtros', exact: true, includeHidden: true }).evaluate((el) => el.click());
    dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
    await dialog.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(dialog.getByText('0 filtros seleccionados')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('inventory-total')).toContainText('1 de 12');
    await page.getByRole('button', { name: 'Filtros', exact: true, includeHidden: true }).evaluate((el) => el.click());
    dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
    await expect(dialog.getByRole('checkbox', { name: 'En revisión' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Limpiar filtros' }).click();
    await dialog.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByTestId('inventory-total')).toContainText('12 de 12');
    await open('scenario=empty');
    await expect(page.getByText('Todavía no hay colores en el stock.')).toBeVisible();
    await screenshot('empty');
    await open('scenario=loading');
    await expect(page.getByRole('status', { name: 'Cargando' })).toHaveCount(1);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log('Inventory filter panel passed at 320×844, 390×844, 1440×900, 1536×640. Screenshots: docs/issue-449/*.png');
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
