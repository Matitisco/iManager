import type { Sale } from '../types';

/** Loading order is independent of the editable business date (date/soldAt). */
export function compareSaleLoadOrder(left: Sale, right: Sale): number {
  const timestamp = (sale: Sale) => {
    const parsed = Date.parse(sale.createdAt ?? '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return timestamp(right) - timestamp(left)
    || (right.saleNumber ?? 0) - (left.saleNumber ?? 0)
    || right.id.localeCompare(left.id, 'en');
}

export const SALE_SORT_LABELS = ['Venta', 'Fecha', 'Cliente', 'Equipo', 'Cant.', 'Vendedor', 'Precio unit.', 'Total', 'Ganancia', 'Estado'] as const;
export type SaleSortColumn = typeof SALE_SORT_LABELS[number];
export const SALE_LOAD_ORDER = 'Orden de carga';

export function sortSales(
  rows: readonly Sale[],
  direction: 'asc' | 'desc' = 'asc',
  value?: (sale: Sale) => string | number | null,
): Sale[] {
  const values = value ? new Map(rows.map(row => [row.id, value(row)])) : null;
  return [...rows].sort((left, right) => {
    if (!values) return compareSaleLoadOrder(left, right);
    const a = values.get(left.id);
    const b = values.get(right.id);
    // Unknown values stay at the end in both directions.
    if (a == null || b == null) return a == null ? (b == null ? compareSaleLoadOrder(left, right) : 1) : -1;
    const compared = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es', { numeric: true });
    return compared * (direction === 'desc' ? -1 : 1) || compareSaleLoadOrder(left, right);
  });
}
