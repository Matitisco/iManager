import ExcelJS from 'exceljs';
import { prepareImportSheets } from './import-limits';

export interface ParsedWorkbook {
  sheetNames: string[];
  getSheet: (name: string) => string[][];
}

export function cellText(value: unknown, cell?: Pick<ExcelJS.Cell, 'text' | 'numFmt'>): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    // ExcelJS text preserves the stored digits, unlike formatting the float to
    // the displayed (often abbreviated) scientific precision.
    const text = cell?.text || String(value);
    if (value >= 1e14 && /e[+-]0+/i.test(cell?.numFmt ?? '') && /0{5,}$/.test(text)) {
      // Retain evidence of an abbreviated scientific identifier for validation;
      // never turn its padded zeroes into an apparently complete IMEI.
      return value.toExponential();
    }
    return text;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text ?? '');
        return '';
      }).join('').replace(/\s+/g, ' ').trim();
    }
    if (typeof record.error === 'string') return record.error;
    if (typeof record.text === 'string') return cellText(record.text);
    if ('result' in record && record.result != null && record.result !== '') return cellText(record.result, cell);
    if (typeof record.formula === 'string' && record.formula.trim()) {
      const formula = record.formula.trim();
      return formula.startsWith('=') ? formula : `=${formula}`;
    }
    return '';
  }
  return '';
}

function trimRows(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && rows[end - 1].every((cell) => !cell.trim())) end -= 1;
  const sliced = rows.slice(0, end);
  let cols = 0;
  for (const row of sliced) {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index]?.trim()) {
        cols = Math.max(cols, index + 1);
        break;
      }
    }
  }
  return sliced.map((row) => row.slice(0, cols).map((cell) => cell.trim()));
}

function readWorksheet(worksheet: ExcelJS.Worksheet): string[][] {
  const colCount = Math.max(worksheet.columnCount, 1);
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const line: string[] = [];
    for (let col = 1; col <= colCount; col += 1) {
      const cell = row.getCell(col);
      if (cell.isMerged && cell.master.address !== cell.address) {
        // Fill down vertical data ranges, without repeating horizontal titles
        // across every column (which would change header detection).
        line.push(cell.master.col === cell.col ? cellText(cell.master.value, cell.master) : '');
        continue;
      }
      line.push(cellText(cell.value, cell));
    }
    rows.push(line);
  });
  return trimRows(rows);
}

async function parseCsv(file: File): Promise<ParsedWorkbook> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  // Excel in Argentina commonly exports semicolons; commas inside quoted
  // amounts/names must never participate in delimiter detection.
  const counts = new Map([[',', 0], [';', 0], ['\t', 0]]);
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { index += 1; continue; }
      quoted = !quoted;
    } else if (!quoted) {
      if (char === '\r' || char === '\n') break;
      if (counts.has(char)) counts.set(char, counts.get(char)! + 1);
    }
  }
  const delimiter = [...counts].sort((left, right) => right[1] - left[1])[0][0];
  const parsed: string[][] = [];
  let row: string[] = [];
  let cell = '';
  quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && (quoted || !cell.trim())) {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\r' || char === '\n')) {
      row.push(cell.trim());
      cell = '';
      if (char !== delimiter) {
        parsed.push(row);
        row = [];
        if (char === '\r' && text[index + 1] === '\n') index += 1;
      }
    } else cell += char;
  }
  if (quoted) throw new Error('El CSV tiene comillas sin cerrar. Revisá el archivo y volvé a subirlo.');
  row.push(cell.trim());
  parsed.push(row);
  const rows = trimRows(parsed);

  return {
    sheetNames: ['Hoja 1'],
    getSheet: () => rows,
  };
}

async function parseXlsx(file: File): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
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
  if (ext === 'csv' || ext === 'xlsx') {
    const workbook = await (ext === 'csv' ? parseCsv(file) : parseXlsx(file));
    // Parse first: the screen keeps its total-file limit, and the HTTP service
    // enforces the API's per-sheet row limit with a sheet-specific message.
    const sheets = prepareImportSheets(workbook.sheetNames.map(name => ({ name, rows: workbook.getSheet(name) })), { checkRowLimit: false });
    return { sheetNames: sheets.map(sheet => sheet.name), getSheet: name => sheets.find(sheet => sheet.name === name)?.rows ?? [] };
  }
  if (ext === 'xls') throw new Error('El formato .xls ya no es compatible. Exportá el archivo a .xlsx o .csv.');
  throw new Error('Formato no soportado. Usá .csv o .xlsx.');
}
