import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { readWorksheet } from './workbook-grid.js';
import { prepareImportSheets } from './import-limits.js';

it('the shared workbook reader produces the committed synthetic Natan grid exactly', async () => {
  const dir = new URL('../../../test/fixtures/import/natan/', import.meta.url);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(new URL('00_natan_anon.xlsx', dir)) as unknown as ExcelJS.Buffer);
  const sheets = prepareImportSheets(workbook.worksheets.map(sheet => ({ name: sheet.name, rows: readWorksheet(sheet) })));
  expect(sheets).toEqual(JSON.parse(readFileSync(new URL('00_natan_anon.grid.json', dir), 'utf8')));
});

it('does not visit or create the empty rectangular padding of a sparse sheet', () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock');
  sheet.getCell('A1').value = 'Modelo';
  sheet.getCell('AZ90').value = '';
  const original = sheet.getRow(90).getCell;
  let reads = 0;
  sheet.getRow(90).getCell = function (...args: Parameters<typeof original>) { reads++; return original.apply(this, args); };
  expect(readWorksheet(sheet)).toEqual([['Modelo']]);
  expect(reads).toBe(0);
});

it('rejects out-of-contract data coordinates before materializing a large grid', () => {
  for (const address of ['A5001', 'AO1']) {
    const sheet = new ExcelJS.Workbook().addWorksheet('Stock');
    sheet.getCell(address).value = 'dato';
    expect(() => readWorksheet(sheet)).toThrow(/5000 filas|40 columnas/);
  }
});
