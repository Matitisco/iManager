export const DESK_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'sales', label: 'Ventas' },
  { id: 'tradeins', label: 'Canjes' },
  { id: 'clients', label: 'Clientes' },
  { id: 'service', label: 'Servicio técnico' },
  { id: 'reports', label: 'Reportes' },
  { id: 'commissions', label: 'Comisiones' },
  { id: 'notifications', label: 'Notificaciones' },
] as const;

export type DeskSectionId = (typeof DESK_SECTIONS)[number]['id'];

export const DESK_SECTION_IDS: DeskSectionId[] = DESK_SECTIONS.map((section) => section.id);

export function visibleSections(stored: string[] | null | undefined, role?: string | null): DeskSectionId[] {
  if (role === 'OWNER' || stored == null) return [...DESK_SECTION_IDS];
  return DESK_SECTION_IDS.filter((id) => stored.includes(id));
}

export function canOpenSection(id: string, stored: string[] | null | undefined, role?: string | null) {
  if (id === 'settings') return true;
  if (id === 'commissions') return true; // La sección incluye la vista propia.
  // Un empleado sin permisos guardados no ve Reportes. Si el dueño lo activa, sí.
  if (role === 'STAFF' && id === 'reports' && stored == null) return false;
  return visibleSections(stored, role).includes(id as DeskSectionId);
}

/** Secciones que el switch de permisos debe mostrar prendidas: coinciden con el acceso real. */
export function grantedSections(stored: string[] | null | undefined, role?: string | null): DeskSectionId[] {
  return DESK_SECTION_IDS.filter((id) => id === 'commissions' ? canManageCommissions(stored, role) : canOpenSection(id, stored, role));
}

/** Facturación, margen y costo usan el mismo permiso que Reportes. */
export function canSeeFinancials(stored: string[] | null | undefined, role?: string | null) {
  return canOpenSection('reports', stored, role);
}

/** El listado de miembros responde 403 para un empleado. */
export function canViewTeam(role?: string | null) {
  return role === 'OWNER' || role === 'MANAGER';
}

/** Orden de la barra móvil: los 4 primeros permitidos quedan abajo; el resto va a Más. */
export const MOBILE_BAR_CANDIDATES: DeskSectionId[] = [
  'dashboard',
  'inventory',
  'sales',
  'reports',
  'tradeins',
  'clients',
  'service',
  'commissions',
  'notifications',
];

export function mobileTabs(stored: string[] | null | undefined, role?: string | null, limit = 4) {
  const allowed = MOBILE_BAR_CANDIDATES.filter((id) => canOpenSection(id, stored, role));
  const bar: DeskSectionId[] = allowed.filter(id => id !== 'commissions').slice(0, limit);
  return { bar, more: allowed.filter(id => !bar.includes(id)) };
}

/** Administración del equipo; la navegación a la vista propia está siempre disponible. */
export function canManageCommissions(stored: string[] | null | undefined, role?: string | null) {
  return role === 'OWNER' || Boolean(stored?.includes('commissions'));
}
