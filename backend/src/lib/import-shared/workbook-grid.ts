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

