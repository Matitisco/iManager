import { describe, expect, it } from 'vitest';
import { canonicalHash, tabFromHash } from './hash-route';
import { returnPatternsHash, returnsView } from './returns-navigation';

describe('supplier to return patterns navigation', () => {
  it('preserves the encoded supplier identity and the canonical returns route', () => {
    const hash = returnPatternsHash('supplier', 'supplier / ñ');
    expect(returnsView(hash)).toEqual({ patterns: true, groupBy: 'supplier', group: 'supplier / ñ' });
    expect(tabFromHash(hash)).toBe('returns');
    expect(canonicalHash(hash)).toBe(hash);
  });
  it('validates grouping, defaults to claims and ignores pattern queries on other sections', () => {
    expect(returnsView('#/comercial/devoluciones')).toMatchObject({ patterns: false, groupBy: 'supplier' });
    expect(returnsView('#/comercial/devoluciones?view=patterns&groupBy=unknown')).toMatchObject({ patterns: true, groupBy: 'supplier' });
    expect(returnsView('#/stock/equipos?view=patterns')).toMatchObject({ patterns: false });
  });
});
