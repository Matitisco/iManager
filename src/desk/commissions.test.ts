import { describe, expect, it } from 'vitest';
import { commissionTotal, effectiveRule, monthKey } from './commissions';
import { commissionFixtureRules } from '../test/commission-fixtures';
describe('commission display contracts', () => {
  it('preserves ARS and USD instead of netting or converting their amounts', () => {
    expect(commissionTotal({ ARS: 112000, USD: 40 })).toBe('$ 112.000 + US$ 40');
    expect(commissionTotal({ ARS: -46000, USD: 20 })).toBe('−$ 46.000 + US$ 20');
  });
  it('uses the store timezone at the month boundary when describing effective rules', () => {
    const lastDay = { ...commissionFixtureRules[0], id: 'last-day', rate: 12, effectiveFrom: '2026-11-01T02:59:59Z' };
    const november = { ...lastDay, id: 'november', rate: 20, effectiveFrom: '2026-11-01T03:00:00Z' };
    expect(monthKey(new Date(lastDay.effectiveFrom))).toBe('2026-10');
    expect(effectiveRule([...commissionFixtureRules, lastDay, november], 'sofia', '2026-10')?.id).toBe('last-day');
    expect(effectiveRule([...commissionFixtureRules, lastDay, november], 'sofia', '2026-11')?.id).toBe('november');
  });
});
