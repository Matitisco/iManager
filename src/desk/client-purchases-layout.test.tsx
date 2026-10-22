import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import type { Product, Sale } from '../types';
import { ExchangeProvider } from './exchange';
import { ClientPurchases } from './ClientPurchases';
import { ColumnFilter } from './ColumnFilter';
import { Sheet } from './ui';

const css = readFileSync(path.resolve('src/desk/desk.css'), 'utf8').replace(/^@import[^\n]*\n/, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

const inventory = Array.from({ length: 10 }, (_, i): Product => ({
  id: `p${i}`, imei: `3567891045238${String(i).padStart(2, '0')}`, model: 'iPhone 15 Pro', capacity: '256GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', price: 1150000, status: 'VENDIDO', currency: 'USD',
}));
const sales = inventory.map((product, i): Sale => ({
  id: String(i), clientId: 'c', productId: product.id, date: `${String(14 - i).padStart(2, '0')}/10/2026`, amount: 1150000, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: i === 1 ? 'ANULADA' : 'COMPLETADA', warrantyDays: i % 2 ? 5 : 90,
}));

async function mount(page: Page, markup: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><body style="margin:0">${markup}</body>`);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
}

async function capture(page: Page, name: string) {
  if (!process.env.ISSUE_375_SHOTS) return;
  mkdirSync(process.env.ISSUE_375_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(process.env.ISSUE_375_SHOTS, `${name}.png`) });
}

describe('purchases and shared filter component layout', () => {
  it.each([390, 1440])('keeps full IMEI visible and the upper modal scrollable at %ipx', async (width) => {
    const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: width <= 760, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const page = await browser.newPage();
    try {
      render(<div className="desk-app"><ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}>
        <Sheet title="Nicolás Pereyra" subtitle="Última compra 14/10/2026 · DNI 33912450" onClose={vi.fn()} className="cl-sheet">
          <div className="dhero"><div className="eb">Saldo pendiente</div><div className="big">US$ 240.000</div></div>
          <div className="kv"><span>Teléfono</span><b>2615550106</b></div>
          <ClientPurchases clientId="c" clientName="Nicolás Pereyra" sales={sales} tradeIns={[]} repairs={[]} inventory={inventory} sellers={[]} />
          <h4>Señas y saldo a favor</h4>
        </Sheet>
      </ExchangeProvider></div>);
      await mount(page, document.querySelector('.desk-app')!.outerHTML, width);
      expect(await page.locator('.client-purchases .buy-item').count()).toBe(3);
      const meta = await page.locator('.buy-meta').first().evaluate(node => {
        const box = node.getBoundingClientRect();
        return { text: node.textContent, width: box.width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      });
      expect(meta.text).toContain('IMEI 356789104523800');
      expect(meta.scrollWidth).toBeLessThanOrEqual(meta.clientWidth + 1);
      const preview = await page.locator('.cl-sheet').boundingBox();
      expect(preview!.x).toBeGreaterThanOrEqual(0);
      expect(preview!.x + preview!.width).toBeLessThanOrEqual(width);
      await capture(page, `preview-${width}`);
      await userEvent.click(screen.getByTestId('purchases-more'));
      const title = width <= 760 ? 'Compras' : 'Compras · Nicolás Pereyra';
      expect(within(screen.getByRole('dialog', { name: title })).getAllByTestId(/^purchase-/)).toHaveLength(10);
      await mount(page, document.querySelector('.desk-app')!.outerHTML, width);
      const surface = await page.locator('.buy-sheet').boundingBox();
      if (width === 390) expect(surface).toMatchObject({ x: 0, y: 0, width: 390, height: 900 });
      else expect(surface!.width).toBe(560);
      const scroll = page.locator('.buy-sheet > .sheet-scroll');
      expect(await scroll.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
      await capture(page, `all-${width}`);
      await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
      const last = await page.locator('.buy-sheet .buy-item').last().boundingBox();
      expect(last!.y + last!.height).toBeLessThanOrEqual(901);
      expect(await page.locator('.buy-item.annulled .buy-amt').first().evaluate(node => getComputedStyle(node).textDecorationLine)).toContain('line-through');
    } finally { media.mockRestore(); await page.close(); }
  });

  it.each([390, 1440])('lays out seller names and payment options on one line at %ipx', async (width) => {
    const page = await browser.newPage();
    try {
      render(<div className="desk-app"><ColumnFilter label="vendedor" open active={false} onToggle={vi.fn()} onClear={vi.fn()}><div className="opts">
        <label className="chk"><input type="checkbox" /><span>Matías Tiscornia</span><em>125</em></label>
        <label className="chk"><input type="checkbox" /><span>Nombre de vendedor extraordinariamente largo para comprobar elipsis</span><em>9999</em></label>
        <label className="chk"><input type="checkbox" /><span>Transferencia bancaria internacional</span></label>
      </div></ColumnFilter></div>);
      await mount(page, document.querySelector('.desk-app')!.outerHTML, width);
      const result = await page.locator('.thpop').evaluate(node => ({
        width: node.getBoundingClientRect().width,
        right: node.getBoundingClientRect().right,
        options: [...node.querySelectorAll('label')].map(label => {
          const text = label.querySelector('span')!;
          const count = label.querySelector('em');
          const box = text.getBoundingClientRect();
          const style = getComputedStyle(text);
          return { height: label.getBoundingClientRect().height, textRight: box.right, countLeft: count?.getBoundingClientRect().left, nowrap: style.whiteSpace, ellipsis: style.textOverflow, overflow: style.overflow };
        }),
      }));
      expect(result.width).toBeGreaterThanOrEqual(220);
      expect(result.right).toBeLessThanOrEqual(width - 8);
      for (const option of result.options) {
        expect(option.height).toBeGreaterThanOrEqual(32);
        expect(option.height).toBeLessThan(45);
        expect(option).toMatchObject({ nowrap: 'nowrap', ellipsis: 'ellipsis', overflow: 'hidden' });
        if (option.countLeft !== undefined) expect(option.textRight).toBeLessThan(option.countLeft);
      }
      await capture(page, `filter-${width}`);
    } finally { await page.close(); }
  });
});
