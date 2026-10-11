import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeImport } from '../../backend/src/modules/import/analyze-import.service';
import { cellText, parseWorkbook } from './parse-workbook';

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
