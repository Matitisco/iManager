import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { EquipmentDetail } from './equipment';

vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({
  inventory: [{ id: 'eq', model: 'iPhone 13', capacity: '128GB', imei: '', color: 'Negro', condition: 'USADO', batteryHealth: '90%', price: 500, status: 'DISPONIBLE' }],
  appSession: { membership: { role: 'OWNER' } },
}) }));
const css = readFileSync('src/desk/desk.css', 'utf8').replace(/^@import[^\n]*\n/, '');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

it.each([
  { width: 1440, height: 900, canManageSensitive: true },
  { width: 390, height: 844, canManageSensitive: true },
  { width: 320, height: 844, canManageSensitive: true },
  { width: 390, height: 844, canManageSensitive: false },
])('keeps the equipment footer visible with existing button styles at $width px (archive=$canManageSensitive)', async ({ width, height, canManageSensitive }) => {
  render(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive }}><EquipmentDetail id="eq" /></DeskProvider></div>);
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.setContent(`<style>${css}</style><body style="margin:0">${document.querySelector('.desk-app')!.outerHTML}</body>`);
    await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
    const buttons = await page.locator('.sheet-foot button').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { text: node.textContent, top: box.top, left: box.left, right: box.right, bottom: box.bottom, height: box.height, color: style.backgroundColor };
    }));
    expect(buttons.map(button => button.text)).toEqual(canManageSensitive ? ['Editar', 'Archivar', 'Guardar estado'] : ['Editar', 'Guardar estado']);
    for (const button of buttons) {
      expect(button.height).toBeGreaterThanOrEqual(width > 760 ? 52 : 48);
      expect(button.top).toBeGreaterThanOrEqual(0);
      expect(button.bottom).toBeLessThanOrEqual(height);
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(width);
    }
    expect(buttons[0].color).toBe('rgb(240, 241, 243)');
    expect(buttons.at(-1)!.color).toBe('rgb(22, 24, 29)');
    if (canManageSensitive) {
      expect(buttons[1].top).toBe(buttons[0].top);
      expect(buttons[1].color).toBe(buttons[0].color);
      expect(buttons[1].left).toBeGreaterThanOrEqual(buttons[0].right);
      if (width <= 760) {
        expect(buttons[2].top).toBeGreaterThanOrEqual(buttons[1].bottom);
        expect(buttons[2].left).toBe(buttons[0].left);
        expect(buttons[2].right).toBe(buttons[1].right);
      } else {
        expect(buttons[2].top).toBe(buttons[0].top);
        expect(buttons[2].left).toBeGreaterThanOrEqual(buttons[1].right);
      }
    }
  } finally { await page.close(); }
});
