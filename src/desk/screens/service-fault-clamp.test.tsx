import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import type { RepairOrder } from '../../types';
import { RepairOrderDetail } from '../RepairForms';
import { DeskProvider } from '../ui';
import { ServiceScreen } from './ServiceScreen';

const css = readFileSync(path.resolve(process.cwd(), 'src/desk/desk.css'), 'utf8');
const shots = process.env.FAULT_CLAMP_SHOTS?.trim();
const STORY = 'El cliente cuenta que el equipo se cayó de la mesa y desde entonces la pantalla queda negra, el táctil no responde en la mitad de abajo y a veces se reinicia solo. Deja el cargador original, la funda y la clave de la pantalla.';
const LONG_WORD = 'ConectorSulfatado'.repeat(8);
const LONG_FAULT = `${STORY} ${LONG_WORD}. Revisar si entra agua por el puerto.`;

const state = vi.hoisted(() => ({
  repairOrders: [] as RepairOrder[],
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    repairOrders: state.repairOrders,
    repairOrdersError: null,
    changeRepairStatus: vi.fn(),
  }),
}));

function order(id: string, status: string, fault: string): RepairOrder {
  return {
    id,
    orderNumber: Number(id),
    code: `OT-${id.padStart(4, '0')}`,
    clientId: 'c1',
    clientName: 'Ana Pérez',
    clientPhone: '2614000000',
    device: 'iPhone 13',
    imei: '350000000000001',
    fault,
    faultTags: [],
    estimate: 45000,
    deposit: 10000,
    technician: 'Técnico Ejemplo',
    status,
    estimatedDelivery: '20/10/2026',
    notifyWhatsapp: false,
    receivedAt: '03/10/2026',
    whatsappUrl: null,
    events: [{ id: `${id}-e`, status, createdAt: '03/10/2026' }],
  };
}

function usePhone(phone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: phone && String(query).includes('760'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function desk(node: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'service', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive: true }}>
      {node}
    </DeskProvider>,
  );
}

function html(selector: string) {
  const markup = document.querySelector(selector)?.outerHTML ?? '';
  cleanup();
  return markup;
}

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
  if (shots) mkdirSync(shots, { recursive: true });
});

afterAll(async () => {
  await browser?.close();
});

async function mount(page: Page, markup: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0">
    <div class="desk-app"><main class="stage">${markup}</main></div>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const animations = document.getAnimations();
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function readBoard(page: Page, faultId: string) {
  return page.evaluate((id) => {
    const fault = document.querySelector(`[data-testid="repair-fault-${id}"]`);
    const card = fault?.closest('.ticket');
    const column = fault?.closest('.dcol') ?? fault?.closest('section');
    if (!(fault instanceof HTMLElement) || !(card instanceof HTMLElement) || !(column instanceof HTMLElement)) throw new Error('card missing');
    const style = getComputedStyle(fault);
    const faultBox = fault.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const columnBox = column.getBoundingClientRect();
    const columns = [...document.querySelectorAll('.dcol, .svc-groups section')].map((node) => node.getBoundingClientRect().width);
    return {
      text: fault.textContent ?? '',
      lineClamp: style.getPropertyValue('-webkit-line-clamp'),
      lineHeight: parseFloat(style.lineHeight),
      clampedHeight: faultBox.height,
      cardRight: cardBox.right,
      columnRight: columnBox.right,
      cardWidth: cardBox.width,
      columnWidth: columnBox.width,
      columns,
      scrollWidth: fault.scrollWidth,
      clientWidth: fault.clientWidth,
      insideCard: faultBox.left >= cardBox.left - 1 && faultBox.right <= cardBox.right + 1,
      insideViewport: cardBox.left >= -1 && cardBox.right <= window.innerWidth + 1,
    };
  }, faultId);
}

async function readPreview(page: Page) {
  return page.evaluate(() => {
    const fault = document.querySelector('[data-testid="repair-fault"]');
    const sheet = document.querySelector('.sheet');
    if (!(fault instanceof HTMLElement) || !(sheet instanceof HTMLElement)) throw new Error('preview missing');
    const style = getComputedStyle(fault);
    const faultBox = fault.getBoundingClientRect();
    const sheetBox = sheet.getBoundingClientRect();
    return {
      text: fault.textContent ?? '',
      lineClamp: style.getPropertyValue('-webkit-line-clamp'),
      whiteSpace: style.whiteSpace,
      lineHeight: parseFloat(style.lineHeight),
      height: faultBox.height,
      sheetWidth: sheetBox.width,
      sheetLeft: sheetBox.left,
      sheetRight: sheetBox.right,
      scrollWidth: sheet.scrollWidth,
      clientWidth: sheet.clientWidth,
      insideSheet: faultBox.left >= sheetBox.left - 1 && faultBox.right <= sheetBox.right + 1,
      insideViewport: sheetBox.left >= -1 && sheetBox.right <= window.innerWidth + 1 && sheetBox.bottom <= window.innerHeight + 1,
    };
  });
}

describe('falla larga en servicio técnico', () => {
  it('clamps the board card and keeps the preview inside 1440x900', async () => {
    usePhone(false);
    state.repairOrders = [
      order('1', 'RECIBIDO', LONG_FAULT),
      order('2', 'EN_REPARACION', 'Pantalla rota'),
    ];
    desk(<ServiceScreen />);
    expect(within(screen.getByTestId('repair-card-1')).getByTestId('repair-fault-1')).toHaveTextContent(LONG_FAULT);
    const board = html('.dscreen');
    state.repairOrders = [order('1', 'RECIBIDO', LONG_FAULT)];
    desk(<RepairOrderDetail id="1" busy={false} />);
    expect(screen.getByTestId('repair-fault')).toHaveTextContent(LONG_FAULT);
    const preview = html('.ov');

    const page = await browser.newPage();
    try {
      await mount(page, board, 1440, 900);
      const card = await readBoard(page, '1');
      const openHeight = await page.evaluate(() => {
        const fault = document.querySelector('[data-testid="repair-fault-1"]');
        if (!(fault instanceof HTMLElement)) throw new Error('fault missing');
        fault.classList.remove('svc-fault');
        const height = fault.getBoundingClientRect().height;
        fault.classList.add('svc-fault');
        return height;
      });
      expect(card.text).toBe(LONG_FAULT);
      expect(card.lineClamp).toBe('3');
      expect(card.clampedHeight).toBeLessThanOrEqual(card.lineHeight * 3 + 2);
      expect(card.clampedHeight).toBeGreaterThan(card.lineHeight * 2);
      expect(openHeight).toBeGreaterThan(card.clampedHeight + card.lineHeight);
      expect(Math.max(...card.columns) - Math.min(...card.columns)).toBeLessThanOrEqual(2);
      expect(card.cardWidth).toBeLessThanOrEqual(card.columnWidth + 1);
      expect(card.cardRight).toBeLessThanOrEqual(card.columnRight + 1);
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      expect(card.insideCard).toBe(true);
      expect(card.insideViewport).toBe(true);
      if (shots) await page.screenshot({ path: path.join(shots, 'desktop-1440x900-tablero.png') });

      await mount(page, `${board}${preview}`, 1440, 900);
      const detail = await readPreview(page);
      expect(detail.text).toBe(LONG_FAULT);
      expect(detail.lineClamp).toBe('none');
      expect(detail.whiteSpace).toBe('pre-wrap');
      expect(detail.height).toBeGreaterThan(detail.lineHeight * 3);
      expect(detail.sheetWidth).toBeGreaterThan(500);
      expect(detail.sheetWidth).toBeLessThanOrEqual(560);
      expect(detail.scrollWidth).toBeLessThanOrEqual(detail.clientWidth + 1);
      expect(detail.insideSheet).toBe(true);
      expect(detail.insideViewport).toBe(true);
      if (shots) await page.screenshot({ path: path.join(shots, 'desktop-1440x900-preview.png') });
    } finally {
      await page.close();
    }
  });

  it('clamps the phone card and keeps the preview inside 390x844', async () => {
    usePhone(true);
    state.repairOrders = [
      order('1', 'RECIBIDO', LONG_FAULT),
      order('2', 'EN_REPARACION', 'Pantalla rota'),
    ];
    desk(<ServiceScreen />);
    expect(screen.queryByTestId('repair-board')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('repair-card-1')).getByTestId('repair-fault-1')).toHaveTextContent(LONG_FAULT);
    const board = html('.dscreen');
    state.repairOrders = [order('1', 'RECIBIDO', LONG_FAULT)];
    desk(<RepairOrderDetail id="1" busy={false} />);
    expect(screen.getByTestId('repair-fault').closest('.svc-fault-card')).not.toBeNull();
    const preview = html('.ov');

    const page = await browser.newPage();
    try {
      await mount(page, board, 390, 844);
      const card = await readBoard(page, '1');
      const openHeight = await page.evaluate(() => {
        const fault = document.querySelector('[data-testid="repair-fault-1"]');
        if (!(fault instanceof HTMLElement)) throw new Error('fault missing');
        fault.classList.remove('svc-fault');
        const height = fault.getBoundingClientRect().height;
        fault.classList.add('svc-fault');
        return height;
      });
      expect(card.lineClamp).toBe('3');
      expect(card.clampedHeight).toBeLessThanOrEqual(card.lineHeight * 3 + 2);
      expect(card.clampedHeight).toBeGreaterThan(card.lineHeight * 2);
      expect(openHeight).toBeGreaterThan(card.clampedHeight + card.lineHeight);
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      expect(card.insideCard).toBe(true);
      expect(card.insideViewport).toBe(true);
      if (shots) await page.screenshot({ path: path.join(shots, 'phone-390x844-tablero.png') });

      await mount(page, `${board}${preview}`, 390, 844);
      const detail = await readPreview(page);
      expect(detail.text).toBe(LONG_FAULT);
      expect(detail.lineClamp).toBe('none');
      expect(detail.height).toBeGreaterThan(detail.lineHeight * 3);
      expect(detail.sheetRight).toBeLessThanOrEqual(390 + 1);
      expect(detail.scrollWidth).toBeLessThanOrEqual(detail.clientWidth + 1);
      expect(detail.insideSheet).toBe(true);
      expect(detail.insideViewport).toBe(true);
      if (shots) await page.screenshot({ path: path.join(shots, 'phone-390x844-preview.png') });
    } finally {
      await page.close();
    }
  });
});
