import { actionMeta, actionsForSection } from '../audit/audit-actions.js';

export const HISTORY_TYPES = ['create', 'delete', 'update', 'connection'] as const;
export type HistoryType = typeof HISTORY_TYPES[number];
export type ActionDescription = { type: HistoryType; text: string; operation: string };
export const PRODUCT_ACTIONS: Record<string, ActionDescription> = {
  active_day: { type: 'connection', text: 'Se conectó', operation: 'connection' },
  invite_created: { type: 'create', text: 'Invitó a un empleado', operation: 'invite' },
  invite_accepted: { type: 'create', text: 'Se sumó al equipo', operation: 'join' },
  stock_import_finished: { type: 'create', text: 'Cargó equipos', operation: 'import' },
  sample_stock_loaded: { type: 'create', text: 'Cargó equipos de ejemplo', operation: 'sample' },
  sample_stock_deleted: { type: 'delete', text: 'Borró los equipos de ejemplo', operation: 'sample_deleted' },
};
export const POSTHOG_ACTIONS: Record<string, ActionDescription> = {
  sale_created: { type: 'create', text: 'Registró una venta', operation: 'sale' },
  excel_import_succeeded: { type: 'create', text: 'Cargó equipos por Excel', operation: 'import' },
  employee_invite_sent: PRODUCT_ACTIONS.invite_created,
  employee_invite_accepted: PRODUCT_ACTIONS.invite_accepted,
  trade_in_created: { type: 'create', text: 'Registró un canje', operation: 'trade' },
  user_logged_in: PRODUCT_ACTIONS.active_day,
};
const titles: Record<string, string> = {
  'inventory.deleted': 'Borró un equipo', 'sale.deleted': 'Borró una venta', 'client.deleted': 'Borró un cliente',
  'trade.deleted': 'Borró un canje', 'repair.deleted': 'Borró una reparación',
  'repair.created': 'Registró una reparación', 'repair.updated': 'Editó una reparación',
  'repair.archived': 'Archivó una reparación', 'repair.restored': 'Restauró una reparación',
  'repair.status': 'Cambió el estado de una reparación', 'repair.estimate': 'Editó el presupuesto de una reparación',
  'return.created': 'Registró una devolución', 'return.updated': 'Editó una devolución',
  'return.diagnosis': 'Cargó un diagnóstico de una devolución', 'return.resolved': 'Resolvió una devolución',
  'return.rma': 'Actualizó el RMA de una devolución', 'return.cancelled': 'Anuló una devolución',
  'return.archived': 'Archivó una devolución', 'return.restored': 'Restauró una devolución',
  'inventory.price': 'Cambió el precio de un equipo', 'inventory.cost': 'Cambió el costo de un equipo',
  'inventory.status': 'Cambió el estado de un equipo', 'inventory.moved': 'Cambió la categoría de un equipo',
  'inventory.supplier': 'Cambió el proveedor de un equipo', 'sale.seller.changed': 'Cambió el vendedor de una venta',
  'member.invited': 'Invitó a un empleado', 'member.joined': 'Se sumó al equipo',
  'member.removed': 'Quitó a un empleado', 'member.role': 'Cambió el rol de un empleado',
  'member.permissions': 'Cambió los permisos de un empleado', 'invitation.cancelled': 'Canceló una invitación',
  'catalog.visibility': 'Cambió la visibilidad del catálogo',
};
// Explicit catalog: unknown actions and other modules never enter this history.
const supported = [
  ...['inventory', 'sales', 'clients', 'tradeins', 'service', 'returns', 'settings'].flatMap(s => actionsForSection(s) ?? []),
  'return.updated', 'return.cancelled', 'repair.estimate',
].filter(a => !a.startsWith('stockcount.') && !['sale.payment', 'client.payment', 'client.deposit', 'credit.applied'].includes(a));
const isDelete = (action: string) => /\.(archived|deleted|cancelled|voided|removed)$/.test(action);
const isCreate = (action: string) => /\.(created|imported|invited|joined)$/.test(action);
// Field names only. Labels and values stored with the record may contain private/free-form content.
const fields: Record<string, string> = {
  model: 'Modelo', capacity: 'Capacidad', color: 'Color', condition: 'Condición', grade: 'Calidad',
  batteryHealth: 'Batería', imei: 'IMEI', status: 'Estado', price: 'Precio', cost: 'Costo', cantidad: 'Cantidad',
  categoryId: 'Categoría', supplierId: 'Proveedor', name: 'Nombre', dni: 'DNI', phone: 'Teléfono', email: 'Email',
  instagram: 'Instagram', tag: 'Etiqueta', amount: 'Importe', total: 'Total', currency: 'Moneda',
  exchangeRate: 'Cotización', sellerMemberId: 'Vendedor', clientId: 'Cliente', date: 'Fecha', openedOn: 'Fecha',
  diagnosis: 'Diagnóstico', reason: 'Motivo', notes: 'Notas', estimate: 'Presupuesto', estimatedCost: 'Presupuesto',
  role: 'Rol', permissions: 'Permisos', customFields: 'Campos personalizados', legalName: 'Razón social',
  taxId: 'CUIT', address: 'Dirección', timezone: 'Zona horaria', logoUrl: 'Logo', visibility: 'Visibilidad',
};
export function auditDescription(action: string, changedFields?: unknown): ActionDescription | null {
  if (!supported.includes(action)) return null;
  const type = isDelete(action) ? 'delete' : isCreate(action) ? 'create' : 'update';
  const labels = type === 'update' && Array.isArray(changedFields)
    ? [...new Set(changedFields.flatMap(f => typeof f === 'string' && Object.hasOwn(fields, f) ? [fields[f]] : []))] : [];
  return { type, text: `${titles[action] ?? actionMeta(action).title}${labels.length ? ` · Campos: ${labels.join(', ')}` : ''}`,
    operation: ({ 'sale.created': 'sale', 'member.invited': 'invite', 'member.joined': 'join', 'inventory.imported': 'import' } as Record<string, string>)[action] ?? action };
}
export function auditActions(type?: HistoryType): string[] {
  return [...new Set(supported)].filter(a => !type || auditDescription(a)?.type === type);
}
export function eventDescription(name: string, props: Record<string, unknown>, source: 'product' | 'posthog'): ActionDescription | null {
  const catalog = source === 'product' ? PRODUCT_ACTIONS : POSTHOG_ACTIONS;
  if (!Object.hasOwn(catalog, name)) return null;
  const base = catalog[name];
  if (name === 'excel_import_succeeded') {
    const count = props.rows;
    if (count === 0) return null;
    return { ...base, text: typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? `Cargó ${count} ${count === 1 ? 'equipo' : 'equipos'} por Excel` : base.text };
  }
  if (name === 'stock_import_finished') {
    if (props.ok !== true) return null;
    const rows = ({ '1': '1 equipo', '2-10': 'entre 2 y 10 equipos', '11-50': 'entre 11 y 50 equipos', '51+': '51 o más equipos' } as Record<string, string>)[String(props.rows)] ?? 'equipos';
    return { ...base, text: `Cargó ${rows}${props.method === 'excel' ? ' por Excel' : props.method === 'paste' ? ' pegando una lista' : props.method === 'manual' ? ' a mano' : ''}` };
  }
  return base;
}
export function historyRole(role: string | null | undefined): string | null {
  return ({ OWNER: 'Dueño', ADMIN: 'Socio', MANAGER: 'Socio', SELLER: 'Empleado', STAFF: 'Empleado' } as Record<string, string>)[role ?? ''] ?? null;
}
