import { describe, expect, it } from 'vitest';
import { canOpenSection, canSeeFinancials, visibleSections } from './sections';

describe('desk sections', () => {
  it('keeps every section when access was never customized, and settings always', () => {
    expect(visibleSections(null, 'STAFF')).toHaveLength(7);
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
});
