import type { Product } from '../types';
import type { StoredAmount } from './money';
import { parseImportNumber } from '../lib/import-number';

/** Manual equipment amounts accept both AR and US decimal/thousands separators. */
export function parseEquipmentMoney(value: string): number {
  const normalized = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value.trim()) ? value.replace(/,/g, '') : value;
  return parseImportNumber(normalized) ?? 0;
}

type Commit = (fields: Array<{ typed: number; original: number; currency?: string | null }>) => { amounts: StoredAmount[]; blocked: boolean };

export function equipmentMoney(current: Product, price: string, cost: string, seeCosts: boolean, lockPrice: boolean, commit: Commit) {
  const fields = [{ typed: lockPrice ? current.price : parseEquipmentMoney(price), original: current.price, currency: current.currency }];
  if (seeCosts) fields.push({ typed: parseEquipmentMoney(cost), original: current.cost ?? 0, currency: current.currency });
  const result = commit(fields);
  return { ...result, cost: seeCosts ? result.amounts[1].amount : current.cost };
}
