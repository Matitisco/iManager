export const FIRST_STEPS = [
  { id: "store", title: "Datos de tu tienda", detail: "Nombre, logo y moneda" },
  { id: "stock", title: "Cargá tu stock", detail: "Pegá tu lista o subí un Excel" },
  { id: "sale", title: "Registrá tu primera venta", detail: "Con canje si hace falta" },
  { id: "team", title: "Invitá a tu equipo", detail: "Cada uno con sus permisos" },
  { id: "install", title: "Instalá la app", detail: "Abrila desde la pantalla de inicio" },
] as const;

export type FirstStepId = (typeof FIRST_STEPS)[number]["id"];

export interface FirstStepFlags {
  store: boolean;
  stock: boolean;
  sale: boolean;
  team: boolean;
  install: boolean;
}

export function canSeeFirstSteps(role?: string | null) {
  return role === "OWNER" || role === "MANAGER";
}

/** Eligibility for the dashboard; the island persists its dismissal after completion. */
export function firstStepsOnDashboard(
  state: { eligible: boolean; visible?: boolean } | null | undefined,
  role?: string | null,
) {
  if (!state || !canSeeFirstSteps(role)) return false;
  return state.eligible || Boolean(state.visible);
}

export function orderedFirstSteps(flags: FirstStepFlags) {
  return FIRST_STEPS.map((step) => ({ ...step, done: Boolean(flags[step.id]) }));
}

export function nextFirstStep<T extends { done: boolean }>(steps: T[]) {
  return steps.find((step) => !step.done) ?? null;
}

export function firstStepCount(steps: { done: boolean }[]) {
  const done = steps.filter((step) => step.done).length;
  return {
    done,
    total: steps.length,
    complete: steps.length > 0 && done === steps.length,
  };
}

const PERMISSION_LABELS: Record<string, string> = {
  sales: "Ventas",
  inventory: "Inventario",
  tradeins: "Canjes",
  clients: "Clientes",
  service: "Servicio técnico",
  cash: "Cajas",
  reports: "Reportes",
  dashboard: "Dashboard",
  notifications: "Notificaciones",
  commissions: "Comisiones",
  cashBalances: "Ver saldo de cajas",
};

const PERMISSION_ORDER = Object.keys(PERMISSION_LABELS);

export const INVITE_ROLE_SECTIONS: Record<"STAFF" | "MANAGER", string[]> = {
  STAFF: ["sales", "inventory", "tradeins"],
  MANAGER: ["dashboard", "inventory", "sales", "tradeins", "clients", "service", "cash", "reports", "notifications"],
};

export function permissionSummary(sections: string[]) {
  const labels = PERMISSION_ORDER.filter((id) => sections.includes(id)).map((id) => PERMISSION_LABELS[id]);
  if (labels.length === 0) return "Sin secciones";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
