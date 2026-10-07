import { describe, expect, it } from 'vitest';
import { canOpenSection, visibleSections } from './sections';

describe('desk sections', () => {
  it('keeps every section when access was never customized, and settings always', () => {
    expect(visibleSections(null, 'STAFF')).toHaveLength(7);
    expect(canOpenSection('settings', [], 'STAFF')).toBe(true);
    expect(canOpenSection('reports', ['reports'], 'STAFF')).toBe(false);
    expect(canOpenSection('sales', ['inventory'], 'MANAGER')).toBe(false);
    expect(canOpenSection('inventory', ['inventory'], 'MANAGER')).toBe(true);
    expect(canOpenSection('reports', [], 'OWNER')).toBe(true);
  });
});
