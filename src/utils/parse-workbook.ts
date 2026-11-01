import ExcelJS from 'exceljs';
import { prepareImportSheets } from './import-limits';
import { readWorksheet, trimRows } from '../../backend/src/lib/import-shared/workbook-grid';
export { cellText } from '../../backend/src/lib/import-shared/workbook-grid';

export interface ParsedWorkbook {
  sheetNames: string[];
  getSheet: (name: string) => string[][];
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
