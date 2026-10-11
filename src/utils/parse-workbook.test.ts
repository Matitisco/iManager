import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWorkbook } from './parse-workbook';

const workbookPath = path.resolve('e2e/fixtures/ejemplo-stock.xlsx');

describe('parseWorkbook ejemplo-stock', () => {
  it('reads rich text, formulas and merged titles without [object Object]', async () => {
    const bytes = readFileSync(workbookPath);
    const file = new File([bytes], 'ejemplo-stock.xlsx');
    const workbook = await parseWorkbook(file);

    expect(workbook.sheetNames).toEqual(['iPhones Usados', 'iPhones Nuevos', 'OUTLET']);
    const usados = workbook.getSheet('iPhones Usados');
    const flat = workbook.sheetNames.flatMap((name) => workbook.getSheet(name).flat());
    expect(flat.some((cell) => cell.includes('object Object'))).toBe(false);
    expect(flat.some((cell) => cell.includes('REGALO') || cell.includes('CABLE'))).toBe(true);
    expect(usados[4]).toEqual(['Modelo', 'Batería', 'Color', 'PRECIO USD', 'PRECIO ARS']);
    expect(usados[5]?.[0]).toBe('12 64 GB');
    expect(usados[6]?.[0]).toBe('13 mini 128 GB');
    expect(usados[6]?.[1]).toBe('0.96');
    expect(usados[6]?.[4]).toBe('477400');
    expect(usados.some((row) => row.some((cell) => cell.includes('$')))).toBe(true);
    expect(usados[2]?.some((cell) => cell === '1540')).toBe(true);
    expect(workbook.getSheet('iPhones Nuevos').some((row) => row[0] === 'IPADS')).toBe(true);
    expect(workbook.getSheet('OUTLET')[5]).toEqual(['Modelo', 'Batería', 'Color', 'PRECIO USD', 'PRECIO ARS']);
  });
});
