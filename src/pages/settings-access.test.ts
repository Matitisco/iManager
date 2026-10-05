import { describe, expect, it } from 'vitest';
import { canSeeBillingSection } from './settings-access';

describe('canSeeBillingSection', () => {
  it('allows the store owner and the admin role', () => {
    expect(canSeeBillingSection('OWNER')).toBe(true);
    expect(canSeeBillingSection('MANAGER')).toBe(true);
  });

  it('hides billing from sellers and unknown roles', () => {
    expect(canSeeBillingSection('STAFF')).toBe(false);
    expect(canSeeBillingSection(null)).toBe(false);
    expect(canSeeBillingSection(undefined)).toBe(false);
  });
});
