export function canManageSensitive(membership?: { role?: string | null; sensitiveAccess?: boolean | null } | null): boolean {
  const role = membership?.role;
  if (!role) return false;
  if (role === 'OWNER') return true;
  if (membership?.sensitiveAccess === true) return true;
  if (membership?.sensitiveAccess === false) return false;
  return role === 'MANAGER';
}
