import { describe, expect, it } from 'vitest';
import { sectionBadge, unreadBySection } from './unread-count';

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

  it('keeps Inventario, Ventas and Clientes badges independent of the shared total', () => {
    const counts = unreadBySection([
      ...Array.from({ length: 22 }, () => ({ section: 'sales' })),
      ...Array.from({ length: 3 }, () => ({ section: 'inventory' })),
      { section: 'clients' },
    ]);
    expect(counts.total).toBe(26);
    expect(sectionBadge(counts.bySection, 'inventory')).toBe(3);
    expect(sectionBadge(counts.bySection, 'sales')).toBe(22);
    expect(sectionBadge(counts.bySection, 'clients')).toBe(1);
    expect(sectionBadge(counts.bySection, 'inventory')).not.toBe(counts.total);
  });
});
