import ExcelJS from 'exceljs';

export interface ParsedWorkbook {
  sheetNames: string[];
  getSheet: (name: string) => string[][];
}

export function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
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
    if (typeof record.text === 'string') return cellText(record.text);
    if ('result' in record && record.result != null && record.result !== '') return cellText(record.result);
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
        line.push('');
        continue;
      }
      line.push(cellText(cell.value));
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
  if (ext === 'csv') return parseCsv(file);
  if (ext === 'xlsx') return parseXlsx(file);
  if (ext === 'xls') throw new Error('El formato .xls ya no es compatible. Exportá el archivo a .xlsx o .csv.');
  throw new Error('Formato no soportado. Usá .csv o .xlsx.');
}
