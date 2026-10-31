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

describe.each([{ width: 390, theme: 'light' }, { width: 390, theme: 'dark' }, { width: 1440, theme: 'light' }])('quantity layout at $width px ($theme)', ({ width, theme }) => {
  it('keeps equipment, quantity and summary within their containers', async () => {
    const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: width === 390 && query.includes('max-width'), onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const date = new Date().toISOString();
    context.sales = [5, 1, 2].map((cantidad, i) => ({
      id: `sale-${i}`, saleNumber: i + 1, cantidad, date,
      clientId: 'c', clientName: 'Cliente ejemplo', productId: '', deviceLabel: 'iPhone 15 Pro Max 256GB',
      amount: 1000, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
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
        await page.setContent(`<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><style>body{margin:0}h1,h3,p{margin:0}${css}</style>${document.querySelector('.desk-app')!.outerHTML}</html>`);
        await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
      };
      await mount();
      expect(await page.locator('body').evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await page.getByText('Unidades vendidas').locator('..').textContent()).toContain('8');
      const equipment = page.locator(width === 390 ? '.sale-equipment > span:first-child' : 'tbody tr:first-child td:nth-child(5)');
      expect(await equipment.first().textContent()).toBe('iPhone 15 Pro Max 256GB');
      if (width === 390) {
        expect(await page.locator('.sale-quantity').allTextContents()).toEqual(['x5', 'x2']);
      } else {
        expect(await page.getByRole('columnheader', { name: 'Cant.' }).count()).toBe(1);
        expect(await page.locator('tbody .sale-quantity-cell').allTextContents()).toEqual(['5', '1', '2']);
        expect(await page.locator('tbody .sale-quantity-cell').first().evaluate(node => ({ align: getComputedStyle(node).textAlign, numbers: getComputedStyle(node).fontVariantNumeric, width: node.getBoundingClientRect().width }))).toMatchObject({ align: 'center', numbers: 'tabular-nums' });
      }
      const selectors = width === 390 ? '.sale-equipment, .sale-quantity, .sale-hero-grid > div' : 'tbody td, .dstats .dstat';
      for (const node of await page.locator(selectors).all()) {
        expect(await node.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const box = await node.boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      await checkBadges();
      if (directory) {
        if (width === 390) await page.locator('.stage').evaluate(node => { node.scrollTop = node.querySelector<HTMLElement>('.sale-sec')!.offsetTop - 80; });
        await page.screenshot({ path: path.join(directory, width === 1440 ? 'sales-desktop-1440.png' : `sales-mobile-390-${theme}.png`) });
      }

      render(<div className="desk-app" data-testid="purchase-layout"><ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}>
        <div className="sheet sheet-frame" style={{ margin: 'auto', padding: 16 }}>
          <ClientPurchases clientName="Cliente ejemplo" clientId="c" sales={context.sales} tradeIns={[]} repairs={[]} inventory={[]} sellers={[]} />
        </div>
      </ExchangeProvider></div>);
      const purchases = document.querySelector('[data-testid="purchase-layout"]')!;
      await page.setContent(`<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><style>body{margin:0}${css}</style>${purchases.outerHTML}</html>`);
      expect(await page.getByTestId('purchase-sale-sale-0').locator('.buy-title').textContent()).toContain('x5');
      expect(await page.locator('.sale-quantity').allTextContents()).toEqual(['x5', 'x2']);
      await checkBadges();
      for (const title of await page.locator('.buy-title').all()) {
        expect(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
      async function checkBadges() {
        for (const badge of await page.locator('.sale-quantity').all()) {
          const result = await badge.evaluate(node => {
            const style = getComputedStyle(node);
            const luminance = (color: string) => {
              const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const fg = luminance(style.color), bg = luminance(style.backgroundColor);
            const box = node.getBoundingClientRect(), parent = node.parentElement!.getBoundingClientRect();
            return { contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), radius: style.borderRadius, fits: box.left >= parent.left && box.right <= parent.right + 1 };
          });
          expect(result.contrast).toBeGreaterThanOrEqual(4.5);
          expect(result.radius).toBe('999px');
          expect(result.fits).toBe(true);
        }
      }
    } finally { media.mockRestore(); await page.close(); }
  });
});
