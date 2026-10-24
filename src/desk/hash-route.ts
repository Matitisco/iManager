import { hiddenPathFallback } from '../config/hiddenSections';
import type { DeskTab } from './types';

export const ROUTE: Record<DeskTab, string> = {
  dashboard: 'dashboard',
  sales: 'comercial/ventas',
  tradeins: 'comercial/canjes',
  returns: 'comercial/devoluciones',
  patterns: 'analisis/fallas',
  inventory: 'stock/equipos',
  stockCount: 'stock/control',
  suppliers: 'finanzas/proveedores',
  publicCatalog: 'stock/catalogo',
  clients: 'atencion/clientes',
  followups: 'atencion/seguimientos',
  service: 'atencion/servicio',
  cash: 'finanzas/cajas',
  expenses: 'finanzas/gastos',
  reports: 'analisis/reportes',
  periodicSummary: 'analisis/resumen-periodico',
  commissions: 'analisis/comisiones',
  history: 'analisis/historial',
  notifications: 'cuenta/notificaciones',
  help: 'cuenta/ayuda',
  settings: 'cuenta/configuracion',
  more: 'mas',
  billing: 'plan',
};

/** Rutas viejas y el id interno de cada pestaña. */
const LEGACY: Record<string, DeskTab> = {
  'stock/proveedores': 'suppliers',
  dash: 'dashboard',
  dashboard: 'dashboard',
  ven: 'sales',
  ventas: 'sales',
  sales: 'sales',
  canjes: 'tradeins',
  tradeins: 'tradeins',
  devoluciones: 'returns',
  returns: 'returns',
  patterns: 'patterns',
  patrones: 'patterns',
  fallas: 'patterns',
  'analisis/patrones': 'patterns',
  periodicSummary: 'periodicSummary',
  'resumen-periodico': 'periodicSummary',
  'analisis/reportes/resumen-periodico': 'periodicSummary',
  inv: 'inventory',
  inventario: 'inventory',
  equipos: 'inventory',
  inventory: 'inventory',
  control: 'stockCount',
  stockCount: 'stockCount',
  proveedores: 'suppliers',
  suppliers: 'suppliers',
  catalogo: 'publicCatalog',
  publicCatalog: 'publicCatalog',
  clientes: 'clients',
  clients: 'clients',
  seguimientos: 'followups',
  followups: 'followups',
  servicio: 'service',
  service: 'service',
  cajas: 'cash',
  cash: 'cash',
  gastos: 'expenses',
  expenses: 'expenses',
  rep: 'reports',
  reportes: 'reports',
  reports: 'reports',
  comisiones: 'commissions',
  commissions: 'commissions',
  historial: 'history',
  history: 'history',
  notif: 'notifications',
  notificaciones: 'notifications',
  notifications: 'notifications',
  ayuda: 'help',
  help: 'help',
  mas: 'more',
  more: 'more',
  plan: 'billing',
  billing: 'billing',
  config: 'settings',
  configuracion: 'settings',
  settings: 'settings',
};

export function hashPath(hash: string) {
  return (hash.replace(/^#\/?/, '').split('?')[0] ?? '').split('/').filter(Boolean);
}

function hashQuery(hash: string) {
  return hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
}

function isSettingsPath(parts: string[]) {
  return parts[0] === 'config' || parts[0] === 'configuracion' || parts[0] === 'settings'
    || (parts[0] === 'cuenta' && parts[1] === 'configuracion');
}

export type ConfigPlace = { page: 'settings' | 'team'; memberId: string | null };

/** `#/config`, `#/cuenta/configuracion/equipo` y `#/cuenta/configuracion/equipo/:id`. */
export function configPlace(hash: string): ConfigPlace {
  const parts = hashPath(hash);
  const equipoAt = parts[0] === 'cuenta' && parts[1] === 'configuracion' ? 2 : (parts[0] === 'config' || parts[0] === 'configuracion' || parts[0] === 'settings' ? 1 : -1);
  if (equipoAt < 0 || parts[equipoAt] !== 'equipo') return { page: 'settings', memberId: null };
  const memberId = parts[equipoAt + 1];
  return { page: 'team', memberId: memberId ? decodeURIComponent(memberId) : null };
}

export function configHash(page: 'settings' | 'team', memberId?: string | null) {
  if (page === 'team' && memberId) return `#/cuenta/configuracion/equipo/${encodeURIComponent(memberId)}`;
  if (page === 'team') return '#/cuenta/configuracion/equipo';
  return '#/cuenta/configuracion';
}

export function tabFromHash(hash: string): DeskTab {
  const fallback = hiddenPathFallback(hash);
  if (fallback) return tabFromHash(fallback);
  const parts = hashPath(hash);
  if (!parts.length) return 'dashboard';
  if (isSettingsPath(parts)) return 'settings';
  const canonical = canonicalHash(hash);
  if (canonical && canonical !== hash) return tabFromHash(canonical);
  const full = parts.join('/');
  const nested = parts.slice(0, 2).join('/');
  const match = (Object.entries(ROUTE) as [DeskTab, string][]).find(([, path]) => path === full || path === nested);
  if (match) return match[0];
  if (LEGACY[full]) return LEGACY[full];
  return LEGACY[parts[0] ?? ''] ?? 'dashboard';
}

/** Hash canónico, o null si la ruta no es del escritorio (restablecer, salida, desconocida). */
export function canonicalHash(hash: string): string | null {
  const fallback = hiddenPathFallback(hash);
  if (fallback) return fallback;
  const parts = hashPath(hash);
  const query = hashQuery(hash);
  if (!parts.length) return `#/dashboard${query}`;
  if (parts[0] === 'restablecer' || parts[0] === 'salida') return null;
  if (isSettingsPath(parts)) {
    const place = configPlace(hash);
    return `${configHash(place.page, place.memberId)}${query}`;
  }
  const full = parts.join('/');
  const exact = (Object.entries(ROUTE) as [DeskTab, string][]).find(([, path]) => path === full);
  let tab = exact?.[0] ?? LEGACY[full];
  if (!tab) return null;
  const params = new URLSearchParams(query);
  const view = params.get('view');
  if (tab === 'returns' && (view === 'patterns' || view === 'claims')) {
    if (view === 'patterns') tab = 'patterns';
    params.delete('view');
  } else if (tab === 'reports' && (view === 'periodic' || view === 'periodicSummary' || view === 'periodic-summary' || view === 'resumen-periodico')) {
    tab = 'periodicSummary';
    params.delete('view');
  } else if (tab === 'publicCatalog' && (view === 'summary' || view === 'items')) {
    params.delete('view');
  } else return `#/${ROUTE[tab]}${query}`;
  const search = params.toString();
  return `#/${ROUTE[tab]}${search ? `?${search}` : ''}`;
}

/** Push a history entry, or replace the current one and notify listeners. */
export function writeHash(hash: string, mode: 'push' | 'replace' = 'push') {
  if (window.location.hash === hash) return;
  if (mode === 'replace') {
    history.replaceState(history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = hash;
}
