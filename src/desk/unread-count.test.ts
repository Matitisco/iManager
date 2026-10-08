import { describe, expect, it } from 'vitest';
import { unreadBySection } from './unread-count';

describe('unreadBySection', () => {
  it('counts unread notifications per section and keeps the total', () => {
    const counts = unreadBySection([
      { section: 'sales', readAt: null },
      { section: 'sales', readAt: '2026-10-08T00:00:00.000Z' },
      { section: 'inventory', readAt: null },
      { section: 'clients', readAt: null },
      { section: 'tradeins', readAt: null },
      { section: 'reports', readAt: null },
    ]);
    expect(counts.bySection).toEqual({ inventory: 1, sales: 1, tradeins: 1, clients: 1 });
    expect(counts.total).toBe(4);
  });
});
