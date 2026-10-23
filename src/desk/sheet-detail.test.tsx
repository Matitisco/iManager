import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { Sheet } from './ui';

const css = ['src/desk/desk.css', 'src/desk/sheet-detail.css', 'src/desk/screens/audit-layout.css', 'src/desk/screens/history.css'].map(file => readFileSync(file, 'utf8')).join('\n');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe('compact detail Sheet component layout', () => {
  it.each([
    { width: 1440, height: 900 }, { width: 1440, height: 480 },
    { width: 390, height: 844 }, { width: 320, height: 568 },
  ])('contains scrolling content between the fixed header and action at $width×$height', async viewport => {
    const phone = viewport.width <= 760;
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const { container } = render(<div className="desk-app"><div className="history-screen"><Sheet className="history-detail" variant="detail" title="Cerró un control de stock" onClose={() => undefined} footer={<div className="sheet-detail-actions">
      {!phone ? <button className="btn2 s">Cerrar</button> : null}<button className="btn2 p">Ver control</button>
    </div>}>
      {Array.from({ length: 40 }, (_, index) => <p key={index}>Equipo {index} · 128GB · IMEI 359770000000028</p>)}
    </Sheet></div></div>);
    const page = await browser.newPage({ viewport });
    try {
      await page.route('**/*', route => route.abort());
      await page.setContent(`<style>html,body{margin:0}${css}</style>${container.innerHTML}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
      const dialog = page.getByRole('dialog');
      const geometry = await dialog.evaluate(node => {
        const box = node.getBoundingClientRect();
        const header = node.querySelector('.sheet-h')!.getBoundingClientRect();
        const body = node.querySelector('.sheet-scroll')!;
        const foot = node.querySelector('.sheet-foot')!.getBoundingClientRect();
        const action = node.querySelector('.btn2.p')!.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, header: header.y, footer: foot.y, actionHeight: action.height, actionWidth: action.width, overflow: getComputedStyle(body).overflowY, scrollable: body.scrollHeight > body.clientHeight, headerBeforeBody: header.bottom <= body.getBoundingClientRect().top, bodyBeforeFooter: body.getBoundingClientRect().bottom <= foot.top };
      });
      expect(geometry.width).toBe(phone ? viewport.width : 480);
      expect(geometry.height).toBeLessThanOrEqual(phone ? viewport.height * .85 + 1 : viewport.height - 96);
      expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
      expect(geometry.overflow).toBe('auto');
      expect(geometry.scrollable).toBe(true);
      expect(geometry.headerBeforeBody).toBe(true);
      expect(geometry.bodyBeforeFooter).toBe(true);
      expect(geometry.actionHeight).toBe(phone ? 50 : 48);
      if (phone) {
        expect(geometry.bottom).toBe(viewport.height);
        expect(geometry.actionWidth).toBe(viewport.width - 40);
      } else {
        expect(geometry.x).toBe((viewport.width - 480) / 2);
        expect(geometry.y).toBe((viewport.height - geometry.height) / 2);
      }
      await dialog.locator('.sheet-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
      const after = await dialog.evaluate(node => ({ header: node.querySelector('.sheet-h')!.getBoundingClientRect().y, footer: node.querySelector('.sheet-foot')!.getBoundingClientRect().y }));
      expect(after).toEqual({ header: geometry.header, footer: geometry.footer });
    } finally { await page.close(); }
  });
});
