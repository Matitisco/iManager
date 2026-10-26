export type ColumnMapping = {
  header: string;
  columnIndex?: number;
  field: string;
};

export function fieldToColumn(mapping: ColumnMapping[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const column of mapping) {
    if (column.field && !map[column.field]) map[column.field] = columnKey(column);
  }
  return map;
}

export function assignColumn(
  fieldToColumnMap: Record<string, string>,
  fieldKey: string,
  column: string,
): Record<string, string> {
  const next = { ...fieldToColumnMap, [fieldKey]: column };
  if (!column) return next;
  for (const key of Object.keys(next)) {
    if (key !== fieldKey && next[key] === column) next[key] = '';
  }
  return next;
}

export function columnKey(column: ColumnMapping): string {
  return column.columnIndex == null ? column.header : `column:${column.columnIndex}`;
}

export function mappingFromFields(columns: string[] | ColumnMapping[], fields: Record<string, string>): ColumnMapping[] {
  const byColumn = new Map<string, string>();
  for (const [field, key] of Object.entries(fields)) {
    if (!key || byColumn.has(key)) continue;
    byColumn.set(key, field);
  }
  return columns.flatMap(value => {
    const column = typeof value === 'string' ? { header: value, field: '' } : value;
    if (column.columnIndex == null && !column.header.trim()) return [];
    return [{ ...column, field: byColumn.get(columnKey(column)) ?? '' }];
  });
}

export function planColumns(rows: string[][], plan: { headerRow: number; mapping: ColumnMapping[] }): ColumnMapping[] {
  const width = Math.max(0, ...rows.map(row => row.length));
  const indexed = plan.headerRow === 0 || plan.mapping.some(column => column.columnIndex != null);
  return Array.from({ length: width }, (_, columnIndex) => {
    let header = rows[plan.headerRow - 1]?.[columnIndex] ?? '';
    if (plan.headerRow === 0) {
      let n = columnIndex + 1;
      while (n > 0) { header = String.fromCharCode(65 + (n - 1) % 26) + header; n = Math.floor((n - 1) / 26); }
    }
    return { header, ...(indexed ? { columnIndex } : {}), field: '' };
  });
}

export function updatePlanMapping<T extends { include: boolean; mapping: ColumnMapping[] }>(
  plan: T, mapping: ColumnMapping[], required: string[],
): T {
  const missingBefore = required.some(field => !plan.mapping.some(column => column.field === field));
  const complete = required.every(field => mapping.some(column => column.field === field));
  return { ...plan, mapping, include: plan.include || (missingBefore && complete) };
}
