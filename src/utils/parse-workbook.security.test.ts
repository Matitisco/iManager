import ExcelJS from 'exceljs';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { parseWorkbook } from './parse-workbook';

async function xlsx(extra: Record<string, Uint8Array> = {}) {
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Stock').addRow(['Modelo']);
  return zipSync({ ...unzipSync(new Uint8Array(await book.xlsx.writeBuffer())), ...extra });
}

describe('spreadsheet resource boundaries', () => {
  it('rejects oversized files before reading their bytes', async () => {
    const file = new File(['Modelo\niPhone'], 'stock.csv');
    Object.defineProperty(file, 'size', { value: 12 * 1024 * 1024 + 1 });
    const read = vi.spyOn(file, 'text');
    await expect(parseWorkbook(file)).rejects.toThrow('12 MB');
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects real ZIP expansion even when the compressed workbook is tiny', async () => {
    const bytes = await xlsx({ 'unused.bin': new Uint8Array(32 * 1024 * 1024 + 1) });
    expect(bytes.length).toBeLessThan(100_000);
    await expect(parseWorkbook(new File([bytes], 'stock.xlsx'))).rejects.toThrow('límites');
  });

  it('rejects excessive merged-cell expansion before ExcelJS loads it', async () => {
    const bytes = await xlsx({ 'xl/worksheets/sheet1.xml': strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Modelo</t></is></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:XFD1048576"/></mergeCells></worksheet>') });
    // Never execute the dangerous expansion, even when reproducing on the old code.
    const load = vi.spyOn(ExcelJS.Workbook.prototype, 'xlsx', 'get').mockImplementation(() => ({ load: vi.fn().mockRejectedValue(new Error('unsafe parser reached')) }) as unknown as ExcelJS.Xlsx);
    try {
      await expect(parseWorkbook(new File([bytes], 'stock.xlsx'))).rejects.toThrow('límites');
      expect(load).not.toHaveBeenCalled();
    } finally { load.mockRestore(); }
  });
});

it('rejects CSV data outside grid limits while ignoring empty trailing padding', async () => {
  await expect(parseWorkbook(new File([`${','.repeat(40)}dato`], 'stock.csv'))).rejects.toThrow('40 columnas');
  await expect(parseWorkbook(new File([`${'\n'.repeat(5000)}dato`], 'stock.csv'))).rejects.toThrow('5000 filas');
  const parsed = await parseWorkbook(new File([`Modelo${','.repeat(100_000)}\n${'\n'.repeat(10_000)}`], 'stock.csv'));
  expect(parsed.getSheet('Hoja 1')).toEqual([['Modelo']]);
});
