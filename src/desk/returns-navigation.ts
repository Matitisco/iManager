import type { PatternGroupBy } from '../services/returns-api';
import { ROUTE, tabFromHash, writeHash } from './hash-route';

export function returnsView(hash: string) {
  const query = new URLSearchParams(hash.split('?')[1]);
  const requested = query.get('groupBy');
  const groupBy: PatternGroupBy = requested === 'purchase' || requested === 'model' ? requested : 'supplier';
  return {
    patterns: tabFromHash(hash) === 'returns' && query.get('view') === 'patterns',
    groupBy,
    group: query.get('group') ?? undefined,
  };
}

export function returnPatternsHash(groupBy: PatternGroupBy = 'supplier', group?: string) {
  const query = new URLSearchParams({ view: 'patterns', groupBy });
  if (group) query.set('group', group);
  return `#/${ROUTE.returns}?${query}`;
}

export function showSupplierPatterns(supplierId: string) {
  const hash = returnPatternsHash('supplier', supplierId);
  // The user may have changed the local segments since entering this same URL.
  if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else writeHash(hash);
}
