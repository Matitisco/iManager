export type ColumnMapping = {
  header: string;
  field: string;
};

export function fieldToColumn(mapping: ColumnMapping[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const column of mapping) {
    if (column.field && !map[column.field]) map[column.field] = column.header;
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

export function mappingFromFields(headers: string[], fields: Record<string, string>): ColumnMapping[] {
  const byHeader = new Map<string, string>();
  for (const [field, header] of Object.entries(fields)) {
    if (!header || byHeader.has(header)) continue;
    byHeader.set(header, field);
  }
  return headers.filter((header) => header.trim()).map((header) => ({
    header,
    field: byHeader.get(header) ?? '',
  }));
}
