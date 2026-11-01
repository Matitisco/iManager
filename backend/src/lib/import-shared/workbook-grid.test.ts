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
