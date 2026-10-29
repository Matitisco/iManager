import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { parseWorkbook } from './parse-workbook';

it('reads every nonempty row and unnamed sale column from an invented Excel without swallowing totals or duplicates', async () => {
  const book = new ExcelJS.Workbook();
  const data = [
    ['Fecha', 'Cliente', 'Precio', 'Notas', ''],
    ['10/01/2024', 'Cliente ficticio', '500000', 'Conservar nota', 'Extra sin título'],
    ['10/01/2024', 'Cliente ficticio', '500000', 'Conservar nota', 'Extra sin título'],
    [],
    ['TOTAL', '', { formula: 'SUM(C2:C3)', result: 1000000 }],
    ['', '', '', 'Nota suelta'],
  ];
  book.addWorksheet('Ventas ficticias').addRows(data);
  const buffer = await book.xlsx.writeBuffer();
  const file = new File([], 'ventas-inventadas.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array(buffer).buffer });
  const parsed = await parseWorkbook(file);
  expect(parsed.sheetNames).toEqual(['Ventas ficticias']);
  const rows = parsed.getSheet('Ventas ficticias');
  expect(rows).toHaveLength(6);
  expect(rows[1]).toEqual(rows[2]);
  expect(rows[1][4]).toBe('Extra sin título');
  expect(rows[4][2]).toBe('1000000');
  expect(rows[5][3]).toBe('Nota suelta');
});
