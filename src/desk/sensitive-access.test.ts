import { describe, expect, it } from 'vitest';
import { canManageSensitive } from './sensitive-access';

describe('canManageSensitive', () => {
  it('follows the role default and an explicit grant', () => {
    expect(canManageSensitive({ role: 'OWNER' })).toBe(true);
    expect(canManageSensitive({ role: 'OWNER', sensitiveAccess: false })).toBe(true);
    expect(canManageSensitive({ role: 'MANAGER' })).toBe(true);
    expect(canManageSensitive({ role: 'MANAGER', sensitiveAccess: false })).toBe(false);
    expect(canManageSensitive({ role: 'STAFF' })).toBe(false);
    expect(canManageSensitive({ role: 'STAFF', sensitiveAccess: null })).toBe(false);
    expect(canManageSensitive({ role: 'STAFF', sensitiveAccess: true })).toBe(true);
    expect(canManageSensitive(null)).toBe(false);
  });
});
