import type { AppMembershipRole } from '../types/app-session';

const BILLING_ROLES = new Set<AppMembershipRole>(['OWNER', 'MANAGER']);

export function canSeeBillingSection(role: string | null | undefined) {
  return BILLING_ROLES.has(role as AppMembershipRole);
}
