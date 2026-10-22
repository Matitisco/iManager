import type { CommissionAccrual, CommissionPayment, CommissionRule, Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";
import { DomainError } from "../../lib/domain-error.js";
import { currentBlueRate } from "../../lib/blue-rate.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { saleCode } from "../audit/archive.js";
import { assertSeller, loadCommissionBatch, refreshSaleCommission } from "./commission-ledger.js";
import { convert, currentPeriodKey, emptyTotals, projectBalance, monthBounds, roundMoney, zonedDayStart, type CommissionBasis, type Currency, type CurrencyTotals } from "./commission-math.js";

export interface CommissionRuleInput {
  memberId: string | null;
  basis: CommissionBasis;
  rate: number;
  currency?: Currency | null;
  effectiveFrom: string;
  active?: boolean;
}
export interface CommissionPaymentInput {
  memberId: string;
  period: string;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  settlesCurrency: Currency;
  note?: string | null;
}
export const presentRule = (rule: CommissionRule) => ({ ...rule, rate: Number(rule.rate), effectiveFrom: rule.effectiveFrom.toISOString(), createdAt: rule.createdAt.toISOString() });
export const presentPayment = (payment: CommissionPayment) => ({ ...payment, amount: Number(payment.amount), exchangeRate: Number(payment.exchangeRate),
  settledAmount: convert(Number(payment.amount), payment.currency as Currency, payment.settlesCurrency as Currency, Number(payment.exchangeRate)), createdAt: payment.createdAt.toISOString(), voidedAt: payment.voidedAt?.toISOString() ?? null });

async function periodContext(storeId: string, key?: string, db: Prisma.TransactionClient = prisma) {
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) throw new DomainError("Tienda no encontrada", 404);
  const period = monthBounds(key ?? currentPeriodKey(new Date(), store.timezone), new Date(), store.timezone);
  if (!period) throw new DomainError("Elegí un período válido (YYYY-MM)");
  return { store, period };
}

function plus(totals: CurrencyTotals, currency: string, amount: number) {
  const key = currency as Currency;
  totals[key] = roundMoney(totals[key] + amount);
}

function saleLine(row: CommissionAccrual, financials: boolean) {
  return {
    id: row.sourceSaleId, accrualId: row.id, saleNumber: row.saleNumber,
    soldAt: row.soldAt.toISOString(), deviceLabel: row.deviceLabel, total: Number(row.total),
    currency: row.currency, exchangeRate: row.exchangeRate == null ? null : Number(row.exchangeRate),
    commission: row.voidedAt ? 0 : Number(row.commission), originalCommission: Number(row.commission),
    cancelled: row.voidedAt != null, voidReason: row.voidReason, voidedAt: row.voidedAt?.toISOString() ?? null,
    rule: row.basis ? { id: row.ruleId, basis: row.basis, rate: Number(row.rate), currency: row.ruleCurrency } : null,
    ...(financials ? { cost: Number(row.cost), takeValue: Number(row.takeValue), grossProfit: Number(row.grossProfit) } : {}),
  };
}

/** Payments settle a member/currency balance, not a sale. Allocate them FIFO to
 * snapshots eligible at payment time, capped by earned commission. Voided payments
 * are excluded so their reversal also removes the corresponding deduction. */
function paidAccruals(rows: CommissionAccrual[], payments: CommissionPayment[]) {
  const allocated = new Map<string, number>();
  for (const payment of [...payments].sort((a, b) => a.period.localeCompare(b.period) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))) {
    let remaining = presentPayment(payment).settledAmount;
    for (const row of rows) {
      if (row.currency !== payment.settlesCurrency || row.period > payment.period || row.soldAt > payment.createdAt
        || (row.voidedAt && row.voidedAt < payment.createdAt)) continue;
      const used = allocated.get(row.id) ?? 0;
      const amount = Math.min(remaining, Math.max(0, Number(row.commission) - used));
      allocated.set(row.id, roundMoney(used + amount));
      remaining = roundMoney(remaining - amount);
      if (remaining <= 0) break;
    }
  }
  return allocated;
}

export async function getCommissionPeriod(storeId: string, periodKey?: string, financials = false, memberId?: string) {
  const { period, store } = await periodContext(storeId, periodKey);
  const [members, rows, payments, unassignedSalesCount] = await Promise.all([
    prisma.storeMember.findMany({ where: { storeId, ...(memberId ? { id: memberId } : {}) }, include: { user: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.commissionAccrual.findMany({ where: { storeId, ...(memberId ? { memberId } : {}), period: { lte: period.key } }, orderBy: [{ soldAt: "asc" }, { id: "asc" }] }),
    prisma.commissionPayment.findMany({ where: { storeId, ...(memberId ? { memberId } : {}), period: { lte: period.key } }, orderBy: [{ period: "asc" }, { createdAt: "asc" }] }),
    memberId ? Promise.resolve(0) : prisma.sale.count({ where: { storeId, voidedAt: null, sellerMemberId: null, status: { notIn: ["CANCELADA", "CANCELLED"] }, soldAt: { gte: period.start, lt: period.end } } }),
  ]);
  // Only legacy accruals need the current quote; historical entries use their frozen rate.
  const needsRate = rows.some(row => row.exchangeRate == null);
  const currentRate = needsRate ? await currentBlueRate() : null;
  return projectCommissionPeriod(period, store.timezone, members, rows, payments, currentRate, financials, unassignedSalesCount);
}

type CommissionMember = Prisma.StoreMemberGetPayload<{ include: { user: { select: { displayName: true; email: true } } } }>;
function projectCommissionPeriod(
  period: NonNullable<ReturnType<typeof monthBounds>>, timezone: string,
  members: CommissionMember[], rows: CommissionAccrual[], payments: CommissionPayment[],
  currentRate: number | null, financials = false, unassignedSalesCount = 0,
) {
  const people = members.map(member => {
    const previousBalance = emptyTotals();
    const earned = emptyTotals();
    const adjusted = emptyTotals();
    const paid = emptyTotals();
    const pending = emptyTotals();
    const converted = { earned: emptyTotals(), paid: emptyTotals(), pending: emptyTotals() };
    const balanceEvents: Parameters<typeof projectBalance>[0] = [];
    const memberRows = rows.filter(row => row.memberId === member.id);
    const memberPayments = payments.filter(payment => payment.memberId === member.id && !payment.voidedAt);
    const allocations = paidAccruals(memberRows, memberPayments);
    const adjustments = memberRows.filter(row => row.voidedAt && row.adjustmentPeriod === period.key && (allocations.get(row.id) ?? 0) > 0);
    for (const row of memberRows) {
      const rate = Number(row.exchangeRate ?? currentRate);
      const credit = row.voidedAt ? 0 : Number(row.commission);
      const adjustment = row.voidedAt && row.adjustmentPeriod === period.key ? -(allocations.get(row.id) ?? 0) : 0;
      if (row.period < period.key) plus(previousBalance, row.currency, credit);
      // Move the already negative carry into this month’s adjustment line, without a second debit.
      if (adjustment) plus(previousBalance, row.currency, -adjustment);
      if (row.period === period.key) plus(earned, row.currency, credit);
      if (row.adjustmentPeriod === period.key) plus(adjusted, row.currency, adjustment);
      plus(pending, row.currency, credit);
      balanceEvents.push({ period: row.period, at: row.soldAt.getTime(), currency: row.currency as Currency, amount: credit, exchangeRate: rate });
      for (const target of ["ARS", "USD"] as const) {
        if (row.period === period.key) plus(converted.earned, target, convert(credit, row.currency as Currency, target, rate));
        if (row.adjustmentPeriod === period.key) plus(converted.earned, target, convert(adjustment, row.currency as Currency, target, rate));
      }
    }
    for (const payment of memberPayments) {
      const view = presentPayment(payment);
      const settled = view.settledAmount;
      if (payment.period < period.key) plus(previousBalance, payment.settlesCurrency, -settled);
      else plus(paid, payment.settlesCurrency, settled);
      plus(pending, payment.settlesCurrency, -settled);
      balanceEvents.push({ period: payment.period, at: payment.createdAt.getTime(), currency: payment.settlesCurrency as Currency, amount: -settled, exchangeRate: Number(payment.exchangeRate) });
      for (const target of ["ARS", "USD"] as const) {
        const projected = convert(settled, payment.settlesCurrency as Currency, target, Number(payment.exchangeRate));
        if (payment.period === period.key) plus(converted.paid, target, projected);
      }
    }
    converted.pending = projectBalance(balanceEvents);
    return {
      memberId: member.id, userId: member.userId, name: member.user.displayName || member.user.email || "Usuario", role: member.role,
      salesCount: memberRows.filter(row => row.period === period.key && !row.voidedAt).length,
      previousBalance, earned, adjustmentsTotal: adjusted, paid, pending, carry: { ...pending }, converted,
      sales: memberRows.filter(row => row.period === period.key).map(row => saleLine(row, financials)),
      adjustments: adjustments.map(row => ({
        accrualId: row.id, saleId: row.sourceSaleId, saleNumber: row.saleNumber, period: row.adjustmentPeriod!,
        amount: -(allocations.get(row.id) ?? 0), currency: row.currency, label: "A descontar", reason: row.voidReason,
      })),
      payments: payments.filter(payment => payment.memberId === member.id && payment.period === period.key).map(presentPayment),
    };
  });
  const summary = { converted: { earned: emptyTotals(), paid: emptyTotals(), pending: emptyTotals() }, earned: emptyTotals(), paid: emptyTotals(), pending: emptyTotals(), adjustmentsTotal: emptyTotals(), salesCount: 0, unassignedSalesCount };
  for (const person of people) {
    for (const currency of ["ARS", "USD"] as const) {
      for (const key of ["earned", "paid", "pending", "adjustmentsTotal"] as const) plus(summary[key], currency, person[key][currency]);
    }
    for (const key of ["earned", "paid", "pending"] as const) {
      for (const currency of ["ARS", "USD"] as const) plus(summary.converted[key], currency, person.converted[key][currency]);
    }
    summary.salesCount += person.salesCount;
  }
  return { period: { key: period.key, label: period.label, timezone }, summary, people };
}

export async function getCommissionPerson(storeId: string, memberId: string, period?: string, financials = false) {
  await assertSeller(prisma, storeId, memberId);
  const data = await getCommissionPeriod(storeId, period, financials, memberId);
  return { period: data.period, person: data.people[0] };
}

export async function listCommissionRules(storeId: string) {
  return (await prisma.commissionRule.findMany({ where: { storeId, deletedAt: null }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] })).map(presentRule);
}

export async function saveCommissionRule(storeId: string, actor: Actor, input: Partial<CommissionRuleInput>, id?: string) {
  return withSerializableRetry(async tx => {
    const existing = id ? await tx.commissionRule.findFirst({ where: { id, storeId, deletedAt: null } }) : null;
    if (id && !existing) throw new DomainError("Regla no encontrada", 404);
    const config = {
      memberId: existing?.memberId ?? null, basis: existing?.basis ?? "PROFIT_PERCENT",
      rate: existing ? Number(existing.rate) : undefined, currency: existing?.currency as Currency | null,
      effectiveFrom: existing?.effectiveFrom.toISOString(), ...input,
    };
    await assertSeller(tx, storeId, config.memberId);
    if (config.rate === undefined || !Number.isFinite(config.rate) || config.rate < 0) throw new DomainError("Indicá una tasa válida");
    if (config.basis === "FIXED_PER_UNIT" && !config.currency) throw new DomainError("Indicá la moneda del monto fijo");
    if (config.basis !== "FIXED_PER_UNIT" && config.rate > 100) throw new DomainError("El porcentaje no puede superar 100");
    if (!config.effectiveFrom) throw new DomainError("Indicá la fecha de vigencia");
    let effectiveFrom = new Date(config.effectiveFrom);
    if (/^\d{4}-\d{2}-\d{2}$/.test(config.effectiveFrom)) {
      if (Number.isNaN(effectiveFrom.getTime()) || effectiveFrom.toISOString().slice(0, 10) !== config.effectiveFrom) throw new DomainError("Fecha de vigencia inválida");
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
      const [year, month, day] = config.effectiveFrom.split("-").map(Number);
      effectiveFrom = zonedDayStart(year, month, day, store.timezone);
    }
    if (Number.isNaN(effectiveFrom.getTime())) throw new DomainError("Fecha de vigencia inválida");
    const data = { active: input.active ?? existing?.active ?? true, memberId: config.memberId, basis: config.basis, rate: config.rate,
      currency: config.basis === "FIXED_PER_UNIT" ? config.currency : null, effectiveFrom, createdBy: existing?.createdBy ?? actor.userId };
    const rule = id ? await tx.commissionRule.update({ where: { id }, data }) : await tx.commissionRule.create({ data: { ...data, storeId } });
    await writeAudit(tx, { storeId, actor, action: id ? (input.active !== undefined && input.active !== existing?.active ? (input.active ? "commission.rule.activated" : "commission.rule.deactivated") : "commission.rule.updated") : "commission.rule.created", entityType: "commissionRule", entityId: rule.id });
    return presentRule(rule);
  });
}

export async function deleteCommissionRule(storeId: string, actor: Actor, id: string, reason?: string | null) {
  return withSerializableRetry(async tx => {
    const rule = await tx.commissionRule.findFirst({ where: { id, storeId } });
    if (!rule) throw new DomainError("Regla no encontrada", 404);
    if (rule.deletedAt) return;
    await tx.commissionRule.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await writeAudit(tx, { storeId, actor, action: "commission.rule.deleted", reason, entityType: "commissionRule", entityId: id });
  });
}

export async function voidCommissionPayment(storeId: string, actor: Actor, id: string, reason?: string | null) {
  return withSerializableRetry(async tx => {
    const payment = await tx.commissionPayment.findFirst({ where: { id, storeId } });
    if (!payment) throw new DomainError("Pago no encontrado", 404);
    if (payment.voidedAt) return presentPayment(payment);
    const voided = await tx.commissionPayment.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: actor.userId } });
    await writeAudit(tx, { storeId, actor, action: "commission.payment.voided", reason, entityType: "commissionPayment", entityId: id,
      detail: `${payment.amount} ${payment.currency} (${payment.period})` });
    return presentPayment(voided);
  });
}

export async function listCommissionPayments(storeId: string, period?: string, memberId?: string) {
  if (period) await periodContext(storeId, period);
  if (memberId) await assertSeller(prisma, storeId, memberId);
  return (await prisma.commissionPayment.findMany({ where: { storeId, ...(period ? { period } : {}), ...(memberId ? { memberId } : {}) }, orderBy: { createdAt: "desc" } })).map(presentPayment);
}

export async function createCommissionPayment(storeId: string, actor: Actor, input: CommissionPaymentInput) {
  return withSerializableRetry(async tx => {
    await assertSeller(tx, storeId, input.memberId);
    await periodContext(storeId, input.period, tx);
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0) throw new DomainError("Pago o cotización inválidos");
    const payment = await tx.commissionPayment.create({ data: { storeId, ...input, createdBy: actor.userId } });
    await writeAudit(tx, { storeId, actor, action: "commission.payment.created", entityType: "commissionPayment", entityId: payment.id,
      detail: `${input.amount} ${input.currency} → ${input.settlesCurrency} (${input.period})` });
    return presentPayment(payment);
  });
}

export async function bulkAssignSeller(storeId: string, actor: Actor, saleIds: string[], sellerMemberId: string | null) {
  return withSerializableRetry(async tx => {
    await assertSeller(tx, storeId, sellerMemberId);
    const ids = [...new Set(saleIds)];
    const batch = await loadCommissionBatch(tx, storeId, ids);
    const sales = [...batch.sales.values()];
    if (sales.length !== ids.length) throw new DomainError("Una venta no pertenece a la tienda", 404);
    const changed = sales.filter(sale => sale.sellerMemberId !== sellerMemberId);
    await tx.sale.updateMany({ where: { storeId, id: { in: changed.map(sale => sale.id) } }, data: { sellerMemberId } });
    for (const sale of sales) {
      if (sale.sellerMemberId === sellerMemberId) continue;
      batch.sales.set(sale.id, { ...sale, sellerMemberId });
      await refreshSaleCommission(tx, storeId, sale.id, batch);
      await writeAudit(tx, { storeId, actor, action: "sale.seller.changed", entityType: "sale", entityId: sale.id,
        entityLabel: saleCode(sale.saleNumber),
        detail: `${sale.sellerMemberId ?? "Sin vendedor"} → ${sellerMemberId ?? "Sin vendedor"}` });
    }
    return { updated: sales.length };
  });
}

export async function getCommissionReport(storeId: string, from: string, to: string) {
  const { store } = await periodContext(storeId, from);
  await periodContext(storeId, to);
  if (from > to) throw new DomainError("Períodos invertidos");
  const start = Number(from.slice(0, 4)) * 12 + Number(from.slice(5));
  const end = Number(to.slice(0, 4)) * 12 + Number(to.slice(5));
  if (end - start > 119) throw new DomainError("El reporte admite hasta 120 meses");
  const [members, accruals, payments] = await Promise.all([
    prisma.storeMember.findMany({ where: { storeId }, include: { user: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.commissionAccrual.findMany({ where: { storeId, period: { lte: to } }, orderBy: [{ soldAt: "asc" }, { id: "asc" }] }),
    prisma.commissionPayment.findMany({ where: { storeId, period: { lte: to } }, orderBy: [{ period: "asc" }, { createdAt: "asc" }] }),
  ]);
  const currentRate = accruals.some(row => row.exchangeRate == null) ? await currentBlueRate() : null;
  const rows = [];
  for (let n = start; n <= end; n++) {
    const period = `${Math.floor((n - 1) / 12)}-${String((n - 1) % 12 + 1).padStart(2, "0")}`;
    const bounds = monthBounds(period, new Date(), store.timezone)!;
    const data = projectCommissionPeriod(bounds, store.timezone, members, accruals.filter(row => row.period <= period), payments.filter(row => row.period <= period), currentRate);
    rows.push(...data.people.map(({ memberId, name, salesCount, earned, paid, pending, adjustmentsTotal, converted }) => ({ period, memberId, name, salesCount, earned, paid, pending, adjustmentsTotal, converted })));
  }
  return { from, to, rows };
}

export async function getMyCommissions(storeId: string, userId: string, period?: string) {
  const member = await prisma.storeMember.findFirst({ where: { storeId, userId }, select: { id: true } });
  if (!member) throw new DomainError("Store membership required", 403);
  return getCommissionPerson(storeId, member.id, period, false);
}

/** Minimal directory for manual seller selection, including staff creating sales. */
export async function listCommissionSellers(storeId: string) {
  const members = await prisma.storeMember.findMany({ where: { storeId }, select: { id: true, role: true, user: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "asc" } });
  return members.map(member => ({ id: member.id, role: member.role, name: member.user.displayName || member.user.email || "Miembro" }));
}
