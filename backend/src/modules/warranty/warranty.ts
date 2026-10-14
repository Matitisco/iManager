export const MAX_WARRANTY_DAYS = 3650;
export const DEFAULT_USED_WARRANTY_DAYS = 30;
export const DEFAULT_SEALED_WARRANTY_DAYS = 90;
export const DEFAULT_REPAIR_WARRANTY_DAYS = 30;

export type WarrantyState = "sin" | "pendiente" | "vigente" | "vencida";

export interface WarrantySettings {
  usedWarrantyDays: number;
  sealedWarrantyDays: number;
}

export function isSealedCondition(condition: string | null | undefined) {
  const key = (condition ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return key === "nuevo" || key === "sellado" || key === "sealed" || key === "new";
}

export function defaultSaleWarrantyDays(condition: string | null | undefined, settings: WarrantySettings) {
  return isSealedCondition(condition) ? settings.sealedWarrantyDays : settings.usedWarrantyDays;
}

export function saleDaysFromStore(
  explicit: number | undefined,
  condition: string | null | undefined,
  store: { usedWarrantyDays?: number | null; sealedWarrantyDays?: number | null } | null,
) {
  if (explicit !== undefined) return explicit;
  return defaultSaleWarrantyDays(condition, {
    usedWarrantyDays: store?.usedWarrantyDays ?? DEFAULT_USED_WARRANTY_DAYS,
    sealedWarrantyDays: store?.sealedWarrantyDays ?? DEFAULT_SEALED_WARRANTY_DAYS,
  });
}

export function repairDaysFromStore(explicit: number | undefined, store: { repairWarrantyDays?: number | null } | null) {
  if (explicit !== undefined) return explicit;
  return store?.repairWarrantyDays ?? DEFAULT_REPAIR_WARRANTY_DAYS;
}

export function addCalendarDays(start: Date, days: number) {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days, 12, 0, 0, 0);
}

export function warrantyUntil(start: Date | null, days: number | null | undefined) {
  if (!start || days == null || days <= 0) return null;
  return addCalendarDays(start, days);
}

export function coverageState(until: Date | null, now = new Date(), pending = false): WarrantyState {
  if (pending) return "pendiente";
  if (!until) return "sin";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const end = new Date(until.getFullYear(), until.getMonth(), until.getDate(), 12, 0, 0, 0);
  return end.getTime() >= today.getTime() ? "vigente" : "vencida";
}
