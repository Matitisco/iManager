import type { DeskTab } from './types';

export const ROUTE: Record<DeskTab, string> = {
  billing: 'plan', cash: 'cajas', publicCatalog: 'catalogo', dashboard: 'dash', inventory: 'inv', suppliers: 'proveedores', sales: 'ven', returns: 'devoluciones', tradeins: 'canjes', expenses: 'gastos',
  clients: 'clientes', service: 'servicio', reports: 'rep', history: 'historial', notifications: 'notif', settings: 'config',
  help: 'ayuda', more: 'mas', commissions: 'comisiones',
};

/** Hash routes may carry a query (`#/plan?preapproval_id=`). Only the path selects the screen. */
export function tabFromHash(hash: string): DeskTab {
  const name = hash.replace(/^#\/?/, '').split('?')[0]?.split('/')[0] ?? '';
  return (Object.keys(ROUTE) as DeskTab[]).find((key) => ROUTE[key] === name) ?? 'dashboard';
}

export type ConfigPlace = { page: 'settings' | 'team'; memberId: string | null };

/** `#/config`, `#/config/equipo` and `#/config/equipo/:id` stay on Configuración. */
export function configPlace(hash: string): ConfigPlace {
  const parts = (hash.replace(/^#\/?/, '').split('?')[0] ?? '').split('/').filter(Boolean);
  if (parts[0] !== 'config' || parts[1] !== 'equipo') return { page: 'settings', memberId: null };
  return { page: 'team', memberId: parts[2] ? decodeURIComponent(parts[2]) : null };
}

export function configHash(page: 'settings' | 'team', memberId?: string | null) {
  if (page === 'team' && memberId) return `#/config/equipo/${encodeURIComponent(memberId)}`;
  if (page === 'team') return '#/config/equipo';
  return '#/config';
}

/** Push a history entry, or replace the current one and notify listeners. */
export function writeHash(hash: string, mode: 'push' | 'replace' = 'push') {
  if (window.location.hash === hash) return;
  if (mode === 'replace') {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = hash;
}
