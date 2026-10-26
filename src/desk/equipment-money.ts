import type { Product } from '../types';
import type { StoredAmount } from './money';
import { parseMoney } from './format';

type Commit = (fields: Array<{ typed: number; original: number; currency?: string | null }>) => { amounts: StoredAmount[]; blocked: boolean };

export function equipmentMoney(current: Product, price: string, cost: string, seeCosts: boolean, lockPrice: boolean, commit: Commit) {
  const fields = [{ typed: lockPrice ? current.price : parseMoney(price), original: current.price, currency: current.currency }];
  if (seeCosts) fields.push({ typed: parseMoney(cost), original: current.cost ?? 0, currency: current.currency });
  const result = commit(fields);
  return { ...result, cost: seeCosts ? result.amounts[1].amount : current.cost };
}
