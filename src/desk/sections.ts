export const DESK_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'sales', label: 'Ventas' },
  { id: 'tradeins', label: 'Canjes' },
  { id: 'clients', label: 'Clientes' },
  { id: 'service', label: 'Servicio técnico' },
  { id: 'reports', label: 'Reportes' },
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
  if (role === 'STAFF' && id === 'reports') return false;
  return visibleSections(stored, role).includes(id as DeskSectionId);
}

/** Facturación, margen y costo usan el mismo permiso que Reportes. */
export function canSeeFinancials(stored: string[] | null | undefined, role?: string | null) {
  return canOpenSection('reports', stored, role);
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
  'notifications',
];

export function mobileTabs(stored: string[] | null | undefined, role?: string | null, limit = 4) {
  const allowed = MOBILE_BAR_CANDIDATES.filter((id) => canOpenSection(id, stored, role));
  return {
    bar: allowed.slice(0, limit),
    more: allowed.slice(limit),
  };
}
