export const AUDIT_GROUPS = [
  "Alta",
  "Edición",
  "Cambio de estado",
  "Anulación/Archivo",
  "Cobros",
  "Equipo y permisos",
] as const;

export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export const AUDIT_SECTIONS = [
  { id: "inventory", label: "Inventario" },
  { id: "sales", label: "Ventas" },
  { id: "clients", label: "Clientes" },
  { id: "tradeins", label: "Canjes" },
  { id: "service", label: "Servicio" },
  { id: "cash", label: "Cajas" },
  { id: "commissions", label: "Comisiones" },
  { id: "settings", label: "Configuración" },
] as const;

export type AuditSectionId = (typeof AUDIT_SECTIONS)[number]["id"];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propietario",
  MANAGER: "Socio",
  ADMIN: "Socio",
  STAFF: "Empleado",
  SELLER: "Empleado",
};

export function roleLabel(role: string | null | undefined) {
  if (!role) return null;
  return ROLE_LABEL[role] ?? role;
}

type ActionMeta = {
  title: string;
  group: AuditGroup;
  section: AuditSectionId;
  verb: string;
};

const ACTIONS: Record<string, ActionMeta> = {
  "inventory.created": { title: "Registró un equipo", group: "Alta", section: "inventory", verb: "registró" },
  "inventory.updated": { title: "Editó un equipo", group: "Edición", section: "inventory", verb: "editó" },
  "inventory.price": { title: "Cambió el precio", group: "Edición", section: "inventory", verb: "cambió el precio de" },
  "inventory.cost": { title: "Cambió el costo", group: "Edición", section: "inventory", verb: "cambió el costo de" },
  "inventory.status": { title: "Cambió el estado", group: "Cambio de estado", section: "inventory", verb: "cambió el estado de" },
  "inventory.archived": { title: "Archivó un equipo", group: "Anulación/Archivo", section: "inventory", verb: "archivó" },
  "inventory.restored": { title: "Restauró un equipo", group: "Anulación/Archivo", section: "inventory", verb: "restauró" },
  "inventory.moved": { title: "Movió de categoría", group: "Edición", section: "inventory", verb: "movió de categoría" },
  "inventory.imported": { title: "Importó equipos", group: "Alta", section: "inventory", verb: "importó equipos" },
  "inventory.deleted": { title: "Eliminó (antes del historial)", group: "Anulación/Archivo", section: "inventory", verb: "eliminó" },
  "sale.created": { title: "Registró una venta", group: "Alta", section: "sales", verb: "registró la venta" },
  "sale.updated": { title: "Editó una venta", group: "Edición", section: "sales", verb: "editó la venta" },
  "sale.cancelled": { title: "Canceló una venta", group: "Anulación/Archivo", section: "sales", verb: "canceló la venta" },
  "sale.voided": { title: "Anuló una venta", group: "Anulación/Archivo", section: "sales", verb: "anuló la venta" },
  "sale.deleted": { title: "Eliminó (antes del historial)", group: "Anulación/Archivo", section: "sales", verb: "eliminó" },
  "sale.payment": { title: "Registró un cobro", group: "Cobros", section: "sales", verb: "cobró" },
  "trade.created": { title: "Registró un canje", group: "Alta", section: "tradeins", verb: "registró el canje" },
  "trade.updated": { title: "Editó un canje", group: "Edición", section: "tradeins", verb: "editó el canje" },
  "trade.confirmed": { title: "Confirmó un canje", group: "Cambio de estado", section: "tradeins", verb: "confirmó el canje" },
  "trade.cancelled": { title: "Canceló un canje", group: "Anulación/Archivo", section: "tradeins", verb: "canceló el canje" },
  "trade.voided": { title: "Anuló un canje", group: "Anulación/Archivo", section: "tradeins", verb: "anuló el canje" },
  "trade.deleted": { title: "Eliminó (antes del historial)", group: "Anulación/Archivo", section: "tradeins", verb: "eliminó" },
  "client.created": { title: "Registró un cliente", group: "Alta", section: "clients", verb: "registró al cliente" },
  "client.updated": { title: "Editó un cliente", group: "Edición", section: "clients", verb: "editó al cliente" },
  "client.archived": { title: "Archivó un cliente", group: "Anulación/Archivo", section: "clients", verb: "archivó al cliente" },
  "client.restored": { title: "Restauró un cliente", group: "Anulación/Archivo", section: "clients", verb: "restauró al cliente" },
  "client.deleted": { title: "Eliminó (antes del historial)", group: "Anulación/Archivo", section: "clients", verb: "eliminó" },
  "client.payment": { title: "Registró un cobro", group: "Cobros", section: "clients", verb: "cobró en la cuenta de" },
  "client.deposit": { title: "Registró una seña", group: "Cobros", section: "clients", verb: "registró una seña de" },
  "repair.created": { title: "Registró una orden", group: "Alta", section: "service", verb: "registró la orden" },
  "repair.updated": { title: "Editó una orden", group: "Edición", section: "service", verb: "editó la orden" },
  "repair.status": { title: "Cambió el estado", group: "Cambio de estado", section: "service", verb: "cambió el estado de" },
  "repair.archived": { title: "Archivó una orden", group: "Anulación/Archivo", section: "service", verb: "archivó la orden" },
  "repair.restored": { title: "Restauró una orden", group: "Anulación/Archivo", section: "service", verb: "restauró la orden" },
  "repair.deleted": { title: "Eliminó (antes del historial)", group: "Anulación/Archivo", section: "service", verb: "eliminó" },
  "cash.opened": { title: "Abrió una caja", group: "Cobros", section: "cash", verb: "abrió" },
  "cash.closed": { title: "Cerró una caja", group: "Cobros", section: "cash", verb: "cerró" },
  "cash.movement": { title: "Registró un movimiento", group: "Cobros", section: "cash", verb: "registró un movimiento en" },
  "category.archived": { title: "Archivó una categoría", group: "Anulación/Archivo", section: "settings", verb: "archivó la categoría" },
  "category.restored": { title: "Restauró una categoría", group: "Anulación/Archivo", section: "settings", verb: "restauró la categoría" },
  "catalog.archived": { title: "Archivó una opción", group: "Anulación/Archivo", section: "settings", verb: "archivó la opción" },
  "member.invited": { title: "Envió una invitación", group: "Equipo y permisos", section: "settings", verb: "invitó a" },
  "member.joined": { title: "Se unió al equipo", group: "Equipo y permisos", section: "settings", verb: "se unió al equipo" },
  "member.removed": { title: "Quitó del equipo", group: "Equipo y permisos", section: "settings", verb: "quitó a" },
  "member.role": { title: "Cambió el rol", group: "Equipo y permisos", section: "settings", verb: "cambió el rol de" },
  "member.permissions": { title: "Cambió los permisos", group: "Equipo y permisos", section: "settings", verb: "cambió los permisos de" },
  "invitation.cancelled": { title: "Canceló una invitación", group: "Equipo y permisos", section: "settings", verb: "canceló la invitación de" },
  "store.updated": { title: "Editó la tienda", group: "Edición", section: "settings", verb: "editó los datos de" },
};

export function actionMeta(action: string): ActionMeta {
  if (ACTIONS[action]) return ACTIONS[action];
  const [prefix] = action.split(".");
  const section = (
    prefix === "sale" ? "sales"
      : prefix === "trade" ? "tradeins"
        : prefix === "repair" ? "service"
          : prefix === "client" ? "clients"
            : prefix === "inventory" ? "inventory"
              : prefix === "cash" ? "cash"
                : prefix === "commission" ? "commissions"
                  : "settings"
  ) as AuditSectionId;
  const legacy = action.endsWith(".deleted");
  return {
    title: legacy ? "Eliminó (antes del historial)" : "Registró un movimiento",
    group: legacy ? "Anulación/Archivo" : "Edición",
    section,
    verb: legacy ? "eliminó" : "actualizó",
  };
}

export function sectionLabel(section: string) {
  return AUDIT_SECTIONS.find((item) => item.id === section)?.label ?? section;
}

export function groupForAction(action: string): AuditGroup {
  return actionMeta(action).group;
}

const GROUP_MATCH: Record<AuditGroup, (action: string) => boolean> = {
  "Alta": (action) => actionMeta(action).group === "Alta",
  "Edición": (action) => actionMeta(action).group === "Edición",
  "Cambio de estado": (action) => actionMeta(action).group === "Cambio de estado",
  "Anulación/Archivo": (action) => actionMeta(action).group === "Anulación/Archivo",
  "Cobros": (action) => actionMeta(action).group === "Cobros",
  "Equipo y permisos": (action) => actionMeta(action).group === "Equipo y permisos",
};

export function actionsForGroup(group: string): string[] | null {
  if (!AUDIT_GROUPS.includes(group as AuditGroup)) return null;
  return Object.keys(ACTIONS).filter((action) => GROUP_MATCH[group as AuditGroup](action));
}

export function actionsForSection(section: string): string[] | null {
  if (!AUDIT_SECTIONS.some((item) => item.id === section)) return null;
  return Object.keys(ACTIONS).filter((action) => actionMeta(action).section === section);
}

type Change = { field: string; label: string; before: string | null; after: string | null };

export function hiddenChange(field: string) {
  return field.startsWith("_");
}

export function batchOf(changes: Change[] | null | undefined) {
  const id = changes?.find((change) => change.field === "_batchId")?.after ?? null;
  const size = Number(changes?.find((change) => change.field === "_batchSize")?.after ?? 0);
  return { id, size: Number.isFinite(size) ? size : 0 };
}

export function describeAudit(input: {
  action: string;
  entityLabel?: string | null;
  detail?: string | null;
  reason?: string | null;
  changes?: Change[] | null;
}) {
  const meta = actionMeta(input.action);
  const legacy = input.action.endsWith(".deleted");
  const label = (input.entityLabel || input.detail || "").trim();
  const batch = batchOf(input.changes);
  if (batch.size > 1 && input.action === "inventory.archived") {
    return {
      ...meta,
      title: "Archivó equipos",
      verb: "archivó",
      target: `${batch.size} equipos`,
      legacy: false,
      suffix: input.reason ? ` · ${input.reason}` : "",
    };
  }
  if (legacy) {
    const what = label || "un registro";
    return {
      ...meta,
      verb: "",
      target: `Eliminó ${what} (antes del historial)`,
      legacy: true,
      suffix: "",
    };
  }
  const price = input.changes?.find((change) => change.field === "price");
  const verb = input.action === "inventory.updated" && price ? "cambió el precio de" : meta.verb;
  const title = input.action === "inventory.updated" && price ? "Cambió el precio" : meta.title;
  const reason = input.reason?.trim();
  return {
    ...meta,
    title,
    verb,
    target: label,
    legacy: false,
    suffix: reason ? ` · ${reason}` : "",
  };
}
