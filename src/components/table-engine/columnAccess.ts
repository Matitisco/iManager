import type { ColDef, WithId } from './types';

export function getColumnValue<TRow extends WithId>(row: TRow, colDef: ColDef<TRow>) {
  if (colDef.getValue) {
    return colDef.getValue(row);
  }

  return (row as any)[colDef.field];
}

export function applyColumnValue<TRow extends WithId>(
  row: TRow,
  colDef: ColDef<TRow>,
  value: unknown
): TRow {
  if (colDef.setValue) {
    return colDef.setValue(row, value);
  }

  return { ...row, [colDef.field]: value };
}
