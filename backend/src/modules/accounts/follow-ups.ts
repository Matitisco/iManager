import { addDaysYmd, cents, fromCents, monthDayWithin } from "./ledger.js";

export type FollowUpKind = "CUMPLEANOS" | "GARANTIA" | "DEUDA" | "INACTIVO";

export type FollowUpSettings = {
  birthdayLeadDays: number;
  warrantyMonths: number;
  warrantyLeadDays: number;
  inactiveDays: number;
  includeDebts: boolean;
};

export type FollowUpCard = {
  id: string;
  kind: FollowUpKind;
  clientId: string;
  name: string;
  phone: string;
  title: string;
  detail: string;
  amount: number | null;
  dueDate: string | null;
  lastPurchaseAt: string | null;
  warrantyEndsAt: string | null;
  deviceLabel: string | null;
  currency: string | null;
  installmentSequence: number | null;
  installmentCount: number | null;
  birthdayOn: string | null;
  turningAge: number | null;
  warrantyDays: number | null;
};

export type FollowUpGroup = {
  kind: FollowUpKind;
  count: number;
  totalAmount: number | null;
  currency: string | null;
};

export type FollowUpClient = {
  id: string;
  name: string;
  phone: string;
  birthday: string | null;
  lastPurchaseAt: string | null;
};

export type FollowUpWarranty = {
  saleId: string;
  clientId: string;
  name: string;
  phone: string;
  deviceLabel: string | null;
  soldOn: string;
  warrantyDays: number;
};

export type FollowUpDebtLine = {
  source: "VENTA" | "REPARACION" | "MANUAL";
  openedAt: string;
  installments: Array<{ sequence: number; dueDate: string; status: string }>;
};

export type FollowUpDebt = {
  clientId: string;
  name: string;
  phone: string;
  amount: number;
  currency: string | null;
  lines: FollowUpDebtLine[];
};

const ORDER: FollowUpKind[] = ["DEUDA", "CUMPLEANOS", "GARANTIA", "INACTIVO"];
const TITLE: Record<FollowUpKind, string> = {
  DEUDA: "Deuda pendiente",
  CUMPLEANOS: "Cumpleaños",
  GARANTIA: "Garantía por vencer",
  INACTIVO: "Hace tiempo no compra",
};

function blank(kind: FollowUpKind, id: string, clientId: string, name: string, phone: string): FollowUpCard {
  return {
    id,
    kind,
    clientId,
    name,
    phone,
    title: TITLE[kind],
    detail: "",
    amount: null,
    dueDate: null,
    lastPurchaseAt: null,
    warrantyEndsAt: null,
    deviceLabel: null,
    currency: null,
    installmentSequence: null,
    installmentCount: null,
    birthdayOn: null,
    turningAge: null,
    warrantyDays: null,
  };
}

export function birthdayOccurrence(birthdayYmd: string, todayYmd: string, leadDays: number): string | null {
  if (!monthDayWithin(birthdayYmd, todayYmd, leadDays)) return null;
  const [, month, day] = birthdayYmd.split("-");
  const lead = Math.max(0, leadDays);
  for (let offset = 0; offset <= lead; offset += 1) {
    const cursor = addDaysYmd(todayYmd, offset);
    const [, cursorMonth, cursorDay] = cursor.split("-");
    if (cursorMonth === month && cursorDay === day) return cursor;
  }
  return null;
}

export function turningAge(birthdayYmd: string, occurrence: string): number | null {
  const birthYear = Number(birthdayYmd.slice(0, 4));
  const year = Number(occurrence.slice(0, 4));
  if (!Number.isInteger(birthYear) || !Number.isInteger(year)) return null;
  const age = year - birthYear;
  if (age < 1 || age > 120) return null;
  return age;
}

/** Next unpaid installment, or the date the account balance started. Repairs stay out of the account. */
export function debtSchedule(lines: FollowUpDebtLine[]): { dueDate: string | null; installmentSequence: number | null; installmentCount: number | null } {
  const account = lines.filter((line) => line.source !== "REPARACION");
  const since = account.map((line) => line.openedAt).filter(Boolean).sort()[0] ?? null;
  let installment: { sequence: number; count: number; dueDate: string } | null = null;
  for (const line of account) {
    const open = line.installments.filter((item) => item.status !== "PAGADA");
    if (!open.length) continue;
    const next = [...open].sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.sequence - right.sequence)[0];
    if (!next) continue;
    const candidate = { sequence: next.sequence, count: line.installments.length, dueDate: next.dueDate };
    if (!installment || candidate.dueDate < installment.dueDate || (candidate.dueDate === installment.dueDate && candidate.sequence < installment.sequence)) {
      installment = candidate;
    }
  }
  if (installment) {
    return { dueDate: installment.dueDate, installmentSequence: installment.sequence, installmentCount: installment.count };
  }
  return { dueDate: since, installmentSequence: null, installmentCount: null };
}

function dayMonth(ymd: string) {
  const [, month, day] = ymd.split("-");
  return `${day}/${month}`;
}

export function sortFollowUps(cards: FollowUpCard[]): FollowUpCard[] {
  const rank = new Map(ORDER.map((kind, index) => [kind, index]));
  return [...cards].sort((left, right) => {
    const kind = (rank.get(left.kind) ?? 0) - (rank.get(right.kind) ?? 0);
    if (kind) return kind;
    if (left.kind === "DEUDA") return (right.amount ?? 0) - (left.amount ?? 0) || left.name.localeCompare(right.name, "es");
    if (left.kind === "CUMPLEANOS") return (left.birthdayOn ?? "").localeCompare(right.birthdayOn ?? "") || left.name.localeCompare(right.name, "es");
    if (left.kind === "GARANTIA") return (left.warrantyEndsAt ?? "").localeCompare(right.warrantyEndsAt ?? "") || left.name.localeCompare(right.name, "es");
    return (right.lastPurchaseAt ?? "").localeCompare(left.lastPurchaseAt ?? "") || left.name.localeCompare(right.name, "es");
  });
}

export function groupFollowUps(cards: FollowUpCard[]): FollowUpGroup[] {
  const groups = new Map<FollowUpKind, FollowUpGroup & { started: boolean }>();
  for (const card of cards) {
    let group = groups.get(card.kind);
    if (!group) {
      group = { kind: card.kind, count: 0, totalAmount: null, currency: null, started: false };
      groups.set(card.kind, group);
    }
    group.count += 1;
    if (card.kind !== "DEUDA" || card.amount == null) continue;
    if (!group.started) {
      group.totalAmount = card.amount;
      group.currency = card.currency;
      group.started = true;
      continue;
    }
    if (group.totalAmount != null && group.currency === card.currency) {
      group.totalAmount = fromCents(cents(group.totalAmount) + cents(card.amount));
    } else {
      group.totalAmount = null;
      group.currency = null;
    }
  }
  return ORDER.flatMap((kind) => {
    const group = groups.get(kind);
    return group ? [{ kind: group.kind, count: group.count, totalAmount: group.totalAmount, currency: group.currency }] : [];
  });
}

export function assembleFollowUps(input: {
  today: string;
  settings: FollowUpSettings;
  clients: FollowUpClient[];
  warranties: FollowUpWarranty[];
  debts: FollowUpDebt[];
  devices: Array<{ clientId: string; deviceLabel: string | null }>;
}): { cards: FollowUpCard[]; groups: FollowUpGroup[] } {
  const active = new Set(input.clients.map((client) => client.id));
  const deviceByClient = new Map(input.devices.map((row) => [row.clientId, row.deviceLabel]));
  const cards: FollowUpCard[] = [];
  const cutoff = addDaysYmd(input.today, -input.settings.inactiveDays);

  for (const client of input.clients) {
    if (client.birthday) {
      const birthdayOn = birthdayOccurrence(client.birthday, input.today, input.settings.birthdayLeadDays);
      if (birthdayOn) {
        const card = blank("CUMPLEANOS", `birthday-${client.id}`, client.id, client.name, client.phone);
        card.birthdayOn = birthdayOn;
        card.turningAge = turningAge(client.birthday, birthdayOn);
        card.detail = card.turningAge ? `Cumple ${card.turningAge}` : `Cumple el ${dayMonth(birthdayOn)}`;
        cards.push(card);
      }
    }
    if (client.lastPurchaseAt && client.lastPurchaseAt < cutoff) {
      const card = blank("INACTIVO", `inactive-${client.id}`, client.id, client.name, client.phone);
      card.lastPurchaseAt = client.lastPurchaseAt;
      card.deviceLabel = deviceByClient.get(client.id) ?? null;
      const [year, month, day] = client.lastPurchaseAt.split("-");
      card.detail = card.deviceLabel ? `Última compra ${day}/${month}/${year} · ${card.deviceLabel}` : `Última compra ${day}/${month}/${year}`;
      cards.push(card);
    }
  }

  if (input.settings.includeDebts) {
    for (const debt of input.debts) {
      if (!active.has(debt.clientId) || !(debt.amount > 0)) continue;
      const schedule = debtSchedule(debt.lines);
      const card = blank("DEUDA", `debt-${debt.clientId}`, debt.clientId, debt.name, debt.phone);
      card.amount = debt.amount;
      card.currency = debt.currency;
      card.dueDate = schedule.dueDate;
      card.installmentSequence = schedule.installmentSequence;
      card.installmentCount = schedule.installmentCount;
      card.detail = schedule.installmentSequence && schedule.installmentCount && schedule.dueDate
        ? `Cuota ${schedule.installmentSequence} de ${schedule.installmentCount} · vence ${dayMonth(schedule.dueDate)}`
        : schedule.dueDate ? `Debe desde el ${dayMonth(schedule.dueDate)}` : debt.name;
      cards.push(card);
    }
  }

  const until = addDaysYmd(input.today, input.settings.warrantyLeadDays);
  for (const sale of input.warranties) {
    if (!active.has(sale.clientId) || !(sale.warrantyDays > 0)) continue;
    const warrantyEndsAt = addDaysYmd(sale.soldOn, sale.warrantyDays);
    if (warrantyEndsAt < input.today || warrantyEndsAt > until) continue;
    const card = blank("GARANTIA", `warranty-${sale.saleId}`, sale.clientId, sale.name, sale.phone);
    card.warrantyEndsAt = warrantyEndsAt;
    card.warrantyDays = sale.warrantyDays;
    card.deviceLabel = sale.deviceLabel;
    card.detail = `${sale.deviceLabel || "Garantía"} · vence ${dayMonth(warrantyEndsAt)}`;
    cards.push(card);
  }

  const sorted = sortFollowUps(cards);
  return { cards: sorted, groups: groupFollowUps(sorted) };
}
