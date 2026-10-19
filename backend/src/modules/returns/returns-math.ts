export const RESOLUTIONS = ["REPARACION", "CAMBIO", "REINTEGRO"] as const;
export const SETTLEMENTS = ["REINTEGRO", "NOTA_CREDITO", "NINGUNO"] as const;
export const DESTINATIONS = ["STOCK", "PROVEEDOR", "CLIENTE"] as const;
export const RMA_STATUSES = ["ENVIADO", "EN_REVISION", "APROBADO", "RECHAZADO", "RECIBIDO"] as const;

export type Resolution = (typeof RESOLUTIONS)[number];
export type Settlement = (typeof SETTLEMENTS)[number];
export type Destination = (typeof DESTINATIONS)[number];
export type RmaStatus = (typeof RMA_STATUSES)[number];
export type MoneyCurrency = "ARS" | "USD";

export interface CreditSlice {
  id: string;
  remaining: number;
  currency: MoneyCurrency;
}

export interface CreditApplicationPlan {
  id: string;
  noteAmount: number;
  saleAmount: number;
}

const BLOCKED_STOCK = new Set(["VENDIDO", "RESERVADO"]);

export function returnCode(caseNumber: number) {
  return `RMA-${String(caseNumber).padStart(4, "0")}`;
}

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function resolutionError(input: {
  resolution: Resolution;
  settlement: Settlement;
  amount: number;
  destination: Destination;
}) {
  if (input.resolution === "REPARACION" && input.destination === "STOCK") {
    return "Una reparación no vuelve a poner el equipo a la venta. Elegí devolverlo al cliente o mandarlo al proveedor.";
  }
  if (input.resolution !== "REPARACION" && input.destination === "CLIENTE") {
    return "En un cambio o un reintegro el equipo vuelve al stock o se manda al proveedor.";
  }
  if (input.settlement === "NINGUNO" && input.amount !== 0) {
    return "Sin movimiento de plata el importe tiene que ser cero.";
  }
  if (input.settlement !== "NINGUNO" && !(input.amount > 0)) {
    return "El importe tiene que ser mayor a cero.";
  }
  if ((input.resolution === "REINTEGRO" || input.resolution === "CAMBIO") && input.settlement === "NINGUNO") {
    return "Un cambio o un reintegro necesita un reintegro en caja o una nota de crédito.";
  }
  if (input.resolution === "REPARACION" && input.settlement !== "NINGUNO") {
    return "La reparación en garantía no mueve plata. Si hay que devolver dinero, elegí reintegro.";
  }
  return null;
}

export function stockStatusForReturn(current: string, previous: string | null, next: string) {
  const status = next.trim().toUpperCase().replace(/\s+/g, "_");
  if (!status || status.length > 20) return { ok: false as const, message: "Elegí un estado para el equipo." };
  if (BLOCKED_STOCK.has(status)) return { ok: false as const, message: "El equipo devuelto no puede quedar vendido ni reservado." };
  if (status === current) return { ok: false as const, message: "Elegí un estado distinto al que tiene ahora." };
  if (previous && status === previous) return { ok: false as const, message: "Elegí un estado distinto al que tenía antes de la venta." };
  return { ok: true as const, status };
}

export function refundableAmount(sale: { status: string; amount: number; openBalance: number | null } | null) {
  if (!sale || sale.status !== "COMPLETADA") return 0;
  if (sale.openBalance == null) return roundMoney(Math.max(0, sale.amount));
  return roundMoney(Math.max(0, sale.amount - sale.openBalance));
}

/** How much of each note is spent, in the note currency and in the sale currency. */
export function planCreditApplication(input: {
  due: number;
  currency: MoneyCurrency;
  rate: number | null;
  notes: CreditSlice[];
}): { ok: true; applications: CreditApplicationPlan[]; covered: number } | { ok: false; message: string } {
  let left = roundMoney(Math.max(0, input.due));
  const applications: CreditApplicationPlan[] = [];
  for (const note of input.notes) {
    if (left <= 0) break;
    const remaining = roundMoney(note.remaining);
    if (remaining <= 0) continue;
    if (note.currency === input.currency) {
      const saleAmount = roundMoney(Math.min(remaining, left));
      if (saleAmount <= 0) continue;
      applications.push({ id: note.id, noteAmount: saleAmount, saleAmount });
      left = roundMoney(left - saleAmount);
      continue;
    }
    if (input.rate == null || !(input.rate > 0)) {
      return { ok: false, message: "Falta la cotización para aplicar una nota de crédito en otra moneda." };
    }
    const fullSale = note.currency === "USD" ? remaining * input.rate : remaining / input.rate;
    const saleAmount = roundMoney(Math.min(fullSale, left));
    const noteAmount = roundMoney(note.currency === "USD" ? saleAmount / input.rate : saleAmount * input.rate);
    const spent = roundMoney(Math.min(noteAmount, remaining));
    if (saleAmount <= 0 || spent <= 0) continue;
    applications.push({ id: note.id, noteAmount: spent, saleAmount });
    left = roundMoney(left - saleAmount);
  }
  const covered = roundMoney(applications.reduce((total, row) => total + row.saleAmount, 0));
  return { ok: true, applications, covered };
}

/** Revenue and cost that leave the period when a change or refund is resolved. */
export function returnReversal(row: { saleAmount: number; moneyAmount: number; itemCost: number }) {
  const base = row.saleAmount > 0 ? row.saleAmount : row.moneyAmount;
  const ratio = base > 0 ? Math.min(1, row.moneyAmount / base) : 0;
  return { amount: roundMoney(row.moneyAmount), cost: roundMoney(row.itemCost * ratio) };
}
