/** Remove an id here to restore its navigation and screens. */
export const HIDDEN_SECTIONS: readonly string[] = Object.freeze([
  'gastos', 'caja', 'cuenta-corriente', 'seguimientos',
]);

const SECTION_IDS: Readonly<Record<string, string>> = {
  expenses: 'gastos', cash: 'caja', cajas: 'caja', cashBalances: 'caja',
  cuenta: 'cuenta-corriente', followups: 'seguimientos',
};

export function isSectionHidden(id: string): boolean {
  return HIDDEN_SECTIONS.includes(SECTION_IDS[id] ?? id);
}

/** Accepts canonical hashes, legacy hashes and paths, including nested detail routes. */
export function isPathHidden(path: string): boolean {
  const [pathname, query = ''] = path.replace(/^#/, '').split('?');
  const parts = pathname.split('/').filter(Boolean);
  const sectionAt = ['finanzas', 'atencion'].includes(parts[0]) ? 1 : 0;
  const section = parts[sectionAt] ?? '';
  const clients = section === 'clients' || section === 'clientes';
  // «cuenta» is also the top-level group for settings and notifications.
  if (section !== 'cuenta' && isSectionHidden(section)) return true;
  if (clients && isSectionHidden(parts[sectionAt + 1] ?? '')) return true;
  const params = new URLSearchParams(query.split('#')[0]);
  return clients && ['tab', 'view', 'section'].some(key => isSectionHidden(params.get(key) ?? ''));
}

export function hiddenPathFallback(path: string): string | null {
  if (!isPathHidden(path)) return null;
  const parts = path.replace(/^#/, '').split('?')[0].split('/').filter(Boolean);
  const section = parts[['finanzas', 'atencion'].includes(parts[0]) ? 1 : 0];
  return ['clientes', 'clients', 'seguimientos', 'followups', 'cuenta-corriente'].includes(section)
    ? '#/atencion/clientes' : '#/dashboard';
}
