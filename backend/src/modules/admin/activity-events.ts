import { actionMeta, actionsForSection, AUDIT_SECTIONS } from '../audit/audit-actions.js';

export const HISTORY_TYPES = ['inventory', 'sales', 'team', 'session', 'navigation', 'other'] as const;
export type HistoryType = typeof HISTORY_TYPES[number];
export type ActionDescription = { type: HistoryType; text: string; operation: string };
const pages: Record<string, string> = {
  dashboard: 'Dashboard', 'comercial/ventas': 'Ventas', 'comercial/canjes': 'Canjes',
  'comercial/devoluciones': 'Devoluciones', 'stock/equipos': 'Inventario', 'stock/control': 'Control de stock',
  'stock/catalogo': 'Catálogo', 'atencion/clientes': 'Clientes', 'atencion/servicio': 'Servicio técnico',
  'atencion/seguimientos': 'Seguimientos', 'finanzas/cajas': 'Cajas', 'finanzas/gastos': 'Gastos',
  'finanzas/proveedores': 'Proveedores', 'analisis/reportes': 'Reportes', 'analisis/historial': 'Historial',
  'analisis/comisiones': 'Comisiones', 'analisis/fallas': 'Fallas', 'analisis/resumen-periodico': 'Resumen periódico',
  'cuenta/configuracion': 'Configuración', 'cuenta/notificaciones': 'Notificaciones', 'cuenta/ayuda': 'Ayuda', plan: 'Mi plan',
};
export const PRODUCT_ACTIONS: Record<string, ActionDescription> = {
  signup: { type: 'session', text: 'Creó su cuenta', operation: 'signup' },
  active_day: { type: 'session', text: 'Entró a la app', operation: 'active_day' },
  first_sale: { type: 'sales', text: 'Hizo su primera venta', operation: 'first_sale' },
  invite_created: { type: 'team', text: 'Invitó a un empleado', operation: 'invite' },
  invite_accepted: { type: 'team', text: 'Se sumó al equipo', operation: 'join' },
  stock_import_finished: { type: 'inventory', text: 'Terminó una carga de equipos', operation: 'import' },
  stock_import_abandoned: { type: 'inventory', text: 'Cerró la carga sin guardar', operation: 'import_abandoned' },
  onboarding_name_completed: { type: 'other', text: 'Puso el nombre de la tienda', operation: 'store_name' },
  onboarding_completed: { type: 'other', text: 'Terminó la configuración inicial', operation: 'onboarding' },
  sample_stock_loaded: { type: 'inventory', text: 'Cargó equipos de ejemplo', operation: 'sample' },
  sample_stock_deleted: { type: 'inventory', text: 'Borró los equipos de ejemplo', operation: 'sample_deleted' },
  app_installed: { type: 'other', text: 'Instaló la app', operation: 'installed' },
  first_steps_finished: { type: 'other', text: 'Completó los primeros pasos', operation: 'steps' },
};
export const POSTHOG_ACTIONS: Record<string, ActionDescription> = {
  sale_created: { type: 'sales', text: 'Registró una venta', operation: 'sale' },
  excel_import_succeeded: { type: 'inventory', text: 'Cargó equipos por Excel', operation: 'import' },
  excel_import_failed: { type: 'inventory', text: 'La carga por Excel no terminó', operation: 'import_failed' },
  first_device_added: { type: 'inventory', text: 'Cargó su primer equipo', operation: 'first_device' },
  employee_invite_sent: PRODUCT_ACTIONS.invite_created,
  employee_invite_accepted: PRODUCT_ACTIONS.invite_accepted,
  trade_in_created: { type: 'other', text: 'Registró un canje', operation: 'trade' },
  signup_completed: PRODUCT_ACTIONS.signup,
  // Only actual authentication events may claim a login, never $identify or $pageview.
  user_logged_in: { type: 'session', text: 'Inició sesión', operation: 'login' },
  $pageview: { type: 'navigation', text: 'Abrió la app', operation: 'page' },
};
export function auditDescription(action: string): ActionDescription {
  const meta = actionMeta(action);
  const type = action.startsWith('member.') || action.startsWith('invitation.') ? 'team'
    : meta.section === 'inventory' ? 'inventory' : meta.section === 'sales' ? 'sales' : 'other';
  return { type, text: action === 'member.invited' ? 'Invitó a un empleado' : meta.title,
    operation: ({ 'sale.created': 'sale', 'member.invited': 'invite', 'member.joined': 'join', 'inventory.imported': 'import' } as Record<string, string>)[action] ?? action };
}
export function auditActions(type: HistoryType): string[] {
  return [...new Set(AUDIT_SECTIONS.flatMap(s => actionsForSection(s.id) ?? []))].filter(a => auditDescription(a).type === type);
}
export function eventDescription(name: string, props: Record<string, unknown>, source: 'product' | 'posthog'): ActionDescription | null {
  const base = (source === 'product' ? PRODUCT_ACTIONS : POSTHOG_ACTIONS)[name];
  if (!base) return null;
  if (name === '$pageview') {
    // Accept only canonical, known routes. Never render a URL, query, path ID or arbitrary title.
    let page: string | undefined;
    try { const url = new URL(String(props.url)); page = pages[url.hash.replace(/^#\//, '').split('?')[0]]; } catch { /* Generic visit. */ }
    return { ...base, text: page ? `Abrió ${page}` : base.text, operation: `page:${page ?? 'app'}` };
  }
  if (name === 'excel_import_succeeded') {
    const count = props.rows;
    return { ...base, text: typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? `Cargó ${count} ${count === 1 ? 'equipo' : 'equipos'} por Excel` : base.text };
  }
  if (name === 'stock_import_finished') {
    const rows = ({ '1': '1 equipo', '2-10': 'entre 2 y 10 equipos', '11-50': 'entre 11 y 50 equipos', '51+': '51 o más equipos' } as Record<string, string>)[String(props.rows)] ?? 'equipos';
    return { ...base, operation: props.ok === false ? 'import_failed' : base.operation, text: props.ok === false ? 'La carga de equipos no terminó' : `Cargó ${rows}${props.method === 'excel' ? ' por Excel' : props.method === 'paste' ? ' pegando una lista' : props.method === 'manual' ? ' a mano' : ''}` };
  }
  return base;
}
export function historyRole(role: string | null | undefined): string | null {
  return ({ OWNER: 'Dueño', ADMIN: 'Socio', MANAGER: 'Socio', SELLER: 'Empleado', STAFF: 'Empleado' } as Record<string, string>)[role ?? ''] ?? null;
}
