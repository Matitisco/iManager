import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { analyzeImport } from '../../backend/src/modules/import/analyze-import.service';
import { DECISIONS_URL } from '../../backend/src/modules/import/responses-client';
import { cellText, parseWorkbook } from './parse-workbook';
import { syntheticStockRows as fixtureStockRows } from '../../backend/test/fixtures/headerless-stock';

describe('cellText', () => {
  it('reads rich text, formula results and numbers without turning them into objects', () => {
    expect(cellText({ richText: [{ text: 'TU COMPRA ' }, { text: 'INCLUYE' }] })).toBe('TU COMPRA INCLUYE');
    expect(cellText({ formula: 'D7*E3', result: 477400 })).toBe('477400');
    expect(cellText({ result: 1617000, sharedFormula: 'D7' })).toBe('1617000');
    expect(cellText(0.96)).toBe('0.96');
    expect(cellText(1)).toBe('1');
    expect(cellText({ formula: 'D7*E3' })).toBe('=D7*E3');
    expect(JSON.stringify(cellText({ richText: [{ text: 'hola' }] }))).not.toContain('object Object');
  });
});

describe('CSV argentino', () => {
  it.each([',', ';', '\t'])('preserves quoted cells with delimiter %j', async (delimiter) => {
    const content = '\uFEFF' + [
      ['Nombre', 'Precio', 'Nota', 'IMEI'].join(delimiter),
      ['"Pérez, José"', '"1.250,50"', '"Dijo ""hola""\ny volvió"', '990000000000018'].join(delimiter),
      ['', '', '', ''].join(delimiter),
      ['Lucía', '420.50', '', '990000000000026'].join(delimiter),
    ].join('\r\n');
    const workbook = await parseWorkbook(new File([content], 'clientes.csv'));
    expect(workbook.getSheet('Hoja 1')).toEqual([
      ['Nombre', 'Precio', 'Nota', 'IMEI'],
      ['Pérez, José', '1.250,50', 'Dijo "hola"\ny volvió', '990000000000018'],
      ['', '', '', ''],
      ['Lucía', '420.50', '', '990000000000026'],
    ]);
  });

  it('reports unmatched quotes instead of shifting columns', async () => {
    await expect(parseWorkbook(new File(['Modelo,Precio\niPhone 13,"420,50'], 'stock.csv')))
      .rejects.toThrow('comillas sin cerrar');
  });
});

describe('ejemplo-stock.xlsx', () => {
  it('reads every sheet, the header and the values without [object Object]', async () => {
    const bytes = readFileSync(path.resolve('e2e/fixtures/ejemplo-stock.xlsx'));
    const file = new File([bytes], 'ejemplo-stock.xlsx');
    const workbook = await parseWorkbook(file);

    expect(workbook.sheetNames).toEqual(['iPhones Usados', 'iPhones Nuevos', 'OUTLET']);
    for (const name of workbook.sheetNames) {
      const rows = workbook.getSheet(name);
      expect(JSON.stringify(rows)).not.toContain('[object Object]');
      expect(rows.length).toBeGreaterThan(5);
      expect(rows.length).toBeLessThan(40);
    }

    const used = workbook.getSheet('iPhones Usados');
    expect(used[0]?.[0]).toContain('STOCK DE EQUIPOS USADOS');
    expect(used[0]?.[1]).toBe('');
    expect(used[1]?.[0]).toContain('TU COMPRA INCLUYE');
    expect(used[4]).toEqual(['Modelo', 'Batería', 'Color', 'PRECIO USD', 'PRECIO ARS', '']);
    expect(used[5]?.[0]).toBe('12 64 GB');
    expect(used[5]?.[1]).toBe('1');
    expect(used[6]?.[1]).toBe('0.96');
    expect(used[6]?.[4]).toBe('477400');
    expect(used[9]?.[1]).toBe('83% - 84%');
    expect(used.some((row) => row[4] === '1540')).toBe(true);

    const fresh = workbook.getSheet('iPhones Nuevos');
    expect(fresh.some((row) => row[0] === 'Modelo' && row[1] === 'Color' && row[2] === 'PRECIO USD')).toBe(true);
    expect(fresh.some((row) => row[0] === 'AirPods Pro 3')).toBe(true);

    const outlet = workbook.getSheet('OUTLET');
    expect(outlet.some((row) => row[0] === 'Modelo' && row[1] === 'Batería')).toBe(true);
    expect(outlet.some((row) => row[0] === '13 Pro Max 128 GB' && row[1] === '0.84')).toBe(true);

    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const sheets = workbook.sheetNames.map((name) => ({ name, rows: workbook.getSheet(name) }));
      const result = await analyzeImport({ section: 'inventory', currency: 'ARS', sheets });
      expect(result.summary.sheets.map((sheet) => [sheet.name, sheet.rows, sheet.condition])).toEqual([
        ['iPhones Usados', 20, 'USADO'],
        ['iPhones Nuevos', 10, 'NUEVO'],
        ['OUTLET', 7, 'USADO'],
      ]);
      expect(result.rows).toHaveLength(37);
      expect(JSON.stringify(result.rows)).not.toContain('[object Object]');
      expect(result.rows[0]).toMatchObject({ model: '12', capacity: '64 GB', batteryHealth: '100%', price: '431200' });
      expect(result.rows.find((row) => row.model === 'AirPods Pro 3')).toMatchObject({ condition: 'NUEVO', price: '446600' });
      expect(result.rows.find((row) => row.model === 'Adaptador 20 W')?.capacity ?? '').toBe('');
      expect(result.plan[0]?.headerRow).toBe(5);
      expect(result.plan[0]?.mapping.find((column) => column.field === 'price')?.header).toBe('PRECIO ARS');
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});


it.each(['heuristic', 'model'] as const)('imports 60 synthetic headerless XLSX rows through the real parser (%s)', async source => {
  const { syntheticStockRows, mistakenStockPlan, stockModelResponse } = await import('../../backend/test/fixtures/headerless-stock');
  const { applyImportPlan } = await import('../../backend/src/modules/import/analyze-import.service');
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  if (source === 'model') process.env.OPENAI_API_KEY = 'sk-test';
  try {
    const bytes = await syntheticStockXlsx();
    const workbook = await parseWorkbook(new File([bytes as Uint8Array<ArrayBuffer>], 'stock-sintetico.xlsx'));
    expect(workbook.sheetNames).toEqual(['stock de equipos']);
    const grid = workbook.getSheet('stock de equipos');
    expect(grid).toHaveLength(60);
    expect(grid[0]).toHaveLength(16);
    expect(grid[0].slice(11)).toEqual(['', '', '', '', '']);
    expect(grid[1][11]).toBe('=IFERROR(A2+1,"")');
    expect(grid[1][0]).toMatch(/^2026-10-/);
    expect(grid[0][4]).toBe('0.8');
    expect(grid[0][5]).toBe('990000000000000');
    const input = { section: 'inventory' as const, currency: 'USD' as const, sheets: [{ name: workbook.sheetNames[0], rows: grid }] };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url) === DECISIONS_URL
      ? new Response('', { status: 404 }) : stockModelResponse(mistakenStockPlan(grid)));
    const analysis = await analyzeImport(input, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(source === 'model' ? 2 : 0);
    expect(analysis.source).toBe(source);
    expect(analysis.plan[0]).toMatchObject({ include: true, headerRow: 0, dataStartRow: 1 });
    expect(analysis.plan[0].mapping).toHaveLength(16);
    expect(analysis.rows).toHaveLength(60);
    expect(analysis.rows[0]).toMatchObject({ model: 'iPhone 13', imei: '990000000000000', cost: '300', batteryHealth: '80%', status: 'DISPONIBLE' });
    expect(analysis.rows[2]).toMatchObject({ status: 'EN_REVISION', originalStatus: 'SIN SERVICIO' });
    expect(analysis.rows[7].batteryHealth).toBe('');
    expect(analysis.diagnostics?.warnings).toEqual([{ row: 8, message: expect.stringContaining('sin batería') }]);
    expect(analysis.rows.every(row => !row.price)).toBe(true);
    expect(analysis.rows[9].cost).toBe('');
    expect(analysis.rows[1]).toMatchObject({ entryDate: grid[1][0], batteryNote: 'BATERIA' });
    expect(analysis.rows[1]).not.toHaveProperty('purchasedAt');
    expect(analysis.diagnostics).toMatchObject({ detectedRows: 60, acceptedRows: 60, discardedRows: 0, discardedByReason: {}, missingRecommendedFields: ['price'] });
    expect(applyImportPlan({ ...input, plan: analysis.plan }).rows).toEqual(analysis.rows);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

async function syntheticStockXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('stock de equipos');
  fixtureStockRows().forEach((values, index) => {
    const row = sheet.addRow(values);
    if (index % 4 !== 0) {
      // Numeric Excel dates, formatted as dates, rather than strings in the XLSX.
      row.getCell(1).value = 46311 + index;
      row.getCell(1).numFmt = 'dd/mm/yyyy';
    }
    if (index !== 7) row.getCell(5).value = Number(values[4]);
    row.getCell(5).numFmt = '0%';
    row.getCell(6).value = Number(values[5]);
    row.getCell(6).numFmt = '0';
    if (index !== 9) row.getCell(9).value = Number(values[8]);
    if (index) {
      row.getCell(12).value = { formula: `IFERROR(A${index + 1}+1,"")` };
      row.getCell(16).value = Number(values[15]);
    }
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
