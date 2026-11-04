import type { Product } from '../types';
import { isInStock } from './format';
import { projectAmount, recordCurrency, type MoneyCurrency } from './money';

const natural = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export function parseInventoryModel(model: string) {
  const value = normalize(model);
  const iphone =
    /^(?:apple\s+)?iphone\s*(\d+)\s*(pro\s*max|pro|plus|mini)?$/.exec(value);
  if (iphone) {
    const variant = (iphone[2] || '').replace(/\s/g, '');
    return {
      brand: 'Apple',
      generation: Number(iphone[1]),
      variant,
      rank: variant === 'promax' ? 3 : variant === 'pro' ? 2 : variant ? 1 : 0,
      recognized: true,
    };
  }
  const brand =
    /^(samsung|galaxy|motorola|moto|xiaomi|redmi|poco|google|pixel|huawei|honor|nokia|oppo|realme|oneplus|sony|lg)\b/.exec(
      value,
    )?.[1];
  const brands: Record<string, string> = {
    galaxy: 'Samsung',
    moto: 'Motorola',
    redmi: 'Xiaomi',
    poco: 'Xiaomi',
    pixel: 'Google',
  };
  return {
    brand: brand ? brands[brand] || brand : '',
    generation: null,
    variant: '',
    rank: 0,
    recognized: Boolean(brand),
  };
}

function capacityValue(capacity: string) {
  const match = /^(\d+(?:[.,]\d+)?)\s*(gb|tb)?$/i.exec(capacity.trim());
  return match
    ? Number(match[1].replace(',', '.')) *
        (match[2]?.toLowerCase() === 'tb' ? 1024 : 1)
    : Infinity;
}

export function compareInventoryLine(
  a: Pick<Product, 'model' | 'capacity'>,
  b: Pick<Product, 'model' | 'capacity'>,
) {
  const left = parseInventoryModel(a.model);
  const right = parseInventoryModel(b.model);
  const tier = (parsed: ReturnType<typeof parseInventoryModel>) =>
    parsed.generation != null ? 0 : parsed.recognized ? 1 : 2;
  const line =
    tier(left) - tier(right) ||
    (left.generation != null && right.generation != null
      ? left.generation - right.generation ||
        left.rank - right.rank ||
        natural.compare(left.variant, right.variant)
      : natural.compare(left.brand, right.brand) ||
        natural.compare(a.model, b.model));
  if (line) return line;
  const lcap = capacityValue(a.capacity);
  const rcap = capacityValue(b.capacity);
  return (
    (lcap === rcap ? 0 : lcap < rcap ? -1 : 1) ||
    natural.compare(a.capacity, b.capacity) ||
    natural.compare(a.model, b.model)
  );
}

export type InventoryModelGroup = {
  key: string;
  model: string;
  capacity: string;
  items: Product[];
  units: number;
  available: number;
  colors: string[];
};

/** Accepts the already filtered collection, before pagination. Never merges stored records. */
export function groupInventoryModels(items: Product[]): InventoryModelGroup[] {
  const groups = new Map<string, InventoryModelGroup>();
  for (const item of items) {
    // Optional compatibility with the independent accessory feature (#760).
    if ('kind' in item && item.kind === 'ACCESSORY') continue;
    const capacity = capacityValue(item.capacity);
    const model = normalize(item.model)
      .replace(/^apple\s+(?=iphone)/, '')
      .replace(/^iphone\s*(\d+)/, 'iphone $1')
      .replace(/pro\s*max$/, 'pro max');
    const key = JSON.stringify([
      model,
      Number.isFinite(capacity) ? capacity : normalize(item.capacity),
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        model: item.model.trim(),
        capacity: item.capacity.trim(),
        items: [],
        units: 0,
        available: 0,
        colors: [],
      };
      groups.set(key, group);
    }
    const quantity = item.cantidad ?? 1;
    group.items.push(item);
    group.units += quantity;
    if (!item.archivedAt && isInStock(item.status)) group.available += quantity;
    const color = item.color.trim();
    if (
      color &&
      !group.colors.some((existing) => normalize(existing) === normalize(color))
    )
      group.colors.push(color);
  }
  return [...groups.values()].sort(compareInventoryLine);
}

export type GroupMoneySummary =
  | {
      min: number;
      max: number;
      average: number | null;
      currency: MoneyCurrency;
      blocked: false;
    }
  | { blocked: true }
  | null;

/** Display only. Integer cents preserve weighted averages without accumulating float errors. */
export function summarizeGroupMoney(
  items: Product[],
  field: 'price' | 'cost',
  active: MoneyCurrency,
  rate: number | null,
): GroupMoneySummary {
  const known = items.filter(
    (item) => item[field] != null && Number.isFinite(item[field]),
  );
  if (!known.length) return null;
  let projected = known.map((item) =>
    projectAmount(item[field]!, item.currency, active, rate, 2),
  );
  let currency = active;
  if (projected.some((value) => value.blocked)) {
    const currencies = new Set(
      known.map((item) => recordCurrency(item.currency, active)),
    );
    if (currencies.size !== 1) return { blocked: true };
    currency = recordCurrency(known[0].currency, active);
    projected = known.map((item) =>
      projectAmount(item[field]!, item.currency, currency, rate, 2),
    );
  }
  const cents = projected.map((value) => BigInt(Math.round(value.value * 100)));
  let total = 0n;
  let units = 0n;
  cents.forEach((value, index) => {
    const quantity = BigInt(known[index].cantidad ?? 1);
    total += value * quantity;
    units += quantity;
  });
  // Zero-stock records still have a valid unit price/cost; they add no weight to the average.
  const average =
    units > 0n ? Number((total + units / 2n) / units) / 100 : null;
  return {
    min: Number(cents.reduce((a, b) => (a < b ? a : b))) / 100,
    max: Number(cents.reduce((a, b) => (a > b ? a : b))) / 100,
    average,
    currency,
    blocked: false,
  };
}
