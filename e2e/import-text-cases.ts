import { openDeskSection } from './navigation';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, fetchInventory } from './utils';
import type { ImportAnalysis } from '../src/services/import-api';

const fixture = 'backend/test/fixtures/import-text/57-mixto-24-lineas';
const listing = readFileSync(`${fixture}.txt`, 'utf8') + 'Gracias gente';
const expected = JSON.parse(readFileSync(`${fixture}.expected.json`, 'utf8')).rows as Array<Record<string, string | number | string[] | null>>;
const rows = expected.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !['line', 'endLine', 'dudas'].includes(key)).map(([key, value]) => [key, value === null ? '' : String(value)])));
const analysis: ImportAnalysis = {
  source: 'model', notice: null, currency: 'ARS', plan: [], rows,
  review: expected.map((row) => ({ line: Number(row.line), original: listing.split('\n')[Number(row.line) - 1], dudas: row.condition ? [] : ['Sin condición: revisá antes de importar.'] })),
  discarded: [{ line: 25, original: 'Gracias gente', reason: 'Comentario sin equipo' }],
  summary: { sheetCount: 1, rowCount: rows.length, sheets: [{ name: 'Listado de texto', rows: rows.length, condition: '', included: true }] },
};
const API = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3100';
async function openImport(page: Page, phone: boolean) {
  await openDeskSection(page, 'inventory');
  const button = phone ? page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }) : page.getByRole('button', { name: 'Importar', exact: true });
  await button.click();
  return page.getByRole('dialog', { name: 'Importar equipos' });
}
export function importTextCases(phone: boolean) {
  test('pega 24 líneas mixtas, revisa dudas, edita y confirma con persistencia real', async ({ page, request }, testInfo) => {
    test.setTimeout(120000);
    const email = buildTestEmail(testInfo, `import-text-${phone ? 'iphone' : 'desktop'}`);
    const outbound: string[] = [];
    page.on('request', (request) => { if (request.url().includes('api.openai.com')) outbound.push(request.url()); });
    await bootstrapStoreViaApi(page, request, email, 'Texto 338');
    let receivedText = '';
    await page.route('**/api/import/analyze-text', async (route) => {
      receivedText = route.request().postDataJSON().text;
      await route.fulfill({ json: analysis });
    });
    const dialog = await openImport(page, phone);
    await dialog.getByRole('button', { name: 'Pegar listado' }).click();
    await dialog.getByRole('textbox', { name: 'Listado de equipos' }).fill(listing);
    await dialog.getByRole('button', { name: 'Analizar listado' }).click();
    await expect(dialog.getByTestId('import-preview')).toHaveAttribute('aria-rowcount', '24');
    expect(receivedText).toBe(listing);
    await page.screenshot({ path: testInfo.outputPath('issue338-preview.png') });
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await expect(dialog.getByTestId('import-preview-row').first()).toHaveClass(/bg-amber-50/);
    await dialog.getByTestId('import-edit-row-0').click();
    const editor = dialog.getByTestId('import-row-editor');
    await expect(editor).toContainText('Sin condición');
    await editor.getByRole('textbox', { name: 'Precio', exact: true }).fill('425');
    await editor.getByRole('button', { name: 'Listo' }).click();
    for (const [index, row] of rows.entries()) {
      if (row.price) continue;
      const preview = dialog.getByTestId('import-preview');
      await preview.evaluate((element, index) => { element.scrollTop = index * 120; }, index);
      await dialog.getByTestId(`import-edit-row-${index}`).click();
      await dialog.getByTestId('import-row-editor').getByRole('textbox', { name: 'Precio', exact: true }).fill('0');
      await dialog.getByTestId('import-row-editor').getByRole('button', { name: 'Listo' }).click();
    }
    await dialog.getByTestId('import-discarded').locator('summary').click();
    await expect(dialog.getByTestId('import-discarded')).toContainText('Comentario sin equipo');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const response = page.waitForResponse((response) => response.url().includes('/api/inventory/import') && response.request().method() === 'POST');
    await dialog.getByTestId('import-confirm').click();
    const count = rows.reduce((total, row) => total + Number(row.quantity), 0);
    expect((await response).ok()).toBe(true);
    await expect(dialog.getByText(`${count} creados`, { exact: false })).toBeVisible();
    const stored = await request.get(`${API}/api/inventory`, { headers: authHeaders(email) });
    const inventory = (await stored.json()).inventory as Array<{ model: string; price: number; currency: string; batteryHealth: string; imei: string; customFields: Record<string, unknown> }>;
    expect(inventory).toHaveLength(count);
    expect(inventory.some((row) => row.price === 425 && row.currency === 'USD')).toBe(true);
    expect(inventory.some((row) => row.currency === 'ARS' && row.price === 320000)).toBe(true);
    expect(inventory.some((row) => row.imei === '001234567890123')).toBe(true);
    expect(inventory.filter((row) => row.price === 490 && row.model === 'iPhone 13')).toHaveLength(3);
    expect(inventory.some((row) => row.customFields.serial === 'F2LQ9A7BC8')).toBe(true);
    expect(inventory.find((row) => row.price === 425)?.batteryHealth).toBe('89%');
    await dialog.getByText('Cerrar', { exact: true }).click();
    await page.reload();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(count);
    expect(outbound).toEqual([]);
  });

  test('sube .txt, excluye filas y conserva la moneda del listado', async ({ page, request }, testInfo) => {
    await bootstrapStoreViaApi(page, request, buildTestEmail(testInfo, 'txt338'), 'TXT 338');
    let received = '';
    await page.route('**/api/import/analyze-text', async (route) => { received = route.request().postDataJSON().text; await route.fulfill({ json: { ...analysis, rows: [rows[0]], review: [analysis.review![0]] } }); });
    const dialog = await openImport(page, phone);
    await dialog.getByRole('button', { name: 'Subir .txt' }).click();
    await dialog.locator('input[type=file]').setInputFiles({ name: 'whatsapp.txt', mimeType: 'text/plain', buffer: Buffer.from(listing, 'utf8') });
    await expect(dialog.getByTestId('import-preview')).toBeVisible();
    expect(received).toBe(listing);
    await expect(dialog.getByTestId('import-preview')).toContainText('USD');
    await dialog.getByTestId('import-edit-row-0').click();
    await dialog.getByRole('button', { name: 'Excluir fila' }).click();
    await expect(dialog.getByTestId('import-confirm')).toBeDisabled();
    await dialog.getByRole('button', { name: 'Restaurar filas' }).click();
    await expect(dialog.getByTestId('import-confirm')).toBeEnabled();
    await dialog.getByTestId('import-confirm').click();
    await expect(dialog.getByText('1 creados', { exact: false })).toBeVisible();
  });

  test('texto inválido y error del LLM muestran mensajes y no crean equipos', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'invalid338');
    await bootstrapStoreViaApi(page, request, email, 'Errores 338');
    let attempts = 0;
    await page.route('**/api/import/analyze-text', async (route) => {
      attempts++;
      if (attempts === 1) await route.fulfill({ json: { ...analysis, rows: [], review: [], notice: 'Este texto no parece tener equipos para importar' } });
      else await route.fulfill({ status: 422, json: { error: 'El análisis devolvió datos inválidos después de dos intentos. Revisá el texto y probá de nuevo.' } });
    });
    const dialog = await openImport(page, phone);
    await dialog.getByRole('button', { name: 'Pegar listado' }).click();
    await dialog.getByRole('textbox', { name: 'Listado de equipos' }).fill('Che, traé pan mañana');
    await dialog.getByRole('button', { name: 'Analizar listado' }).click();
    await expect(dialog.getByTestId('import-unrelated')).toContainText('Este texto no parece tener equipos para importar');
    await expect(dialog.getByTestId('import-confirm')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Volver' }).click();
    await dialog.getByRole('textbox', { name: 'Listado de equipos' }).fill('iPhone 13 USD420');
    await dialog.getByRole('button', { name: 'Analizar listado' }).click();
    await expect(dialog.getByText(/dos intentos/)).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Listado de equipos' })).toHaveValue('iPhone 13 USD420');
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
  });
}
