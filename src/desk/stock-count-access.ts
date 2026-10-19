import { canOpenSection } from './sections';

export function canManageStockCount(membership?: { role?: string | null; sections?: string[] | null } | null) {
  const role = membership?.role ?? '';
  if (role === 'OWNER') return true;
  if (role === 'MANAGER') return canOpenSection('inventory', membership?.sections, role);
  return false;
}
