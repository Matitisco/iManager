import type ExcelJS from 'exceljs';

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

export function trimRows(rows: string[][]): string[][] {
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

export function readWorksheet(worksheet: ExcelJS.Worksheet): string[][] {
  // Iterate stored cells, never the rectangular rowCount × columnCount area:
  // an empty styled cell at XFD1048576 must not allocate billions of cells.
  const present = new Map<number, Map<number, string>>();
  let height = 0;
  let width = 0;
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, col) => {
      const value = cell.isMerged && cell.master.address !== cell.address
        ? (cell.master.col === cell.col ? cellText(cell.master.value, cell.master) : '')
        : cellText(cell.value, cell);
      if (!value.trim()) return;
      if (rowNumber > 5000) throw new Error(`El archivo tiene más de 5000 filas en la hoja ${worksheet.name}. Dividilo en partes.`);
      if (col > 40) throw new Error(`La hoja ${worksheet.name} tiene más de 40 columnas con datos. Quitá las que no necesitás.`);
      const line = present.get(rowNumber) ?? new Map<number, string>();
      line.set(col, value);
      present.set(rowNumber, line);
      height = Math.max(height, rowNumber);
      width = Math.max(width, col);
    });
  });
  return Array.from({ length: height }, (_, index) =>
    Array.from({ length: width }, (_, col) => present.get(index + 1)?.get(col + 1)?.trim() ?? ''));
}
