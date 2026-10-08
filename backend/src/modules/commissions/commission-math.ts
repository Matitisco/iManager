export const COMMISSION_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const COMMISSION_BASES = ["PERCENT_SALE", "PERCENT_PROFIT", "FIXED_PER_DEVICE"] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface RuleSnapshot {
  id: string;
  memberId: string | null;
  userId: string | null;
  basis: CommissionBasis;
  rate: number;
  includeAccessories: boolean;
  settlement: "MONTHLY";
  effectiveFrom: Date;
  createdAt: Date;
}

export interface SaleSnapshot {
  id: string;
  saleNumber: number;
  soldAt: Date;
  dateLabel: string;
  status: string;
  amount: number;
  deviceLabel: string;
  deviceCost: number;
  userId: string | null;
  accessories: { quantity: number; unitPrice: number; unitCost: number; voided: boolean }[];
}

export interface MemberSnapshot {
  memberId: string;
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
}

export interface PaymentSnapshot {
  memberId: string;
  paidAt: Date;
  amount: number;
}

export interface CommissionRuleView {
  basis: CommissionBasis;
  rate: number;
  includeAccessories: boolean;
  settlement: "MONTHLY";
  label: string;
  detail: string;
}

export interface CommissionSaleLine {
  id: string;
  code: string;
  date: string;
  device: string;
  accessoriesAmount: number;
  total: number;
  commission: number;
  soldAt: string;
}

export interface CommissionPerson {
  memberId: string;
  userId: string;
  name: string;
  role: MemberSnapshot["role"];
  salesCount: number;
  soldAmount: number;
  commission: number;
  rule: CommissionRuleView | null;
  paidAt: string | null;
  sales: CommissionSaleLine[];
}

export interface CommissionSummary {
  soldAmount: number;
  salesCount: number;
  commission: number;
  share: number;
  paidAmount: number;
  paidCount: number;
  peopleCount: number;
  pendingAmount: number;
  people: CommissionPerson[];
}

function timeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    hour,
    Number(bag.minute),
    Number(bag.second),
  );
  return asUtc - date.getTime();
}

export function zonedDayStart(year: number, month: number, day: number, timeZone = COMMISSION_TIME_ZONE) {
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = timeZoneOffsetMs(timeZone, noon);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offset);
}

function zonedParts(date: Date, timeZone = COMMISSION_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: bag.year ?? "", month: bag.month ?? "", day: bag.day ?? "" };
}

export function currentPeriodKey(now = new Date(), timeZone = COMMISSION_TIME_ZONE) {
  const parts = zonedParts(now, timeZone);
  return `${parts.year}-${parts.month}`;
}

export function monthBounds(key: string, now = new Date(), timeZone = COMMISSION_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const start = zonedDayStart(year, month, 1, timeZone);
  const end = month === 12 ? zonedDayStart(year + 1, 1, 1, timeZone) : zonedDayStart(year, month + 1, 1, timeZone);
  const closes = zonedParts(new Date(end.getTime() - 1), timeZone);
  const today = zonedParts(now, timeZone);
  return {
    key,
    start,
    end,
    label: `${MONTHS[month - 1]} ${year}`,
    closesLabel: `${closes.day}/${closes.month}`,
    current: today.year === String(year) && today.month === match[2],
  };
}

export function startOfZonedDay(date = new Date(), timeZone = COMMISSION_TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  return zonedDayStart(Number(parts.year), Number(parts.month), Number(parts.day), timeZone);
}

export function formatPesos(value: number) {
  return `$ ${new Intl.NumberFormat("es-AR").format(Math.round(value))}`;
}

function formatRate(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(".", ",");
}

export function ruleView(rule: Pick<RuleSnapshot, "basis" | "rate" | "includeAccessories" | "settlement">): CommissionRuleView {
  const label = rule.basis === "PERCENT_SALE"
    ? `${formatRate(rule.rate)}% sobre la venta`
    : rule.basis === "PERCENT_PROFIT"
      ? `${formatRate(rule.rate)}% sobre la ganancia`
      : `${formatPesos(rule.rate)} por equipo`;
  return {
    basis: rule.basis,
    rate: rule.rate,
    includeAccessories: rule.includeAccessories,
    settlement: "MONTHLY",
    label,
    detail: rule.includeAccessories ? "incluye accesorios" : "sin accesorios",
  };
}

export function splitSale(amount: number, accessories: SaleSnapshot["accessories"]) {
  const active = accessories.filter((line) => !line.voided);
  const accessoryRevenue = active.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const accessoryCost = active.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const accessoriesInTotal = Math.min(Math.max(accessoryRevenue, 0), Math.max(amount, 0));
  return {
    device: amount - accessoriesInTotal,
    accessoryRevenue: accessoriesInTotal,
    accessoryCost,
    total: amount,
  };
}

function latest(rules: RuleSnapshot[]) {
  return [...rules].sort((left, right) => (
    right.effectiveFrom.getTime() - left.effectiveFrom.getTime()
    || right.createdAt.getTime() - left.createdAt.getTime()
  ))[0] ?? null;
}

export function ruleForSale(rules: RuleSnapshot[], userId: string, soldAt: Date) {
  const applicable = (rule: RuleSnapshot) => rule.effectiveFrom.getTime() <= soldAt.getTime();
  const personal = rules.filter((rule) => rule.userId === userId && applicable(rule));
  if (personal.length) return latest(personal);
  return latest(rules.filter((rule) => rule.memberId == null && applicable(rule)));
}

export function currentRule(rules: RuleSnapshot[], memberId: string | null, now: Date) {
  return latest(rules.filter((rule) => (
    (memberId == null ? rule.memberId == null : rule.memberId === memberId)
    && rule.effectiveFrom.getTime() <= now.getTime()
  )));
}

export function commissionForSale(sale: SaleSnapshot, rule: RuleSnapshot | null) {
  if (!rule || sale.status === "CANCELADA") return 0;
  const parts = splitSale(sale.amount, sale.accessories);
  if (rule.basis === "FIXED_PER_DEVICE") return Math.max(0, Math.round(rule.rate));
  const profit = rule.includeAccessories
    ? (parts.device - sale.deviceCost) + (parts.accessoryRevenue - parts.accessoryCost)
    : parts.device - sale.deviceCost;
  const base = rule.basis === "PERCENT_SALE"
    ? (rule.includeAccessories ? parts.total : parts.device)
    : profit;
  return Math.max(0, Math.round((base * rule.rate) / 100));
}

function saleCode(saleNumber: number) {
  return `#V-${String(saleNumber).padStart(4, "0")}`;
}

function shortDate(label: string) {
  const match = /^(\d{2}\/\d{2})/.exec(label);
  return match?.[1] ?? label;
}

export function summarizeCommissions(input: {
  sales: SaleSnapshot[];
  rules: RuleSnapshot[];
  members: MemberSnapshot[];
  payments: PaymentSnapshot[];
}): CommissionSummary {
  const membersByUser = new Map(input.members.map((member) => [member.userId, member]));
  const payments = new Map(input.payments.map((payment) => [payment.memberId, payment]));
  const grouped = new Map<string, SaleSnapshot[]>();
  for (const sale of input.sales) {
    if (!sale.userId || sale.status === "CANCELADA") continue;
    const member = membersByUser.get(sale.userId);
    if (!member) continue;
    const rows = grouped.get(member.memberId) ?? [];
    rows.push(sale);
    grouped.set(member.memberId, rows);
  }

  const people = [...grouped.entries()].map(([memberId, sales]) => {
    const member = input.members.find((item) => item.memberId === memberId)!;
    const lines = [...sales]
      .sort((left, right) => right.soldAt.getTime() - left.soldAt.getTime())
      .map((sale) => {
        const rule = ruleForSale(input.rules, member.userId, sale.soldAt);
        const parts = splitSale(sale.amount, sale.accessories);
        return {
          id: sale.id,
          code: saleCode(sale.saleNumber),
          date: shortDate(sale.dateLabel),
          device: sale.deviceLabel || "Equipo",
          accessoriesAmount: Math.round(parts.accessoryRevenue),
          total: Math.round(parts.total),
          commission: commissionForSale(sale, rule),
          soldAt: sale.soldAt.toISOString(),
        };
      });
    const soldAmount = lines.reduce((sum, line) => sum + line.total, 0);
    const commission = lines.reduce((sum, line) => sum + line.commission, 0);
    const latestSale = [...sales].sort((left, right) => right.soldAt.getTime() - left.soldAt.getTime())[0];
    const effective = latestSale ? ruleForSale(input.rules, member.userId, latestSale.soldAt) : null;
    const payment = payments.get(memberId);
    return {
      memberId,
      userId: member.userId,
      name: member.name,
      role: member.role,
      salesCount: lines.length,
      soldAmount,
      commission,
      rule: effective ? ruleView(effective) : null,
      paidAt: payment ? payment.paidAt.toISOString() : null,
      sales: lines,
    };
  }).sort((left, right) => right.soldAmount - left.soldAmount || left.name.localeCompare(right.name, "es"));

  const soldAmount = people.reduce((sum, person) => sum + person.soldAmount, 0);
  const commission = people.reduce((sum, person) => sum + person.commission, 0);
  const paid = people.filter((person) => person.paidAt);
  const paidAmount = paid.reduce((sum, person) => sum + person.commission, 0);
  return {
    soldAmount,
    salesCount: people.reduce((sum, person) => sum + person.salesCount, 0),
    commission,
    share: soldAmount > 0 ? (commission / soldAmount) * 100 : 0,
    paidAmount,
    paidCount: paid.length,
    peopleCount: people.length,
    pendingAmount: commission - paidAmount,
    people,
  };
}
