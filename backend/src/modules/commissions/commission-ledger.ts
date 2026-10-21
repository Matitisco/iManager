import type { Prisma, Store, CommissionAccrual, CommissionPayment, CommissionRule } from "@prisma/client";
import { DomainError } from "../../lib/domain-error.js";
import { currentBlueRate } from "../../lib/blue-rate.js";
import { commissionForSale, convert, currentPeriodKey, nextPeriod, type Currency, type RuleSnapshot } from "./commission-math.js";

type CommissionSale = Prisma.SaleGetPayload<{ include: { inventoryItem: true; tradeIn: true } }>;
type CommissionBatch = {
  sales: Map<string, CommissionSale>;
  store: Store;
  accruals: CommissionAccrual[];
  payments: CommissionPayment[];
  rules: CommissionRule[];
};

/** One set of commission inputs for all selected sales, within their mutation transaction. */
export async function loadCommissionBatch(tx: Prisma.TransactionClient, storeId: string, saleIds: string[]): Promise<CommissionBatch> {
  const [sales, store, accruals, rules] = await Promise.all([
    tx.sale.findMany({ where: { storeId, id: { in: saleIds } }, include: { inventoryItem: true, tradeIn: true } }),
    tx.store.findUniqueOrThrow({ where: { id: storeId } }),
    tx.commissionAccrual.findMany({ where: { storeId, sourceSaleId: { in: saleIds }, voidedAt: null }, orderBy: { createdAt: "desc" } }),
    tx.commissionRule.findMany({ where: { storeId, active: true, deletedAt: null }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }] }),
  ]);
  const payments = await tx.commissionPayment.findMany({ where: { storeId, memberId: { in: [...new Set(accruals.map(row => row.memberId))] }, voidedAt: null } });
  return { sales: new Map(sales.map(sale => [sale.id, sale])), store, accruals, rules, payments };
}

export async function assertSeller(tx: Prisma.TransactionClient, storeId: string, memberId?: string | null) {
  if (!memberId) return;
  if (!await tx.storeMember.findFirst({ where: { id: memberId, storeId }, select: { id: true } })) {
    throw new DomainError("El vendedor no pertenece a la tienda", 404);
  }
}

/** Void once; retain the snapshot and the month in which paid deductions are shown. */
export async function voidSaleCommission(tx: Prisma.TransactionClient, storeId: string, saleId: string,
  reason: "CANCELLED" | "DELETED" | "EDITED", now = new Date(), batch?: CommissionBatch) {
  const rows = batch ? batch.accruals.filter(row => row.sourceSaleId === saleId) : await tx.commissionAccrual.findMany({ where: { storeId, sourceSaleId: saleId, voidedAt: null } });
  if (!rows.length) return;
  const store = batch?.store ?? await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  for (const row of rows) {
    const paid = batch ? batch.payments.some(payment => payment.memberId === row.memberId && payment.period >= row.period && payment.settlesCurrency === row.currency && payment.createdAt <= now) : await tx.commissionPayment.count({ where: { storeId, memberId: row.memberId, period: { gte: row.period }, voidedAt: null, settlesCurrency: row.currency, createdAt: { lte: now } } });
    const adjustmentPeriod = paid ? nextPeriod([row.period, currentPeriodKey(now, store.timezone)].sort().at(-1)!) : null;
    await tx.commissionAccrual.update({ where: { id: row.id }, data: { voidedAt: now, voidReason: reason, adjustmentPeriod } });
  }
}

/** Store the applied rule once. Later rule edits/deletes never alter this snapshot. */
export async function recordSaleCommission(tx: Prisma.TransactionClient, storeId: string, saleId: string, batch?: CommissionBatch) {
  const sale = batch ? batch.sales.get(saleId) : await tx.sale.findFirst({ where: { id: saleId, storeId }, include: { inventoryItem: true, tradeIn: true } });
  if (!sale) return;
  if (!sale.sellerMemberId || ["CANCELADA", "CANCELLED"].includes(sale.status)) return;
  const existing = batch ? batch.accruals.find(row => row.sourceSaleId === saleId) : await tx.commissionAccrual.findFirst({ where: { storeId, sourceSaleId: saleId, voidedAt: null }, orderBy: { createdAt: "desc" } });
  const store = batch?.store ?? await tx.store.findUniqueOrThrow({ where: { id: storeId } });
  const currency = (sale.amountCurrency ?? store.currency) as Currency;
  const exchangeRate = Number(sale.exchangeRate ?? await currentBlueRate());
  const cost = convert(Number(sale.inventoryItem?.cost ?? 0), (sale.inventoryItem?.currency ?? store.currency) as Currency, currency, exchangeRate);
  const takeValue = convert(Number(sale.tradeIn?.takeValue ?? 0), (sale.tradeIn?.currency ?? store.currency) as Currency, currency, exchangeRate);
  const amount = Number(sale.amount);
  // Preserve the applied rule for financial edits; changing seller/date reselects by sale date.
  const sameAssignment = existing?.memberId === sale.sellerMemberId && existing.soldAt.getTime() === sale.soldAt.getTime();
  if (existing && sameAssignment && Number(existing.total) === amount && Number(existing.cost) === cost
    && Number(existing.takeValue) === takeValue && existing.currency === currency
    && Number(existing.exchangeRate ?? exchangeRate) === exchangeRate) return;
  let rule: RuleSnapshot | null;
  if (existing && sameAssignment) {
    rule = existing.basis ? { id: existing.ruleId!, memberId: existing.memberId, basis: existing.basis,
      rate: Number(existing.rate), currency: existing.ruleCurrency as Currency | null,
      effectiveFrom: existing.soldAt, createdAt: existing.createdAt } : null;
  } else {
    const personal = batch ? batch.rules.find(rule => rule.memberId === sale.sellerMemberId && rule.effectiveFrom <= sale.soldAt) : await tx.commissionRule.findFirst({ where: { storeId, active: true, deletedAt: null, memberId: sale.sellerMemberId, effectiveFrom: { lte: sale.soldAt } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
    const selected = personal ?? (batch ? batch.rules.find(rule => rule.memberId === null && rule.effectiveFrom <= sale.soldAt) : await tx.commissionRule.findFirst({ where: { storeId, active: true, deletedAt: null, memberId: null, effectiveFrom: { lte: sale.soldAt } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }] }));
    rule = selected ? { ...selected, rate: Number(selected.rate), currency: selected.currency as Currency | null } : null;
  }
  if (existing) await voidSaleCommission(tx, storeId, saleId, "EDITED", new Date(), batch);
  await tx.commissionAccrual.create({ data: {
    storeId, memberId: sale.sellerMemberId, sourceSaleId: sale.id, saleNumber: sale.saleNumber,
    soldAt: sale.soldAt, period: currentPeriodKey(sale.soldAt, store.timezone),
    deviceLabel: sale.deviceLabel || sale.inventoryItem?.model || "Equipo", currency,
    exchangeRate: sale.exchangeRate, total: amount, cost, takeValue, grossProfit: amount - cost - takeValue,
    commission: commissionForSale({ sellerMemberId: sale.sellerMemberId, status: sale.status, amount, cost, takeValue, currency, exchangeRate }, rule),
    ruleId: rule?.id, basis: rule?.basis, rate: rule?.rate, ruleCurrency: rule?.currency,
  } });
}

export async function refreshSaleCommission(tx: Prisma.TransactionClient, storeId: string, saleId: string, batch?: CommissionBatch) {
  const sale = batch ? batch.sales.get(saleId) : await tx.sale.findFirst({ where: { id: saleId, storeId }, select: { sellerMemberId: true, status: true } });
  if (!sale?.sellerMemberId || ["CANCELADA", "CANCELLED"].includes(sale.status)) {
    await voidSaleCommission(tx, storeId, saleId, !sale ? "DELETED" : ["CANCELADA", "CANCELLED"].includes(sale.status) ? "CANCELLED" : "EDITED", new Date(), batch);
  } else await recordSaleCommission(tx, storeId, saleId, batch);
}
