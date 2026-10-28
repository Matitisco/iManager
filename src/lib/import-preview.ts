import type { ImportSheetPlan } from '../services/import-api';

export function columnLetter(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
export function importColumns(active: ImportSheetPlan, rows: string[][]) {
  const width = Math.max(0, ...rows.map(row => row.length));
  return Array.from({ length: width }, (_, columnIndex) => {
    const header = active.headerRow === 0 ? columnLetter(columnIndex) : rows[active.headerRow - 1]?.[columnIndex] || columnLetter(columnIndex);
    const column = active.mapping.find(item => item.columnIndex === columnIndex)
      ?? active.mapping.find(item => item.columnIndex === undefined && item.header === header);
    return { header, columnIndex, field: column?.field || 'ignore' };
  });
}

export function columnHasData(active: ImportSheetPlan, rows: string[][], index: number) {
  return rows.slice(Math.max(active.headerRow, active.dataStartRow - 1), active.dataEndRow)
    .some(row => Boolean(row[index]?.trim()));
}


/** The pinned model stays first. Layout never modifies the import mapping. */
export function reorderPreviewColumns(order: string[], key: string, target: number): string[] {
  const from = order.indexOf(key);
  if (from < 0 || key === 'model' || !Number.isFinite(target)) return order;
  const next = order.filter(item => item !== key);
  const minimum = next[0] === 'model' ? 1 : 0;
  next.splice(Math.max(minimum, Math.min(next.length, Math.trunc(target))), 0, key);
  return next;
}

export function resizePreviewColumn(width: number, delta: number): number {
  return Number.isFinite(width + delta) ? Math.max(100, Math.min(480, Math.round(width + delta))) : width;
}

export function assignImportColumn(active: ImportSheetPlan, rows: string[][], index: number, field: string): ImportSheetPlan {
  return { ...active, mapping: importColumns(active, rows).map(column => ({ ...column,
    field: column.columnIndex === index ? field : field !== 'ignore' && column.field === field ? 'ignore' : column.field,
  })) };
}
