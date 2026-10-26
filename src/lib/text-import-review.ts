import { parseImportNumber } from './import-number';

export function textRowError(row: Record<string, string>): string | null {
  if (!row.model?.trim() || row.model.trim().length > 120) return 'Revisá el modelo.';
  if (row.price?.trim() && (parseImportNumber(row.price) === undefined || parseImportNumber(row.price)! < 0)) return 'Completá un precio válido o dejalo a definir.';
  if (row.cost?.trim() && (parseImportNumber(row.cost) === undefined || parseImportNumber(row.cost)! < 0)) return 'Revisá el costo.';
  if (!['ARS', 'USD'].includes(row.currency)) return 'Elegí una moneda.';
  if (!['NUEVO', 'USADO', 'PRE-OWNED', 'OUTLET'].includes(row.condition)) return 'Elegí una condición.';
  if (row.imei?.trim() && !/^\d{15}$/.test(row.imei.trim())) return 'El IMEI tiene 15 dígitos.';
  const quantity = Number(row.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return 'La cantidad debe ser de 1 a 100.';
  if (quantity > 1 && (row.imei?.trim() || row.serial?.trim())) return 'Usá cantidad 1 con IMEI/serie, o quitá el identificador.';
  if ((row.color?.length ?? 0) > 50) return 'El color puede tener hasta 50 caracteres.';
  return null;
}

export function expandTextRows(rows: Record<string, string>[]): Record<string, string>[] {
  const count = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  if (!Number.isFinite(count) || count > 2000) throw new Error('El listado supera los 2000 equipos.');
  return rows.flatMap((row) => {
    const error = textRowError(row);
    if (error) throw new Error(error);
    return Array.from({ length: Number(row.quantity) }, () => ({ ...row, price: row.price?.trim() ? String(parseImportNumber(row.price)) : '', cost: row.cost?.trim() ? String(parseImportNumber(row.cost)) : row.cost ?? '' }));
  });
}
