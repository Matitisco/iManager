import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../types';
import { ClientPurchases } from '../ClientPurchases';
import { ExchangeProvider } from '../exchange';
import { DeskProvider } from '../ui';
import { SalesScreen } from './SalesScreen';

const context = vi.hoisted(() => ({
  sales: [] as Sale[], clients: [], inventory: [], commissionSellers: [],
  appSession: { membership: { role: 'OWNER', sections: null } },
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

const css = readFileSync(path.resolve('src/desk/desk.css'), 'utf8').replace(/^@import[^\n]*\n/, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe.each([390, 1440])('quantity layout at %ipx', width => {
  it('keeps equipment, quantity and summary within their containers', async () => {
    const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: width === 390 && query.includes('max-width'), onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const date = new Date().toISOString();
    context.sales = [5, undefined, 2, 20].map((cantidad, i) => ({
      id: `sale-${i}`, saleNumber: i + 1, cantidad, date,
      clientId: 'c', clientName: 'Cliente ejemplo', productId: '', deviceLabel: 'iPhone 15 Pro Max 256GB',
      amount: 1000, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: i === 3 ? 'ANULADA' : 'COMPLETADA',
    }));
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1 });
    try {
      render(<div className="desk-app">
        {width === 1440 ? <aside className="side" aria-hidden="true" /> : null}
        <main className="stage"><ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}>
          <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><SalesScreen /></DeskProvider>
        </ExchangeProvider></main>
      </div>);
      const directory = process.env.SALE_QUANTITY_SHOTS;
      if (directory) mkdirSync(directory, { recursive: true });
      const mount = async () => {
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0}h1,h3,p{margin:0}${css}</style>${document.querySelector('.desk-app')!.outerHTML}`);
        await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
      };
      await mount();
      expect(await page.locator('body').evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await page.getByText('Unidades vendidas').locator('..').textContent()).toContain('8');
      const equipment = page.locator(width === 390 ? '.sale-who small' : 'tbody tr:first-child td:nth-child(5)');
      expect(await equipment.first().textContent()).toContain('iPhone 15 Pro Max 256GB x5');
      const selectors = width === 390 ? '.sale-who small, .sale-hero-grid > div' : 'tbody td:nth-child(5), .dstats .dstat';
      for (const node of await page.locator(selectors).all()) {
        expect(await node.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const box = await node.boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      if (directory) await page.screenshot({ path: path.join(directory, `sales-${width}.png`) });

      render(<div className="desk-app" data-testid="purchase-layout"><ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}>
        <div className="sheet sheet-frame" style={{ margin: 'auto', padding: 16 }}>
          <ClientPurchases clientName="Cliente ejemplo" clientId="c" sales={context.sales} tradeIns={[]} repairs={[]} inventory={[]} sellers={[]} />
        </div>
      </ExchangeProvider></div>);
      const purchases = document.querySelector('[data-testid="purchase-layout"]')!;
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0}${css}</style>${purchases.outerHTML}`);
      expect(await page.getByTestId('purchase-sale-sale-0').locator('.buy-title').textContent()).toContain('x5');
      for (const title of await page.locator('.buy-title').all()) {
        expect(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
      if (directory) await page.screenshot({ path: path.join(directory, `client-${width}.png`) });
    } finally { media.mockRestore(); await page.close(); }
  });
});
