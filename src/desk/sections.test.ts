import { describe, expect, it } from 'vitest';
import { canOpenSection, canSeeFinancials, mobileTabs, visibleSections } from './sections';

describe('desk sections', () => {
  it('keeps every section when access was never customized, and settings always', () => {
    expect(visibleSections(null, 'STAFF')).toHaveLength(8);
    expect(canOpenSection('service', ['service'], 'STAFF')).toBe(true);
    expect(canOpenSection('service', ['sales'], 'MANAGER')).toBe(false);
    expect(canOpenSection('settings', [], 'STAFF')).toBe(true);
    expect(canOpenSection('reports', ['reports'], 'STAFF')).toBe(false);
    expect(canOpenSection('sales', ['inventory'], 'MANAGER')).toBe(false);
    expect(canOpenSection('inventory', ['inventory'], 'MANAGER')).toBe(true);
    expect(canOpenSection('reports', [], 'OWNER')).toBe(true);
  });

  it('hides billing, margin and cost from anyone without reports, including every employee', () => {
    expect(canSeeFinancials(null, 'OWNER')).toBe(true);
    expect(canSeeFinancials(null, 'MANAGER')).toBe(true);
    expect(canSeeFinancials(['sales', 'reports'], 'MANAGER')).toBe(true);
    expect(canSeeFinancials(['sales'], 'MANAGER')).toBe(false);
    expect(canSeeFinancials(null, 'STAFF')).toBe(false);
    expect(canSeeFinancials(['reports', 'sales'], 'STAFF')).toBe(false);
  });

  it('keeps four phone tabs and parks the rest in Más, sliding the next allowed section in', () => {
    expect(mobileTabs(null, 'OWNER')).toEqual({
      bar: ['dashboard', 'inventory', 'sales', 'reports'],
      more: ['tradeins', 'clients', 'service', 'notifications'],
    });
    expect(mobileTabs(null, 'STAFF')).toEqual({
      bar: ['dashboard', 'inventory', 'sales', 'tradeins'],
      more: ['clients', 'service', 'notifications'],
    });
    expect(mobileTabs(['reports', 'sales'], 'STAFF').bar).not.toContain('reports');
    expect(mobileTabs(['dashboard', 'sales', 'reports', 'service'], 'MANAGER')).toEqual({
      bar: ['dashboard', 'sales', 'reports', 'service'],
      more: [],
    });
    expect(mobileTabs(['clients'], 'MANAGER')).toEqual({
      bar: ['clients'],
      more: [],
    });
  });
});
