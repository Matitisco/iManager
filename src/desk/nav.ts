import type { DeskTab } from './types';
import { canManageCommissions, canOpenHistory, canOpenSection } from './sections';

export type NavGroupId = 'comercial' | 'stock' | 'atencion' | 'finanzas' | 'analisis';

export type NavIcon =
  | 'grid'
  | 'list'
  | 'cart'
  | 'swap'
  | 'user'
  | 'wrench'
  | 'bars'
  | 'bell'
  | 'comisiones'
  | 'store'
  | 'register'
  | 'card'
  | 'clock'
  | 'gear'
  | 'help';

export type NavSection = {
  id: DeskTab;
  label: string;
  ownLabel?: string;
  subtitle: string;
  ownSubtitle?: string;
  icon: NavIcon;
  group: NavGroupId | 'cuenta' | null;
};

export const NAV_GROUPS: { id: NavGroupId; label: string; icon: NavIcon }[] = [
  { id: 'comercial', label: 'Comercial', icon: 'cart' },
  { id: 'stock', label: 'Stock', icon: 'list' },
  { id: 'atencion', label: 'Atención', icon: 'user' },
  { id: 'finanzas', label: 'Finanzas', icon: 'register' },
  { id: 'analisis', label: 'Análisis', icon: 'bars' },
];

export const NAV_SECTIONS: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', subtitle: 'Resumen de la tienda', icon: 'grid', group: null },
  { id: 'sales', label: 'Ventas', subtitle: 'Registro de ventas', icon: 'cart', group: 'comercial' },
  { id: 'tradeins', label: 'Canjes', subtitle: 'Equipos dados y recibidos', icon: 'swap', group: 'comercial' },
  { id: 'returns', label: 'Devoluciones', subtitle: 'Reclamos, notas de crédito y RMA', icon: 'swap', group: 'comercial' },
  { id: 'inventory', label: 'Equipos', subtitle: 'Equipos y stock', icon: 'list', group: 'stock' },
  { id: 'stockCount', label: 'Control de stock', subtitle: 'Conteo a ciegas del local', icon: 'list', group: 'stock' },
  { id: 'publicCatalog', label: 'Catálogo', subtitle: 'Tu lista de precios pública', icon: 'store', group: 'stock' },
  { id: 'clients', label: 'Clientes', subtitle: 'Agenda y saldos', icon: 'user', group: 'atencion' },
  { id: 'followups', label: 'Seguimientos', subtitle: 'A quién escribirle hoy', icon: 'user', group: 'atencion' },
  { id: 'service', label: 'Servicio técnico', subtitle: 'Órdenes de reparación', icon: 'wrench', group: 'atencion' },
  { id: 'cash', label: 'Cajas', subtitle: 'Ingresos, egresos y cierre diario', icon: 'register', group: 'finanzas' },
  { id: 'expenses', label: 'Gastos', subtitle: 'Lo que resta en la ganancia neta', icon: 'card', group: 'finanzas' },
  { id: 'suppliers', label: 'Proveedores', subtitle: 'Compras y origen del stock', icon: 'store', group: 'finanzas' },
  { id: 'reports', label: 'Reportes', subtitle: 'Ventas, stock, canjes, clientes y servicio', icon: 'bars', group: 'analisis' },
  { id: 'commissions', label: 'Comisiones', ownLabel: 'Mis comisiones', subtitle: 'Vendedores y pagos', ownSubtitle: 'Solo las tuyas, de este mes', icon: 'comisiones', group: 'analisis' },
  { id: 'history', label: 'Historial', subtitle: 'Quién hizo qué y cuándo', icon: 'clock', group: 'analisis' },
  { id: 'notifications', label: 'Notificaciones', subtitle: 'Avisos de la tienda', icon: 'bell', group: 'cuenta' },
  { id: 'help', label: 'Ayuda', subtitle: 'Guías y primeros pasos', icon: 'help', group: 'cuenta' },
  { id: 'settings', label: 'Configuración', subtitle: 'Tienda, equipo y tu cuenta', icon: 'gear', group: 'cuenta' },
];

const GROUP_IDS = new Set(NAV_GROUPS.map((group) => group.id));

export function sectionAllowed(id: DeskTab, stored: string[] | null | undefined, role?: string | null) {
  if (id === 'billing') return role === 'OWNER';
  if (id === 'expenses') return role === 'OWNER';
  if (id === 'suppliers' || id === 'stockCount') return canOpenSection('inventory', stored, role);
  if (id === 'returns') return canOpenSection('sales', stored, role);
  if (id === 'followups') return canOpenSection('clients', stored, role);
  if (id === 'history') return canOpenHistory(stored, role);
  if (id === 'help' || id === 'more' || id === 'settings') return true;
  return canOpenSection(id, stored, role);
}

export function navSection(id: DeskTab) {
  return NAV_SECTIONS.find((section) => section.id === id);
}

export function groupOf(id: DeskTab): NavGroupId | null {
  const group = navSection(id)?.group;
  return group && group !== 'cuenta' ? group : null;
}

export type NavLink = {
  id: DeskTab;
  label: string;
  subtitle: string;
  icon: NavIcon;
};

export type NavBlock =
  | { kind: 'link'; item: NavLink }
  | { kind: 'group'; id: NavGroupId; label: string; icon: NavIcon; items: NavLink[] };

function linkFor(id: DeskTab, ownCommissions: boolean): NavLink {
  const section = navSection(id)!;
  const own = id === 'commissions' && ownCommissions;
  return {
    id,
    label: own && section.ownLabel ? section.ownLabel : section.label,
    subtitle: own && section.ownSubtitle ? section.ownSubtitle : section.subtitle,
    icon: section.icon,
  };
}

/** Comisiones queda suelta cuando es la única sección de Análisis. */
/** Chips de la página: las secciones del mismo grupo, si hay al menos dos. */
export function pageTabs(tab: DeskTab, stored: string[] | null | undefined, role?: string | null) {
  const section = navSection(tab);
  if (!section?.group) return [];
  if (section.group !== 'cuenta' && commissionsStandalone(stored, role) && tab === 'commissions') return [];
  const own = !canManageCommissions(stored, role);
  const items = section.group === 'cuenta'
    ? NAV_SECTIONS.filter((item) => item.group === 'cuenta' && sectionAllowed(item.id, stored, role)).map((item) => linkFor(item.id, own))
    : desktopNav(stored, role).main.flatMap((block) => (block.kind === 'group' && block.id === section.group ? block.items : []));
  return items.length > 1 ? items : [];
}

export function commissionsStandalone(stored: string[] | null | undefined, role?: string | null) {
  const analisis = NAV_SECTIONS.filter((section) => section.group === 'analisis' && sectionAllowed(section.id, stored, role));
  return analisis.length === 1 && analisis[0]?.id === 'commissions';
}

export function desktopNav(stored: string[] | null | undefined, role?: string | null) {
  const own = !canManageCommissions(stored, role);
  const standalone = commissionsStandalone(stored, role);
  const main: NavBlock[] = [];
  if (sectionAllowed('dashboard', stored, role)) main.push({ kind: 'link', item: linkFor('dashboard', own) });
  if (standalone) main.push({ kind: 'link', item: linkFor('commissions', true) });
  for (const group of NAV_GROUPS) {
    const items = NAV_SECTIONS
      .filter((section) => section.group === group.id)
      .filter((section) => !(standalone && section.id === 'commissions'))
      .filter((section) => sectionAllowed(section.id, stored, role))
      .map((section) => linkFor(section.id, own));
    if (items.length) main.push({ kind: 'group', id: group.id, label: group.label, icon: group.icon, items });
  }
  const cuenta = NAV_SECTIONS
    .filter((section) => section.group === 'cuenta' && sectionAllowed(section.id, stored, role))
    .map((section) => linkFor(section.id, own));
  return { main, cuenta };
}

export type PendingInput = {
  unread: { inventory: number; sales: number; tradeins: number; clients: number };
  openTrades: number;
  openRepairs: number;
  followUps: number;
  notifications: number;
  commissions: number;
};

export const EMPTY_PENDING: PendingInput = {
  unread: { inventory: 0, sales: 0, tradeins: 0, clients: 0 },
  openTrades: 0,
  openRepairs: 0,
  followUps: 0,
  notifications: 0,
  commissions: 0,
};

export function sectionPending(id: DeskTab, input: PendingInput) {
  if (id === 'inventory') return input.unread.inventory;
  if (id === 'sales') return input.unread.sales;
  if (id === 'clients') return input.unread.clients;
  if (id === 'tradeins') return input.openTrades;
  if (id === 'service') return input.openRepairs;
  if (id === 'followups') return input.followUps;
  if (id === 'notifications') return input.notifications;
  if (id === 'commissions') return input.commissions;
  return 0;
}

export function groupPending(ids: DeskTab[], input: PendingInput) {
  return ids.reduce((sum, id) => sum + Math.max(0, sectionPending(id, input)), 0);
}

export const MOBILE_BAR: { id: DeskTab; label: string; group: NavGroupId | null; icon: NavIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', group: null, icon: 'grid' },
  { id: 'sales', label: 'Ventas', group: 'comercial', icon: 'cart' },
  { id: 'inventory', label: 'Equipos', group: 'stock', icon: 'list' },
  { id: 'clients', label: 'Clientes', group: 'atencion', icon: 'user' },
];

export type MobileBarSlot = {
  id: DeskTab;
  label: string;
  icon: NavIcon;
  testId: string;
  target: DeskTab;
  activeIds: DeskTab[];
};

export function mobileBar(stored: string[] | null | undefined, role?: string | null): MobileBarSlot[] {
  const nav = desktopNav(stored, role);
  return MOBILE_BAR.flatMap((slot) => {
    if (!slot.group) {
      return sectionAllowed(slot.id, stored, role)
        ? [{ id: slot.id, label: slot.label, icon: slot.icon, testId: `sidebar-tab-${slot.id}`, target: slot.id, activeIds: [slot.id] }]
        : [];
    }
    const group = nav.main.find((block) => block.kind === 'group' && block.id === slot.group);
    if (!group || group.kind !== 'group' || group.items.length === 0) return [];
    const target = group.items.some((item) => item.id === slot.id) ? slot.id : group.items[0]!.id;
    return [{
      id: slot.id,
      label: slot.label,
      icon: slot.icon,
      testId: `sidebar-tab-${slot.id}`,
      target,
      activeIds: group.items.map((item) => item.id),
    }];
  });
}

export function barOwns(tab: DeskTab, slots: MobileBarSlot[]) {
  return slots.some((slot) => slot.activeIds.includes(tab));
}

const BAR_TEST_IDS = new Set<DeskTab>(['dashboard', 'sales', 'inventory', 'clients']);

/** En Más, los ítems de la barra usan otro id para no duplicar el de la barra. */
export function moreTestId(id: DeskTab) {
  return BAR_TEST_IDS.has(id) ? `more-item-${id}` : `sidebar-tab-${id}`;
}

export function openGroupsKey(userId: string) {
  return `imanager.nav.open-groups:${userId || 'local'}`;
}

export function readOpenGroups(raw: string | null): NavGroupId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is NavGroupId => typeof id === 'string' && GROUP_IDS.has(id as NavGroupId));
  } catch {
    return [];
  }
}

export function visibleOpenGroups(stored: NavGroupId[], active: NavGroupId | null) {
  const open = new Set(stored);
  if (active) open.add(active);
  return open;
}

export function toggleOpenGroup(stored: NavGroupId[], id: NavGroupId, active: NavGroupId | null) {
  if (id === active) return stored;
  return stored.includes(id) ? stored.filter((item) => item !== id) : [...stored, id];
}

export function accessLabel(tab: DeskTab) {
  return navSection(tab)?.label ?? (tab === 'billing' ? 'Plan y facturación' : tab);
}
