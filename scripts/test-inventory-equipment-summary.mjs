// Actual InventoryScreen and styles with example data; no API or database writes.
// Run: timeout 600 node scripts/test-inventory-equipment-summary.mjs
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';

const root = process.cwd();
const temp = await mkdtemp(path.join(root, '.inventory-summary-review-'));
const shots = path.join(root, 'docs/qa-inventory-equipment-total');
await mkdir(shots, { recursive: true });
let server;
let browser;
try {
  await writeFile(path.join(temp, 'context.ts'), `
    import { useSyncExternalStore } from 'react';
    let inventory = [];
    const listeners = new Set();
    window.setExampleInventory = (rows) => { inventory = rows; listeners.forEach(fn => fn()); };
    export const useAppContext = () => ({
      inventory: useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => inventory),
      suppliers: [], operationNotifications: [], operationDrafts: [], listsLoaded: true,
      appSession: { store: { name: 'Tienda de ejemplo', currency: 'USD', onboardingStartedAt: '2026-10-29' } },
    });
  `);
  await writeFile(path.join(temp, 'fixture.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { DeskProvider } from '/src/desk/ui';
    import { InventoryScreen } from '/src/desk/screens/InventoryScreen';
    import '/src/desk/desk.css';
    createRoot(document.getElementById('root')).render(
      <div className="desk-app"><main style={{ width: '100%', overflow: 'auto' }}>
        <DeskProvider value={{ tab: 'inventory', go() {}, open() {}, openRecord() {}, close() {}, toast() {}, isStaff: false }}>
          <InventoryScreen />
        </DeskProvider>
      </main></div>
    );
  `);
  server = await createServer({
    root, configFile: false,
    optimizeDeps: { entries: [path.join(temp, 'fixture.tsx')] },
    plugins: [{
      name: 'inventory-summary-fixture', enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('/context/AppContext')) return path.join(temp, 'context.ts');
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url !== '/fixture') return next();
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/fixture', `<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button,input{font:inherit}</style></head><body><div id="root"></div><script type="module" src="/${path.relative(root, temp)}/fixture.tsx"></script></body></html>`));
        });
      },
    }, react()],
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const rows = Array.from({ length: 59 }, (_, i) => ({
    id: String(i + 1), model: `iPhone de ejemplo ${i + 1}`, imei: String(i + 1).padEnd(15, '0'),
    capacity: '128 GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%',
    cost: 50, price: 100, currency: 'USD',
    status: i < 23 ? 'DISPONIBLE' : i < 53 ? 'EN_REVISION' : 'VENDIDO',
  }));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: viewport.width === 390 ? 2 : 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/fixture`);
    const card = page.getByTestId('onboarding-inventory-summary').locator(':scope > span').first();
    await expect(card.locator('b')).toHaveText('0');
    // Simulate inventory refresh after importing: verifies that the mounted card updates.
    await page.evaluate(rows => window.setExampleInventory(rows), rows);
    await expect(card.locator('b')).toHaveText('59');
    await expect(card.locator('.first-stock-breakdown')).toHaveText('23 disponibles · 30 en revisión · 6 vendidos');
    await expect(page.getByTestId('inventory-total')).toHaveText('59 de 59');
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: path.join(shots, `inventario-${viewport.width}.png`), animations: 'disabled' });
    await page.evaluate(rows => window.setExampleInventory(rows.map(row => row.id === '1' ? { ...row, archivedAt: '2026-10-29' } : row)), rows);
    await expect(card.locator('b')).toHaveText('58');
    await expect(card.locator('.first-stock-breakdown')).toHaveText('22 disponibles · 30 en revisión · 6 vendidos');
    expect(errors).toEqual([]);
    console.log(`OK ${viewport.width}: import refresh, total, breakdown, archive refresh, card bounds`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
