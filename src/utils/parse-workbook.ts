import ExcelJS from 'exceljs';
import { assertImportFileSize, safeXlsxBytes } from '../../backend/src/lib/import-shared/safe-xlsx';
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
  const cellParts: string[] = [];
  const cellChars: string[] = [];
  let cellHasText = false;
  const appendCell = (char: string) => {
    cellChars.push(char);
    if (/\S/.test(char)) cellHasText = true;
    if (cellChars.length === 4096) { cellParts.push(cellChars.join('')); cellChars.length = 0; }
  };
  let column = 0;
  let rowNumber = 1;
  const finishCell = () => {
    const value = [...cellParts, cellChars.join('')].join('').trim();
    if (value && column >= 40) throw new Error('La hoja Hoja 1 tiene más de 40 columnas con datos. Quitá las que no necesitás.');
    // Empty right padding must not allocate an unbounded array of cells.
    if (column < 40) row.push(value);
    column++;
    cellParts.length = 0;
    cellChars.length = 0;
    cellHasText = false;
  };
  const finishRow = () => {
    if (rowNumber > 5000) {
      if (row.some(Boolean)) throw new Error('El archivo supera las 5000 filas.');
    } else parsed.push(row);
    row = [];
    column = 0;
    rowNumber++;
  };
  quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && (quoted || !cellHasText)) {
      if (quoted && text[index + 1] === '"') { appendCell('"'); index += 1; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\r' || char === '\n')) {
      finishCell();
      if (char !== delimiter) {
        finishRow();
        if (char === '\r' && text[index + 1] === '\n') index += 1;
      }
    } else appendCell(char);
  }
  if (quoted) throw new Error('El CSV tiene comillas sin cerrar. Revisá el archivo y volvé a subirlo.');
  finishCell();
  finishRow();
  const rows = trimRows(parsed);

  return {
    sheetNames: ['Hoja 1'],
    getSheet: () => rows,
  };
}

async function parseXlsx(file: File): Promise<ParsedWorkbook> {
  const bytes = safeXlsxBytes(new Uint8Array(await file.arrayBuffer()));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
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
  assertImportFileSize(file.size);
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'xlsx') {
    const workbook = await (ext === 'csv' ? parseCsv(file) : parseXlsx(file));
    // Per-sheet bounds are enforced during parsing; the screen also checks
    // the combined row count across all included sheets.
    const sheets = prepareImportSheets(workbook.sheetNames.map(name => ({ name, rows: workbook.getSheet(name) })), { checkRowLimit: false });
    return { sheetNames: sheets.map(sheet => sheet.name), getSheet: name => sheets.find(sheet => sheet.name === name)?.rows ?? [] };
  }
  if (ext === 'xls') throw new Error('El formato .xls ya no es compatible. Exportá el archivo a .xlsx o .csv.');
  throw new Error('Formato no soportado. Usá .csv o .xlsx.');
}
