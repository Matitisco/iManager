import { describe, expect, it } from 'vitest';
import { canManageCommissions, canOpenHistory, canOpenSection, canSeeFinancials, canViewTeam, grantedSections, visibleSections } from './sections';

describe('desk sections', () => {
  it('offers catalog after Inventory to OWNER and only with the permission', () => {
    expect(visibleSections(null, 'OWNER').slice(0, 3)).toEqual(['dashboard', 'inventory', 'publicCatalog']);
    expect(canOpenSection('publicCatalog', ['publicCatalog'], 'STAFF')).toBe(true);
    expect(canOpenSection('publicCatalog', null, 'MANAGER')).toBe(false);
  });
  it('grants commissions administration only to owners by default, and always allows own data', () => {
    expect(canManageCommissions(null, 'OWNER')).toBe(true);
    for (const role of ['MANAGER', 'STAFF']) {
      expect(canManageCommissions(null, role)).toBe(false);
      expect(grantedSections(null, role)).not.toContain('commissions');
      expect(canManageCommissions(['commissions'], role)).toBe(true);
      expect(canOpenSection('commissions', [], role)).toBe(true);
    }
  });
  it('keeps every section when access was never customized, and settings always', () => {
    expect(visibleSections(null, 'STAFF')).toHaveLength(7);
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
    expect(canOpenHistory(null, 'OWNER')).toBe(true);
    expect(canOpenHistory(null, 'MANAGER')).toBe(false);
    expect(canOpenHistory(['history'], 'STAFF')).toBe(true);
    expect(canOpenHistory(['sales'], 'STAFF')).toBe(false);
  });

  it('temporarily shows staff billing, margin and cost regardless of reports access', () => {
    expect(canSeeFinancials(null, 'OWNER')).toBe(true);
    expect(canSeeFinancials(null, 'MANAGER')).toBe(true);
    expect(canSeeFinancials(['sales', 'reports'], 'MANAGER')).toBe(true);
    expect(canSeeFinancials(['sales'], 'MANAGER')).toBe(false);
    expect(canSeeFinancials(null, 'STAFF')).toBe(true);
    expect(canSeeFinancials(['sales'], 'STAFF')).toBe(true);
    expect(canSeeFinancials(['reports', 'sales'], 'STAFF')).toBe(true);
  });

  it('lets only the owner and the manager load the team', () => {
    expect(canViewTeam('OWNER')).toBe(true);
    expect(canViewTeam('MANAGER')).toBe(true);
    expect(canViewTeam('STAFF')).toBe(false);
    expect(canViewTeam(null)).toBe(false);
    expect(canViewTeam(undefined)).toBe(false);
  });

});

for (const role of ['STAFF', 'MANAGER', 'OWNER']) {
  it(`gates catalog consistently for ${role}`, () => {
    for (const stored of [null, [], ['inventory'], ['publicCatalog'], ['dashboard', 'inventory', 'sales', 'tradeins', 'publicCatalog']]) {
      const allowed = role === 'OWNER' || Boolean(stored?.includes('publicCatalog'));
      expect(visibleSections(stored, role).includes('publicCatalog')).toBe(allowed);
      expect(grantedSections(stored, role).includes('publicCatalog')).toBe(allowed);
      expect(canOpenSection('publicCatalog', stored, role)).toBe(allowed);
    }
  });
}
