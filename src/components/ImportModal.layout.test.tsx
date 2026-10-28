import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { ImportModal } from './ImportModal';
import type { ImportAnalysis } from '../services/import-api';

const css = ['src/desk/desk.css', 'src/components/ImportModal.css'].map(file => readFileSync(file, 'utf8').replace(/^@import[^\n]*\n/, '')).join('\n');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });
const fields = [
  { key: 'model', label: 'Modelo', required: true },
  { key: 'capacity', label: 'Capacidad', required: false },
  { key: 'color', label: 'Color', required: false },
  { key: 'batteryHealth', label: 'Batería', required: false },
  { key: 'imei', label: 'IMEI', required: false },
  { key: 'cost', label: 'Costo', required: false },
  { key: 'price', label: 'Precio', required: false },
];
function fixture(): ImportAnalysis {
  const rows = Array.from({ length: 100 }, (_, index) => ({ model: `iPhone ${13 + index % 4}`, capacity: '128GB', color: 'Negro', batteryHealth: '90%', price: '420', cost: '300', imei: `35000000000${String(index).padStart(4, '0')}` }));
  return { source: 'heuristic', currency: 'USD', notice: null, rows,
    plan: [{ name: 'Stock', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 101, condition: '',
      mapping: fields.map((field, columnIndex) => ({ header: field.label, columnIndex, field: field.key })), splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD' }],
    summary: { sheetCount: 1, rowCount: 100, sheets: [{ name: 'Stock', included: true, rows: 100, condition: '' }] },
    diagnostics: { detectedRows: 157, acceptedRows: 100, discardedRows: 57, discardedByReason: { missing_model: 35, duplicate: 20, invalid_imei: 2 }, missingRequiredFields: [], missingRecommendedFields: [],
      rejected: Array.from({ length: 57 }, (_, index) => ({ row: 102 + index, reason: index < 35 ? 'missing_model' : index < 55 ? 'duplicate' : 'invalid_imei', message: `Motivo individual ${index}` })) },
  };
}
async function mount(page: Page) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0}${css}</style>${document.querySelector('.desk-app')!.outerHTML}`);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
}
async function capture(page: Page, name: string) {
  if (!process.env.IMPORT_DISCARD_SHOTS) return;
  mkdirSync(process.env.IMPORT_DISCARD_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(process.env.IMPORT_DISCARD_SHOTS, `${name}.png`) });
}
it.each([1440, 390])('agrupa descartes y aprovecha el alto con scroll y encabezado fijo a %i px', async width => {
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: width === 390, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1 });
  try {
    const value = fixture();
    const onClose = vi.fn();
    const onImport = vi.fn().mockResolvedValue({ imported: 100, updated: 0, errors: [] });
    render(<div className="desk-app"><ImportModal fields={fields} nouns={{ one: 'equipo', many: 'equipos' }} onAnalyze={vi.fn(async sheets => { value.plan[0].name = sheets[0].name; value.summary.sheets[0].name = sheets[0].name; return value; })} onApply={vi.fn().mockResolvedValue(value)} onImport={onImport} onClose={onClose} /></div>);
    await userEvent.upload(screen.getByLabelText('Archivo a importar'), new File(['Modelo,Capacidad,Color,Batería,IMEI,Costo,Precio\niPhone 13,128GB,Negro,90%,350000000000001,300,420'], 'stock.csv', { type: 'text/csv' }));
    const trigger = await screen.findByRole('button', { name: '57 filas descartadas · Ver motivos' });
    expect(trigger.closest('.imp-table-notices')).toBeNull();
    expect(screen.queryByText('Sin modelo')).not.toBeInTheDocument();
    await mount(page);
    const frame = page.locator('.imp-review-sheet');
    const table = page.getByTestId('import-preview');
    const geometry = await frame.evaluate(node => {
      const scroll = node.querySelector<HTMLElement>('.imp-table-scroll')!;
      const foot = node.querySelector('.sheet-foot')!.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const sheetScroll = node.querySelector('.sheet-scroll')!;
      return { x: box.x, right: box.right, bottom: box.bottom, footBottom: foot.bottom, outerOverflow: sheetScroll.scrollHeight - sheetScroll.clientHeight,
        tableBottom: scroll.getBoundingClientRect().bottom, footTop: foot.top, height: scroll.clientHeight, vertical: scroll.scrollHeight > scroll.clientHeight, horizontal: scroll.scrollWidth > scroll.clientWidth };
    });
    await capture(page, `importador-${width}`);
    expect(geometry.x).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.bottom).toBeLessThanOrEqual(width === 390 ? 844 : 900);
    expect(geometry.footBottom).toBeLessThanOrEqual(geometry.bottom);
    expect(geometry.outerOverflow).toBeLessThanOrEqual(1);
    expect(geometry.height).toBeGreaterThan(width === 390 ? 300 : 400);
    expect(geometry.vertical).toBe(true);
    expect(geometry.horizontal).toBe(true);
    expect(geometry.footTop - geometry.tableBottom).toBeLessThanOrEqual(25);
    const headerTop = (await table.locator('thead').boundingBox())!.y;
    await table.evaluate(node => { node.scrollTop = 500; node.scrollLeft = 400; });
    expect((await table.locator('thead').boundingBox())!.y).toBeCloseTo(headerTop, 0);
    expect((await table.locator('td.imp-pinned').first().boundingBox())!.x).toBeCloseTo((await table.boundingBox())!.x + 1, 0);
    await table.evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
    await capture(page, `importador-${width}`);
    if (width === 390) {
      await userEvent.click(screen.getByRole('button', { name: /Columnas \(/ }));
    }
    await userEvent.click(trigger);
    const detail = screen.getByRole('dialog', { name: 'Filas descartadas' });
    const groups = within(detail).getAllByRole('listitem');
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('Sin modelo35 filasFilas: 102, 103');
    expect(groups[1]).toHaveTextContent('IMEI inválido2 filasFilas: 157, 158');
    expect(groups[2]).toHaveTextContent('Duplicadas20 filasFilas: 137, 138');
    expect(detail).not.toHaveTextContent('Motivo individual');
    await mount(page);
    const detailBox = (await page.getByRole('dialog', { name: 'Filas descartadas' }).boundingBox())!;
    expect(detailBox.x).toBeGreaterThanOrEqual(0);
    expect(detailBox.x + detailBox.width).toBeLessThanOrEqual(width);
    expect(detailBox.y + detailBox.height).toBeLessThanOrEqual(width === 390 ? 844 : 900);
    await capture(page, `motivos-${width}`);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'Filas descartadas' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    if (width === 390) expect(screen.getByRole('complementary')).toHaveClass('imp-panel-open');
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(onImport).toHaveBeenCalledWith(value.rows);
  } finally { media.mockRestore(); await page.close(); }
}, 20000);
