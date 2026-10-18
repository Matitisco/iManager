import type { CommissionSeller } from '../types/commissions';
import type { Sale } from '../types';
import { UNASSIGNED_SELLER, saleSellerKey } from './sale-column-filters';

export type SellerOption = {
  id: string;
  name: string;
  role: CommissionSeller['role'] | 'NONE';
  count: number;
};

/** Personas con ventas en el conjunto ya filtrado (período y demás filtros), más quienes están en el equipo. */
export function sellerFilterOptions(pool: Sale[], people: CommissionSeller[]): SellerOption[] {
  const counts = new Map<string, number>();
  for (const sale of pool) {
    const key = saleSellerKey(sale);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = new Map(people.map((person) => [person.id, person]));
  const ids = new Set<string>([...people.map((person) => person.id), ...counts.keys()]);
  ids.delete(UNASSIGNED_SELLER);
  const rows: SellerOption[] = [...ids].map((id) => {
    const person = known.get(id);
    return {
      id,
      name: person?.name ?? 'Vendedor no disponible',
      role: person?.role ?? 'STAFF',
      count: counts.get(id) ?? 0,
    };
  });
  rows.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'es'));
  rows.push({
    id: UNASSIGNED_SELLER,
    name: 'Sin vendedor',
    role: 'NONE',
    count: counts.get(UNASSIGNED_SELLER) ?? 0,
  });
  return rows;
}

export function sellerChipLabel(ids: string[], options: SellerOption[], phone: boolean) {
  if (ids.length === 0) return phone ? 'Vendedor' : '';
  const names = ids.map((id) => options.find((option) => option.id === id)?.name ?? 'Vendedor');
  if (phone) return names.length === 1 ? names[0] : `${names.length} vendedores`;
  return names.length === 1 ? `Vendedor: ${names[0]}` : `Vendedor: ${names.length}`;
}

export function salesMatchingSellers(pool: Sale[], ids: string[]) {
  if (ids.length === 0) return pool;
  const selected = new Set(ids);
  return pool.filter((sale) => selected.has(saleSellerKey(sale)));
}
