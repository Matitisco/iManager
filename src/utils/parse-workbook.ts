import ExcelJS from 'exceljs';

export interface ParsedWorkbook {
  sheetNames: string[];
  getSheet: (name: string) => string[][];
}

function normalizeRows(rows: Array<Array<unknown>>): string[][] {
  return rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
}

async function parseCsv(file: File): Promise<ParsedWorkbook> {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.replace(/^\"|\"$/g, '').trim()));

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
    const rows = normalizeRows(
      worksheet.getSheetValues().slice(1).map((row) => Array.isArray(row) ? row.slice(1) : [])
    );
    sheetMap.set(worksheet.name, rows);
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
