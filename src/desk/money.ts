export type MoneyCurrency = 'ARS' | 'USD';

export const FX_WARNING = 'No hay una cotización válida. Los importes en otra moneda se muestran sin convertir.';

export function asMoneyCurrency(value: unknown, fallback: MoneyCurrency = 'ARS'): MoneyCurrency {
  return value === 'USD' ? 'USD' : value === 'ARS' ? 'ARS' : fallback;
}

export function recordCurrency(value: string | null | undefined, active: MoneyCurrency): MoneyCurrency {
  if (value == null || value === '') return active;
  return value === 'USD' ? 'USD' : value === 'ARS' ? 'ARS' : active;
}

export type MoneyProjection = {
  value: number;
  currency: MoneyCurrency;
  blocked: boolean;
};

// Display conversion uses the sell rate so every total shares one peso-per-dollar figure.
export function projectAmount(
  amount: number,
  storedCurrency: string | null | undefined,
  active: MoneyCurrency,
  sellRate: number | null,
): MoneyProjection {
  const from = recordCurrency(storedCurrency, active);
  const value = Number.isFinite(amount) ? amount : 0;
  if (from === active) return { value, currency: active, blocked: false };
  if (sellRate == null || !(sellRate > 0)) return { value, currency: from, blocked: true };
  const converted = from === 'USD' ? value * sellRate : value / sellRate;
  return { value: Math.round(converted), currency: active, blocked: false };
}

export function combineAmounts(
  rows: Array<{ amount: number; currency?: string | null }>,
  active: MoneyCurrency,
  sellRate: number | null,
): number | null {
  let total = 0;
  for (const row of rows) {
    const projected = projectAmount(row.amount, row.currency, active, sellRate);
    if (projected.blocked) return null;
    total += projected.value;
  }
  return Math.round(total);
}

export type StoredAmount = { amount: number; currency: string | null };

export function commitAmount(
  typed: number,
  original: number,
  originalCurrency: string | null | undefined,
  active: MoneyCurrency,
  sellRate: number | null,
): StoredAmount {
  const projected = projectAmount(original, originalCurrency, active, sellRate);
  const next = Number.isFinite(typed) ? Math.round(typed) : 0;
  if (!projected.blocked && next === Math.round(projected.value)) {
    return { amount: original, currency: originalCurrency ?? null };
  }
  if (projected.blocked && next === Math.round(original)) {
    return { amount: original, currency: originalCurrency ?? null };
  }
  return { amount: next, currency: active };
}

export function commitGroup(
  fields: Array<{ typed: number; original: number; currency?: string | null }>,
  active: MoneyCurrency,
  sellRate: number | null,
): { amounts: StoredAmount[]; blocked: boolean } {
  const states = fields.map((field) => {
    const projected = projectAmount(field.original, field.currency, active, sellRate);
    const typed = Number.isFinite(field.typed) ? Math.round(field.typed) : 0;
    const same = projected.blocked ? typed === Math.round(field.original) : typed === Math.round(projected.value);
    return { projected, typed, same };
  });
  if (states.every((state) => state.same)) {
    return {
      blocked: false,
      amounts: fields.map((field) => ({ amount: field.original, currency: field.currency ?? null })),
    };
  }
  if (states.some((state) => state.projected.blocked)) {
    return {
      blocked: true,
      amounts: fields.map((field) => ({ amount: field.original, currency: field.currency ?? null })),
    };
  }
  return {
    blocked: false,
    amounts: states.map((state) => ({ amount: state.typed, currency: active })),
  };
}
