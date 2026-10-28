import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { prepareImportSheets } from './import-limits';
import { parseWorkbook } from './parse-workbook';

it('quita padding final y hojas vacías antes de contar y recorta celdas a 2000', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Stock');
  sheet.addRow(['Modelo', 'Notas']);
  sheet.addRow(['iPhone 13', 'a'.repeat(2500)]);
  sheet.getCell('AZ90').value = '';
  book.addWorksheet('Vacía').getCell('ZZ100').value = '';
  const parsed = await parseWorkbook(new File([await book.xlsx.writeBuffer()], 'stock.xlsx'));
  expect(parsed.sheetNames).toEqual(['Stock']);
  expect(parsed.getSheet('Stock')).toEqual([['Modelo', 'Notas'], ['iPhone 13', 'a'.repeat(2000)]]);
});
it('informa límites físicos en español después de limpiar vacíos', () => {
  expect(() => prepareImportSheets([{ name: 'Stock', rows: Array.from({ length: 5001 }, () => ['iPhone 13']) }]))
    .toThrow('El archivo tiene más de 5000 filas en la hoja Stock. Dividilo en partes.');
  expect(() => prepareImportSheets([{ name: 'Stock', rows: [Array(41).fill('dato')] }])).toThrow('más de 40 columnas');
  expect(() => prepareImportSheets(Array.from({ length: 13 }, (_, i) => ({ name: `Hoja ${i}`, rows: [['dato']] })))).toThrow('más de 12 hojas');
  expect(() => prepareImportSheets([{ name: 'Vacía', rows: [['']] }])).toThrow('no tiene datos');
});
