import { groupInventoryPreviewRows } from '../../backend/src/modules/inventory/import-grouping';
import { parseImportNumber } from './import-number';

export function textRowError(row: Record<string, string>): string | null {
  if (!row.model?.trim() || row.model.trim().length > 120) return 'Revisá el modelo.';
  if (row.price?.trim() && (parseImportNumber(row.price) === undefined || parseImportNumber(row.price)! < 0)) return 'Completá un precio válido o dejalo a definir.';
  if (row.cost?.trim() && (parseImportNumber(row.cost) === undefined || parseImportNumber(row.cost)! < 0)) return 'Revisá el costo.';
  if (!['ARS', 'USD'].includes(row.currency)) return 'Elegí una moneda.';
  if (!['NUEVO', 'USADO', 'PRE-OWNED', 'OUTLET'].includes(row.condition)) return 'Elegí una condición.';
  if (row.imei?.trim() && !/^\d{15}$/.test(row.imei.trim())) return 'El IMEI tiene 15 dígitos.';
  const quantity = Number(row.quantity || 1);
  if (!Number.isSafeInteger(quantity) || quantity < 1) return 'La cantidad debe ser un entero positivo.';
  if (quantity > 1 && (row.imei?.trim() || row.serial?.trim())) return 'Usá cantidad 1 con IMEI/serie, o quitá el identificador.';
  if ((row.color?.length ?? 0) > 50) return 'El color puede tener hasta 50 caracteres.';
  return null;
}

export function prepareTextRows(rows: Record<string, string>[]): Record<string, string>[] {
  const count = rows.reduce((sum, row) => sum + Number(row.quantity || 1), 0);
  if (!Number.isFinite(count) || count > 2000) throw new Error('El listado supera los 2000 equipos.');
  const prepared = rows.map((row) => {
    const error = textRowError(row);
    if (error) throw new Error(error);
    return { ...row, quantity: row.quantity || '1', price: row.price?.trim() ? String(parseImportNumber(row.price)) : '', cost: row.cost?.trim() ? String(parseImportNumber(row.cost)) : row.cost ?? '' };
  });
  return groupInventoryPreviewRows(prepared, '').map(group => group.row);
}

/** Regroup after editing while keeping review text and exclusions aligned. */
export function groupTextReviewRows(
  rows: Record<string, string>[],
  review: { line: number; original: string; dudas: string[] }[],
  currency: string,
  excluded = new Set<number>(),
) {
  const selected = rows.map((row, index) => ({ row, index })).filter(item => !excluded.has(item.index));
  const groups = groupInventoryPreviewRows(selected.map(item => item.row), currency)
    .map(group => ({ row: group.row, indices: group.indices.map(index => selected[index].index), excluded: false }));
  for (const index of excluded) groups.push({ row: rows[index], indices: [index], excluded: true });
  groups.sort((a, b) => a.indices[0] - b.indices[0]);
  return {
    rows: groups.map(group => group.row),
    review: groups.map(group => ({
      line: review[group.indices[0]]?.line ?? group.indices[0] + 1,
      original: group.indices.map(index => review[index]?.original ?? '').filter(Boolean).join('\n'),
      dudas: [...new Set(group.indices.flatMap(index => review[index]?.dudas ?? []))],
    })),
    excluded: new Set(groups.flatMap((group, index) => group.excluded ? [index] : [])),
  };
}
