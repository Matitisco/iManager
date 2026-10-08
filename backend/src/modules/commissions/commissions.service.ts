import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../plugins/prisma.js";
import {
  COMMISSION_TIME_ZONE,
  currentRule,
  monthBounds,
  currentPeriodKey,
  ruleView,
  startOfZonedDay,
  summarizeCommissions,
  type CommissionBasis,
  type CommissionPerson,
  type CommissionRuleView,
  type MemberSnapshot,
  type PaymentSnapshot,
  type RuleSnapshot,
  type SaleSnapshot,
} from "./commission-math.js";

export class CommissionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getCommissionErrorStatus(error: unknown) {
  if (error instanceof CommissionError) return { statusCode: error.statusCode, message: error.message };
  return null;
}

export interface CommissionRuleInput {
  memberId: string | null;
  basis: CommissionBasis;
  rate: number;
  includeAccessories: boolean;
}

export interface CommissionPeriodResponse {
  period: { key: string; label: string; closesLabel: string; current: boolean };
  summary: {
    soldAmount: number;
    salesCount: number;
    commission: number;
    share: number;
    paidAmount: number;
    paidCount: number;
    peopleCount: number;
    pendingAmount: number;
  };
  people: Array<Omit<CommissionPerson, "sales">>;
  members: { id: string; name: string; role: MemberSnapshot["role"] }[];
  rules: { team: CommissionRuleView | null; personal: Record<string, CommissionRuleView> };
}

const money = (value: { toString(): string } | number | null | undefined) => Number(value?.toString() ?? 0);

function safeZone(value: string | null | undefined) {
  if (!value) return COMMISSION_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return COMMISSION_TIME_ZONE;
  }
}

function personName(user: { displayName: string | null; email: string | null }) {
  return user.displayName?.trim() || user.email?.trim() || "Usuario";
}

async function storeZone(storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId }, select: { timezone: true } });
  if (!store) throw new CommissionError("Tienda no encontrada", 404);
  return safeZone(store.timezone);
}

async function loadContext(storeId: string, periodKey: string | undefined, now = new Date()) {
  const timeZone = await storeZone(storeId);
  const key = periodKey || currentPeriodKey(now, timeZone);
  const period = monthBounds(key, now, timeZone);
  if (!period) throw new CommissionError("Elegí un período válido");

  const [sales, rules, members, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { storeId, soldAt: { gte: period.start, lt: period.end }, registeredByUserId: { not: null } },
      include: {
        inventoryItem: { select: { model: true, capacity: true, cost: true } },
        accessoryLines: { include: { accessory: { select: { cost: true } } } },
      },
    }),
    prisma.commissionRule.findMany({
      where: { storeId, effectiveFrom: { lt: period.end } },
      include: { member: { select: { userId: true } } },
    }),
    prisma.storeMember.findMany({
      where: { storeId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.commissionPayment.findMany({ where: { storeId, periodKey: period.key } }),
  ]);

  const memberSnapshots: MemberSnapshot[] = members.map((member) => ({
    memberId: member.id,
    userId: member.userId,
    name: personName(member.user),
    role: member.role,
  }));
  const ruleSnapshots: RuleSnapshot[] = rules.map((rule) => ({
    id: rule.id,
    memberId: rule.memberId,
    userId: rule.member?.userId ?? null,
    basis: rule.basis as CommissionBasis,
    rate: money(rule.rate),
    includeAccessories: rule.includeAccessories,
    settlement: "MONTHLY",
    effectiveFrom: rule.effectiveFrom,
    createdAt: rule.createdAt,
  }));
  const saleSnapshots: SaleSnapshot[] = sales.map((sale) => ({
    id: sale.id,
    saleNumber: sale.saleNumber,
    soldAt: sale.soldAt,
    dateLabel: sale.dateLabel,
    status: sale.status,
    amount: money(sale.amount),
    deviceLabel: sale.deviceLabel?.trim()
      || [sale.inventoryItem?.model, sale.inventoryItem?.capacity].filter(Boolean).join(" ")
      || "Equipo",
    deviceCost: money(sale.inventoryItem?.cost),
    userId: sale.registeredByUserId,
    accessories: sale.accessoryLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: money(line.unitPrice),
      unitCost: money(line.accessory.cost),
      voided: line.voidedAt != null,
    })),
  }));
  const paymentSnapshots: PaymentSnapshot[] = payments.map((payment) => ({
    memberId: payment.memberId,
    paidAt: payment.paidAt,
    amount: money(payment.amount),
  }));
  const summary = summarizeCommissions({
    sales: saleSnapshots,
    rules: ruleSnapshots,
    members: memberSnapshots,
    payments: paymentSnapshots,
  });
  return { period, now, timeZone, summary, memberSnapshots, ruleSnapshots };
}

function present(context: Awaited<ReturnType<typeof loadContext>>): CommissionPeriodResponse {
  const personal: Record<string, CommissionRuleView> = {};
  for (const member of context.memberSnapshots) {
    const rule = currentRule(context.ruleSnapshots, member.memberId, context.now);
    if (rule) personal[member.memberId] = ruleView(rule);
  }
  const team = currentRule(context.ruleSnapshots, null, context.now);
  const { people, ...summary } = context.summary;
  return {
    period: {
      key: context.period.key,
      label: context.period.label,
      closesLabel: context.period.closesLabel,
      current: context.period.current,
    },
    summary,
    people: people.map(({ sales: _sales, ...person }) => person),
    members: context.memberSnapshots.map((member) => ({ id: member.memberId, name: member.name, role: member.role })),
    rules: { team: team ? ruleView(team) : null, personal },
  };
}

export async function getCommissionPeriod(storeId: string, periodKey?: string) {
  return present(await loadContext(storeId, periodKey));
}

export async function getCommissionPerson(storeId: string, memberId: string, periodKey?: string) {
  const context = await loadContext(storeId, periodKey);
  const person = context.summary.people.find((item) => item.memberId === memberId);
  if (!person) throw new CommissionError("No hay ventas de esta persona en el período", 404);
  return { period: present(context).period, person };
}

export async function saveCommissionRule(storeId: string, userId: string, input: CommissionRuleInput) {
  const timeZone = await storeZone(storeId);
  if (input.memberId) {
    const member = await prisma.storeMember.findFirst({ where: { id: input.memberId, storeId }, select: { id: true } });
    if (!member) throw new CommissionError("La persona no pertenece a la tienda", 404);
  }
  const effectiveFrom = startOfZonedDay(new Date(), timeZone);
  const data = {
    basis: input.basis,
    rate: new Decimal(input.rate),
    includeAccessories: input.includeAccessories,
    settlement: "MONTHLY",
    createdByUserId: userId,
  };
  const existing = await prisma.commissionRule.findFirst({
    where: { storeId, memberId: input.memberId, effectiveFrom },
    select: { id: true },
  });
  if (existing) {
    await prisma.commissionRule.update({ where: { id: existing.id }, data });
  } else {
    await prisma.commissionRule.create({
      data: { storeId, memberId: input.memberId, effectiveFrom, ...data },
    });
  }
  return getCommissionPeriod(storeId);
}

export async function markCommissionPaid(storeId: string, userId: string, memberId: string, periodKey: string) {
  const context = await loadContext(storeId, periodKey);
  const person = context.summary.people.find((item) => item.memberId === memberId);
  if (!person) throw new CommissionError("No hay ventas de esta persona en el período", 404);
  if (person.commission <= 0) throw new CommissionError("No hay comisión para liquidar en este período");
  if (!person.paidAt) {
    try {
      await prisma.commissionPayment.create({
        data: {
          storeId,
          memberId,
          periodKey: context.period.key,
          amount: new Decimal(person.commission),
          paidByUserId: userId,
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
    }
  }
  return getCommissionPeriod(storeId, context.period.key);
}
