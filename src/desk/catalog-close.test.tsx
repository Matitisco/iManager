import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import type { CatalogKind, CatalogOption, CatalogPayload } from '../services/catalogs-api';
import { CatalogEditor, CatalogProvider, useCatalogs } from './catalog';
import { Sheet } from './ui';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  save: vi.fn(),
  context: { user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER' }, onboardingRequired: false } },
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => mocks.context }));
vi.mock('../services/catalogs-api', () => ({ fetchCatalogs: mocks.fetch, saveCatalog: mocks.save }));

const css = readFileSync(path.resolve(process.cwd(), 'src/desk/desk.css'), 'utf8').replace(/^@import[^\n]*\n/, '');
const shots = process.env.STATUS_CLOSE_SHOTS;
const kinds: CatalogKind[] = ['INVENTORY_STATUS', 'INVENTORY_CAPACITY', 'INVENTORY_CONDITION', 'SALE_STATUS', 'TRADE_IN_STATUS', 'CLIENT_TAG', 'REPAIR_STATUS'];
const meta = Object.fromEntries(kinds.map((kind) => [kind, { title: kind, add: 'Agregar estado', noun: ['equipo', 'equipos'] as [string, string] }])) as CatalogPayload['meta'];
meta.TRADE_IN_STATUS = { title: 'Estados de canje', add: 'Agregar estado', noun: ['canje', 'canjes'] };
meta.SALE_STATUS = { title: 'Estados de venta', add: 'Agregar estado', noun: ['venta', 'ventas'] };

function option(value: string, label: string, color: string, count: number): CatalogOption {
  return { id: value, kind: 'TRADE_IN_STATUS', value, label, color, isSystem: true, sortOrder: 0, count };
}

function ReadyEditor({ kind }: { kind: CatalogKind }) {
  const catalogs = useCatalogs();
  return catalogs?.ready ? <CatalogEditor kind={kind} onClose={() => undefined} /> : null;
}

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({
    meta,
    options: [
      option('PENDIENTE', 'Pendiente', '#E8A33D', 4),
      option('APROBADO', 'Aprobado', '#25A66A', 2),
      option('RECHAZADO', 'Rechazado', '#DC4C4C', 1),
    ],
  } satisfies CatalogPayload);
  mocks.save.mockResolvedValue({ meta, options: [] });
});

async function editorHtml(kind: CatalogKind) {
  render(<CatalogProvider><ReadyEditor kind={kind} /></CatalogProvider>);
  await screen.findByRole('dialog');
  const html = document.querySelector('.ov')?.outerHTML ?? '';
  cleanup();
  return html;
}

function sheetCloseHtml() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: String(query).includes('760'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  try {
    render(<Sheet title="Registrar canje" onClose={() => undefined}><p>Detalle</p></Sheet>);
    const html = document.querySelector('.sheet .modal-x')?.outerHTML ?? '';
    cleanup();
    return html;
  } finally {
    window.matchMedia = original;
  }
}

async function mount(page: Page, editor: string, reference: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    ${css}
    html, body { margin: 0; background: #d8dbe0; }
    #sheet-ref { position: fixed; left: -480px; top: 24px; display: flex; }
  </style></head><body>
    <div class="desk-app">${editor}<div id="sheet-ref">${reference}</div></div>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
}

function readClose(root: string) {
  const button = document.querySelector(`${root} .modal-x`);
  const icon = button?.querySelector('svg');
  if (!(button instanceof HTMLElement) || !(icon instanceof SVGElement)) throw new Error(`close missing in ${root}`);
  const buttonBox = button.getBoundingClientRect();
  const iconBox = icon.getBoundingClientRect();
  const style = getComputedStyle(button);
  return {
    icon: icon.getAttribute('data-icon'),
    iconWidth: iconBox.width,
    iconHeight: iconBox.height,
    width: buttonBox.width,
    height: buttonBox.height,
    dx: Math.abs((buttonBox.left + buttonBox.width / 2) - (iconBox.left + iconBox.width / 2)),
    dy: Math.abs((buttonBox.top + buttonBox.height / 2) - (iconBox.top + iconBox.height / 2)),
    display: style.display,
    padding: style.padding,
    radius: style.borderRadius,
    background: style.backgroundColor,
    align: style.alignItems,
    justify: style.justifyContent,
    inside: buttonBox.left >= -1 && buttonBox.top >= -1 && buttonBox.right <= window.innerWidth + 1 && buttonBox.bottom <= window.innerHeight + 1,
  };
}

describe('status editor close button', () => {
  it('matches the other modals and stays centered at 1440x900 and 390x844', async () => {
    const trade = await editorHtml('TRADE_IN_STATUS');
    const sale = await editorHtml('SALE_STATUS');
    const reference = sheetCloseHtml();
    expect(trade).toContain('modal-x');
    expect(sale).toContain('modal-x');
    expect(reference).toContain('modal-x');
    expect(trade).toContain('data-icon="cerrar"');
    expect(sale).toContain('data-icon="cerrar"');

    const page = await browser.newPage();
    try {
      if (shots) mkdirSync(shots, { recursive: true });
      for (const [kind, html] of [['canje', trade], ['venta', sale]] as const) {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }] as const) {
          await mount(page, html, reference, viewport.width, viewport.height);
          await page.locator('.dialog.stx').evaluate(async (node) => {
            const animations = node.getAnimations({ subtree: true });
            await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
          });
          const measured = await page.evaluate(readClose, '.dialog.stx');
          const sheet = await page.evaluate(readClose, '#sheet-ref');
          expect(measured.icon).toBe('cerrar');
          expect(Math.abs(measured.iconWidth - 16)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(measured.iconHeight - 16)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(measured.width - 36)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(measured.height - 36)).toBeLessThanOrEqual(0.5);
          expect(measured.dx).toBeLessThanOrEqual(0.5);
          expect(measured.dy).toBeLessThanOrEqual(0.5);
          expect(['flex', 'inline-flex']).toContain(measured.display);
          expect(measured.padding).toBe('0px');
          expect(measured.align).toBe('center');
          expect(measured.justify).toBe('center');
          expect(measured.background).toBe('rgb(240, 241, 243)');
          expect(measured.inside).toBe(true);
          expect(Math.abs(measured.width - sheet.width)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(measured.height - sheet.height)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(measured.iconWidth - sheet.iconWidth)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(measured.iconHeight - sheet.iconHeight)).toBeLessThanOrEqual(0.5);
          expect(measured.radius).toBe(sheet.radius);
          expect(measured.background).toBe(sheet.background);
          expect(measured.display).toBe(sheet.display);
          expect(sheet.dx).toBeLessThanOrEqual(0.5);
          expect(sheet.dy).toBeLessThanOrEqual(0.5);
          if (shots && kind === 'canje') {
            await page.screenshot({ path: path.join(shots, `status-modal-${viewport.width}x${viewport.height}.png`) });
            await page.locator('.dialog.stx').screenshot({ path: path.join(shots, `status-modal-dialog-${viewport.width}x${viewport.height}.png`) });
          }
        }
      }
    } finally {
      await page.close();
    }
  });
});
