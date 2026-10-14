import type { Prisma } from "@prisma/client";
import { DomainError } from "../../lib/domain-error.js";
import { currentBlueRate } from "../../lib/blue-rate.js";
import { commissionForSale, convert, currentPeriodKey, nextPeriod, type Currency, type RuleSnapshot } from "./commission-math.js";

export async function assertSeller(tx: Prisma.TransactionClient, storeId: string, memberId?: string | null) {
  if (!memberId) return;
  if (!await tx.storeMember.findFirst({ where: { id: memberId, storeId }, select: { id: true } })) {
    throw new DomainError("El vendedor no pertenece a la tienda", 404);
  }
}

/** Void once, retaining a historical credit if its period has any settlement. */
export async function voidSaleCommission(tx: Prisma.TransactionClient, storeId: string, saleId: string,
  reason: "CANCELLED" | "DELETED" | "EDITED", now = new Date()) {
  const rows = await tx.commissionAccrual.findMany({ where: { storeId, sourceSaleId: saleId, voidedAt: null } });
  if (!rows.length) return;
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  for (const row of rows) {
    const paid = await tx.commissionPayment.count({ where: { storeId, memberId: row.memberId, period: { gte: row.period }, createdAt: { lte: now } } });
    const adjustmentPeriod = paid ? nextPeriod([row.period, currentPeriodKey(now, store.timezone)].sort().at(-1)!) : null;
    await tx.commissionAccrual.update({ where: { id: row.id }, data: { voidedAt: now, voidReason: reason, adjustmentPeriod } });
  }
}

/** Store the applied rule once. Later rule edits/deletes never alter this snapshot. */
export async function recordSaleCommission(tx: Prisma.TransactionClient, storeId: string, saleId: string) {
  const sale = await tx.sale.findFirst({ where: { id: saleId, storeId }, include: { inventoryItem: true, tradeIn: true } });
  if (!sale) return;
  if (!sale.sellerMemberId || ["CANCELADA", "CANCELLED"].includes(sale.status)) return;
  const existing = await tx.commissionAccrual.findFirst({ where: { storeId, sourceSaleId: saleId, voidedAt: null }, orderBy: { createdAt: "desc" } });
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
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
    const personal = await tx.commissionRule.findFirst({ where: { storeId, memberId: sale.sellerMemberId, effectiveFrom: { lte: sale.soldAt } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
    const selected = personal ?? await tx.commissionRule.findFirst({ where: { storeId, memberId: null, effectiveFrom: { lte: sale.soldAt } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
    rule = selected ? { ...selected, rate: Number(selected.rate), currency: selected.currency as Currency | null } : null;
  }
  if (existing) await voidSaleCommission(tx, storeId, saleId, "EDITED");
  await tx.commissionAccrual.create({ data: {
    storeId, memberId: sale.sellerMemberId, sourceSaleId: sale.id, saleNumber: sale.saleNumber,
    soldAt: sale.soldAt, period: currentPeriodKey(sale.soldAt, store.timezone),
    deviceLabel: sale.deviceLabel || sale.inventoryItem?.model || "Equipo", currency,
    exchangeRate: sale.exchangeRate, total: amount, cost, takeValue, grossProfit: amount - cost - takeValue,
    commission: commissionForSale({ sellerMemberId: sale.sellerMemberId, status: sale.status, amount, cost, takeValue, currency, exchangeRate }, rule),
    ruleId: rule?.id, basis: rule?.basis, rate: rule?.rate, ruleCurrency: rule?.currency,
  } });
}

export async function refreshSaleCommission(tx: Prisma.TransactionClient, storeId: string, saleId: string) {
  const sale = await tx.sale.findFirst({ where: { id: saleId, storeId }, select: { sellerMemberId: true, status: true } });
  if (!sale?.sellerMemberId || ["CANCELADA", "CANCELLED"].includes(sale.status)) {
    await voidSaleCommission(tx, storeId, saleId, sale?.status === "CANCELADA" ? "CANCELLED" : "EDITED");
  } else await recordSaleCommission(tx, storeId, saleId);
}
