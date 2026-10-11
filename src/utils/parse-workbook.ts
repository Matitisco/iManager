import ExcelJS from 'exceljs';

export interface ParsedWorkbook {
  sheetNames: string[];
  getSheet: (name: string) => string[][];
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1e6) / 1e6);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('').trim();
    }
    if ('result' in value) return cellToText(value.result as ExcelJS.CellValue);
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('error' in value) return '';
  }
  return '';
}

function mergedHidden(worksheet: ExcelJS.Worksheet): Set<string> {
  const hidden = new Set<string>();
  const merges = worksheet.model?.merges ?? [];
  for (const ref of merges) {
    const [start, end] = ref.split(':');
    if (!start || !end) continue;
    const from = decodeCell(start);
    const to = decodeCell(end);
    if (!from || !to) continue;
    for (let row = from.row; row <= to.row; row += 1) {
      for (let column = from.column; column <= to.column; column += 1) {
        if (row === from.row && column === from.column) continue;
        hidden.add(`${row}:${column}`);
      }
    }
  }
  return hidden;
}

function decodeCell(ref: string): { row: number; column: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  let column = 0;
  for (const char of (match[1] ?? '').toUpperCase()) column = column * 26 + (char.charCodeAt(0) - 64);
  return { column, row: Number(match[2]) };
}

export function trimGrid(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && (rows[end - 1] ?? []).every((cell) => !cell.trim())) end -= 1;
  return rows.slice(0, end).map((row) => {
    const cells = row.map((cell) => cell.trim());
    let last = cells.length;
    while (last > 0 && !cells[last - 1]) last -= 1;
    return cells.slice(0, last);
  });
}

function readWorksheet(worksheet: ExcelJS.Worksheet): string[][] {
  const hidden = mergedHidden(worksheet);
  const lastRow = worksheet.rowCount;
  const lastColumn = Math.min(Math.max(worksheet.columnCount, 1), 20);
  const rows: string[][] = [];
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells: string[] = [];
    for (let column = 1; column <= lastColumn; column += 1) {
      cells.push(hidden.has(`${rowNumber}:${column}`) ? '' : cellToText(row.getCell(column).value));
    }
    rows.push(cells);
  }
  return trimGrid(rows);
}

async function parseCsv(file: File): Promise<ParsedWorkbook> {
  const text = await file.text();
  const rows = trimGrid(text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim())));

  return {
    sheetNames: ['Hoja 1'],
    getSheet: () => rows,
  };
}

async function parseXlsx(file: File): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const sheetMap = new Map<string, string[][]>();
  workbook.worksheets.forEach((worksheet) => {
    sheetMap.set(worksheet.name, readWorksheet(worksheet));
  });

  return {
    sheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    getSheet: (name: string) => sheetMap.get(name) ?? [],
  };
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  }

  if (ext === 'xlsx') {
    return parseXlsx(file);
  }

  if (ext === 'xls') {
    throw new Error('El formato .xls ya no es compatible. Exportá el archivo a .xlsx o .csv.');
  }

  throw new Error('Formato no soportado. Usá .csv o .xlsx.');
}
