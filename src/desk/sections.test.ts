import { describe, expect, it } from 'vitest';
import { canOpenSection, canSeeFinancials, canViewTeam, grantedSections, mobileTabs, visibleSections } from './sections';

describe('desk sections', () => {
  it('keeps every section when access was never customized, and settings always', () => {
    expect(visibleSections(null, 'STAFF')).toHaveLength(8);
    expect(grantedSections(null, 'STAFF')).not.toContain('reports');
    expect(grantedSections(null, 'MANAGER')).toContain('reports');
    expect(grantedSections(['sales', 'reports'], 'STAFF')).toEqual(['sales', 'reports']);
    expect(canOpenSection('service', ['service'], 'STAFF')).toBe(true);
    expect(canOpenSection('service', ['sales'], 'MANAGER')).toBe(false);
    expect(canOpenSection('settings', [], 'STAFF')).toBe(true);
    expect(canOpenSection('reports', null, 'STAFF')).toBe(false);
    expect(canOpenSection('reports', ['sales'], 'STAFF')).toBe(false);
    expect(canOpenSection('reports', ['reports'], 'STAFF')).toBe(true);
    expect(canOpenSection('sales', ['inventory'], 'MANAGER')).toBe(false);
    expect(canOpenSection('inventory', ['inventory'], 'MANAGER')).toBe(true);
    expect(canOpenSection('reports', [], 'OWNER')).toBe(true);
  });

  it('hides billing, margin and cost unless reports is granted', () => {
    expect(canSeeFinancials(null, 'OWNER')).toBe(true);
    expect(canSeeFinancials(null, 'MANAGER')).toBe(true);
    expect(canSeeFinancials(['sales', 'reports'], 'MANAGER')).toBe(true);
    expect(canSeeFinancials(['sales'], 'MANAGER')).toBe(false);
    expect(canSeeFinancials(null, 'STAFF')).toBe(false);
    expect(canSeeFinancials(['sales'], 'STAFF')).toBe(false);
    expect(canSeeFinancials(['reports', 'sales'], 'STAFF')).toBe(true);
  });

  it('lets only the owner and the manager load the team', () => {
    expect(canViewTeam('OWNER')).toBe(true);
    expect(canViewTeam('MANAGER')).toBe(true);
    expect(canViewTeam('STAFF')).toBe(false);
    expect(canViewTeam(null)).toBe(false);
    expect(canViewTeam(undefined)).toBe(false);
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
    expect(mobileTabs(['reports', 'sales'], 'STAFF')).toEqual({
      bar: ['sales', 'reports'],
      more: [],
    });
    expect(mobileTabs(['dashboard', 'inventory', 'sales', 'reports', 'tradeins'], 'STAFF')).toEqual({
      bar: ['dashboard', 'inventory', 'sales', 'reports'],
      more: ['tradeins'],
    });
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
