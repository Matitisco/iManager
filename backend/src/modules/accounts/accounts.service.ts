import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../plugins/prisma.js";
import { DomainError } from "../../lib/domain-error.js";
import { storeCurrency } from "../../lib/money-currency.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { serializeClient } from "../clients/clients.service.js";
import {
  addDaysYmd,
  allocatePayment,
  balanceTone,
  calendarDays,
  cents,
  fromCents,
  installmentStatus,
  monthDayWithin,
  ymdInTimeZone,
  type InstallmentSlice,
  type Tone,
} from "./ledger.js";

const CLOSED_REPAIR = ["ENTREGADO", "ENTREGADA", "CANCELADO", "CANCELADA"];
const dec = (value: number) => new Decimal(value).toDecimalPlaces(2);
const num = (value: Decimal | number | null | undefined) => Number(value ?? 0);

export type AccountLine = {
  id: string;
  source: "VENTA" | "REPARACION" | "MANUAL";
  label: string;
  amount: number;
  currency: string | null;
  openedAt: string;
  days: number;
  tone: Tone;
  state: "ABIERTA" | "NOTA_CREDITO";
  saleId: string | null;
  repairId: string | null;
  installments: Array<InstallmentSlice & { status: string }>;
};

export type Debtor = {
  clientId: string;
  name: string;
  phone: string;
  pendingBalance: number;
  repairBalance: number;
  currency: string | null;
  days: number;
  tone: Tone;
  statement: string;
  lines: AccountLine[];
};

function ymd(value: Date, timeZone: string) {
  return ymdInTimeZone(value, timeZone);
}

function lineTone(openedAt: string, today: string): { days: number; tone: Tone } {
  const days = calendarDays(openedAt, today);
  return { days, tone: balanceTone(days) };
}

async function storeClock(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { timezone: true, currency: true, name: true } });
  const timeZone = store?.timezone || "America/Argentina/Buenos_Aires";
  return { timeZone, today: ymd(new Date(), timeZone), currency: store?.currency || "ARS", name: store?.name || "la tienda" };
}

export async function listDebtors(storeId: string): Promise<Debtor[]> {
  const clock = await storeClock(storeId);
  const [clients, repairs, plans] = await Promise.all([
    prisma.client.findMany({
      where: { storeId },
      include: {
        sales: { where: { OR: [{ status: "PENDIENTE" }, { status: "COMPLETADA", openBalance: { gt: 0 } }] }, include: { tradeIn: { select: { differencePaid: true } }, accountPayments: { where: { kind: "NOTA_CREDITO" }, select: { id: true } } } },
        payments: { where: { kind: "CARGO" }, orderBy: { paidAt: "asc" }, select: { paidAt: true } },
      },
    }),
    prisma.repairOrder.findMany({
      where: { storeId, clientId: { not: null }, status: { notIn: CLOSED_REPAIR }, estimate: { not: null } },
    }),
    prisma.saleInstallment.findMany({ where: { storeId }, orderBy: [{ dueDate: "asc" }, { sequence: "asc" }] }),
  ]);
  const installmentsBySale = new Map<string, InstallmentSlice[]>();
  for (const row of plans) {
    const slice = { sequence: row.sequence, dueDate: ymd(row.dueDate, clock.timeZone), amount: num(row.amount), paidAmount: num(row.paidAmount) };
    installmentsBySale.set(row.saleId, [...(installmentsBySale.get(row.saleId) ?? []), slice]);
  }
  const repairsByClient = new Map<string, typeof repairs>();
  for (const repair of repairs) {
    if (!repair.clientId) continue;
    repairsByClient.set(repair.clientId, [...(repairsByClient.get(repair.clientId) ?? []), repair]);
  }

  const debtors: Debtor[] = [];
  for (const client of clients) {
    const lines: AccountLine[] = [];
    let openSales = 0;
    for (const sale of client.sales) {
      const cashDue = sale.tradeIn ? num(sale.tradeIn.differencePaid) : num(sale.amount);
      const open = sale.openBalance != null ? num(sale.openBalance) : Math.max(0, cashDue - num(sale.depositAppliedAmount));
      if (open <= 0) continue;
      openSales = fromCents(cents(openSales) + cents(open));
      const openedAt = ymd(sale.soldAt, clock.timeZone);
      const age = lineTone(openedAt, clock.today);
      const slices = installmentsBySale.get(sale.id) ?? [];
      lines.push({
        id: sale.id,
        source: "VENTA",
        label: `Venta ${sale.saleNumber}`,
        amount: open,
        currency: sale.amountCurrency ?? client.balanceCurrency,
        openedAt,
        ...age,
        state: sale.accountPayments.length ? "NOTA_CREDITO" : "ABIERTA",
        saleId: sale.id,
        repairId: null,
        installments: slices.map((slice) => ({ ...slice, status: installmentStatus(slice, clock.today) })),
      });
    }
    let repairBalance = 0;
    for (const repair of repairsByClient.get(client.id) ?? []) {
      const remainder = Math.max(0, num(repair.estimate) - num(repair.deposit));
      if (remainder <= 0) continue;
      repairBalance = fromCents(cents(repairBalance) + cents(remainder));
      const openedAt = ymd(repair.receivedAt, clock.timeZone);
      lines.push({
        id: repair.id,
        source: "REPARACION",
        label: `Reparación ${repair.orderNumber}`,
        amount: remainder,
        currency: repair.currency ?? client.balanceCurrency,
        openedAt,
        ...lineTone(openedAt, clock.today),
        state: "ABIERTA",
        saleId: null,
        repairId: repair.id,
        installments: [],
      });
    }
    const pending = num(client.pendingBalance);
    const manual = fromCents(cents(pending) - cents(openSales));
    if (manual > 0) {
      const openedAt = client.payments[0] ? ymd(client.payments[0].paidAt, clock.timeZone) : ymd(client.createdAt, clock.timeZone);
      lines.push({
        id: `manual-${client.id}`,
        source: "MANUAL",
        label: "Saldo manual",
        amount: manual,
        currency: client.balanceCurrency,
        openedAt,
        ...lineTone(openedAt, clock.today),
        state: "ABIERTA",
        saleId: null,
        repairId: null,
        installments: [],
      });
    }
    if (pending <= 0 && repairBalance <= 0) continue;
    const oldest = lines.reduce((min, item) => (item.openedAt < min ? item.openedAt : min), lines[0]?.openedAt ?? clock.today);
    const age = lineTone(oldest, clock.today);
    const currency = client.balanceCurrency ?? clock.currency;
    const money = (amount: number) => `${currency === "USD" ? "US$" : "$"} ${amount.toLocaleString("es-AR")}`;
    const statement = [
      `Estado de cuenta · ${client.name}`,
      `Saldo ${money(pending)}`,
      ...lines.map((item) => `${item.label}: ${money(item.amount)} · ${item.days} días`),
    ].join("\n");
    debtors.push({
      clientId: client.id,
      name: client.name,
      phone: client.phone ?? "",
      pendingBalance: pending,
      repairBalance,
      currency: client.balanceCurrency,
      ...age,
      statement,
      lines,
    });
  }
  return debtors.sort((left, right) => right.days - left.days || right.pendingBalance - left.pendingBalance || left.name.localeCompare(right.name, "es"));
}

async function currencyFor(storeId: string, client: { balanceCurrency: string | null; pendingBalance: Decimal }, requested?: string | null) {
  const store = await storeCurrency(storeId, prisma);
  const next = requested === "ARS" || requested === "USD" ? requested : client.balanceCurrency ?? store;
  if (client.balanceCurrency && client.balanceCurrency !== next && num(client.pendingBalance) !== 0) {
    throw new DomainError(`El cliente tiene saldos en ${client.balanceCurrency}. Registrá el movimiento en esa moneda`, 409);
  }
  return next;
}

export async function addMovement(
  storeId: string,
  clientId: string,
  input: { kind: "CARGO" | "DESCUENTO" | "NOTA_CREDITO"; amount: number; note?: string | null; saleId?: string | null; currency?: string | null },
  actor?: Actor,
) {
  if (!(input.amount > 0)) throw new DomainError("El monto tiene que ser mayor a cero");
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: clientId, storeId } });
    if (!client) throw new DomainError("Cliente no encontrado", 404);
    const currency = await currencyFor(storeId, client, input.currency);
    const amount = dec(input.amount);
    const note = input.note?.trim().slice(0, 200) || null;
    let sale: { id: string; status: string; openBalance: Decimal | null; amount: Decimal; depositAppliedAmount: Decimal; clientId: string | null } | null = null;
    if (input.saleId) {
      sale = await tx.sale.findFirst({ where: { id: input.saleId, storeId, clientId }, select: { id: true, status: true, openBalance: true, amount: true, depositAppliedAmount: true, clientId: true } });
      if (!sale) throw new DomainError("La venta no pertenece al cliente", 404);
    }
    if (input.kind === "NOTA_CREDITO" && !sale) throw new DomainError("La nota de crédito necesita una venta del cliente");
    const balance = new Decimal(client.pendingBalance.toString());
    if (input.kind !== "CARGO" && amount.greaterThan(balance)) throw new DomainError("El monto supera el saldo");
    let nextBalance = input.kind === "CARGO" ? balance.plus(amount) : balance.minus(amount);
    if (sale && input.kind !== "CARGO" && sale.status === "PENDIENTE") {
      const open = sale.openBalance != null ? new Decimal(sale.openBalance.toString()) : new Decimal(sale.amount.toString()).minus(sale.depositAppliedAmount);
      const nextOpen = Decimal.max(new Decimal(0), open.minus(amount));
      await tx.sale.update({
        where: { id: sale.id },
        data: { openBalance: nextOpen, ...(nextOpen.lessThanOrEqualTo(0) ? { status: "COMPLETADA" } : {}) },
      });
    }
    await tx.clientPayment.create({
      data: { storeId, clientId, saleId: sale?.id, amount, currency, method: "AJUSTE", kind: input.kind, note },
    });
    const updated = await tx.client.update({ where: { id: clientId }, data: { pendingBalance: nextBalance, balanceCurrency: currency } });
    if (actor) await writeAudit(tx, { storeId, actor, action: `account.${input.kind.toLowerCase()}`, entityType: "client", entityId: clientId, detail: `${input.amount} ${currency}${sale ? ` · venta ${sale.id}` : ""}` });
    return serializeClient(updated);
  });
}

function slicesOf(rows: Array<{ sequence: number; dueDate: Date; amount: Decimal; paidAmount: Decimal }>, timeZone: string): InstallmentSlice[] {
  return rows.map((row) => ({ sequence: row.sequence, dueDate: ymd(row.dueDate, timeZone), amount: num(row.amount), paidAmount: num(row.paidAmount) }));
}

export async function collectAccount(
  storeId: string,
  input: { clientId: string; saleId?: string | null; repairId?: string | null; amount: number; method: string; currency?: string | null },
  actor?: Actor,
) {
  if (!(input.amount > 0)) throw new DomainError("El monto tiene que ser mayor a cero");
  if (!input.method.trim()) throw new DomainError("Elegí el medio de pago");
  if (!input.saleId && !input.repairId) throw new DomainError("Elegí la venta o la reparación");
  const clock = await storeClock(storeId);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: input.clientId, storeId } });
    if (!client) throw new DomainError("Cliente no encontrado", 404);
    const currency = await currencyFor(storeId, client, input.currency);
    const amount = dec(input.amount);
    if (input.repairId) {
      const repair = await tx.repairOrder.findFirst({ where: { id: input.repairId, storeId, clientId: client.id } });
      if (!repair) throw new DomainError("La reparación no pertenece al cliente", 404);
      if (CLOSED_REPAIR.includes(repair.status)) throw new DomainError("La reparación ya está cerrada", 409);
      if (repair.estimate == null) throw new DomainError("Completá el presupuesto de la reparación");
      const remainder = new Decimal(repair.estimate.toString()).minus(repair.deposit);
      if (amount.greaterThan(remainder)) throw new DomainError("El monto supera el saldo de la reparación");
      await tx.repairOrder.update({ where: { id: repair.id }, data: { deposit: repair.deposit.plus(amount), currency } });
      await tx.clientPayment.create({ data: { storeId, clientId: client.id, repairOrderId: repair.id, amount, currency, method: input.method.trim(), kind: "PAGO", note: "Cobro de reparación" } });
      if (actor) await writeAudit(tx, { storeId, actor, action: "account.collected", entityType: "repair", entityId: repair.id, detail: `${input.amount} ${currency}` });
      return serializeClient(client);
    }
    const sale = await tx.sale.findFirst({ where: { id: input.saleId!, storeId, clientId: client.id }, include: { tradeIn: { select: { differencePaid: true } } } });
    if (!sale) throw new DomainError("La venta no pertenece al cliente", 404);
    if (sale.status !== "PENDIENTE" && !(sale.status === "COMPLETADA" && sale.openBalance != null && num(sale.openBalance) > 0)) throw new DomainError("La venta no tiene saldo pendiente", 409);
    const cashDue = sale.tradeIn ? num(sale.tradeIn.differencePaid) : num(sale.amount);
    const open = sale.openBalance != null ? new Decimal(sale.openBalance.toString()) : dec(Math.max(0, cashDue - num(sale.depositAppliedAmount)));
    if (amount.greaterThan(open)) throw new DomainError("El monto supera el saldo de la venta");
    if (amount.greaterThan(client.pendingBalance)) throw new DomainError("El monto supera el saldo");
    const rows = await tx.saleInstallment.findMany({ where: { storeId, saleId: sale.id } });
    if (rows.length) {
      const allocated = allocatePayment(slicesOf(rows, clock.timeZone), input.amount);
      for (const slice of allocated.rows) {
        const row = rows.find((item) => item.sequence === slice.sequence);
        if (!row) continue;
        await tx.saleInstallment.update({ where: { id: row.id }, data: { paidAmount: dec(slice.paidAmount) } });
      }
    }
    const nextOpen = open.minus(amount);
    await tx.sale.update({ where: { id: sale.id }, data: { openBalance: Decimal.max(new Decimal(0), nextOpen), ...(nextOpen.lessThanOrEqualTo(0) ? { status: "COMPLETADA" } : {}) } });
    await tx.clientPayment.create({ data: { storeId, clientId: client.id, saleId: sale.id, amount, currency, method: input.method.trim(), kind: "PAGO", note: rows.length ? "Cobro de cuota" : "Cobro de venta" } });
    const updated = await tx.client.update({ where: { id: client.id }, data: { pendingBalance: client.pendingBalance.minus(amount), balanceCurrency: currency } });
    if (actor) await writeAudit(tx, { storeId, actor, action: "account.collected", entityType: "sale", entityId: sale.id, detail: `${input.amount} ${currency}` });
    return serializeClient(updated);
  });
}

export async function getSaleAccount(storeId: string, saleId: string) {
  const clock = await storeClock(storeId);
  const sale = await prisma.sale.findFirst({ where: { id: saleId, storeId }, select: { id: true, openBalance: true, status: true, paymentMethod: true } });
  if (!sale) return null;
  const [plan, installments, tenders] = await Promise.all([
    prisma.saleInstallmentPlan.findFirst({ where: { storeId, saleId } }),
    prisma.saleInstallment.findMany({ where: { storeId, saleId }, orderBy: [{ dueDate: "asc" }, { sequence: "asc" }] }),
    prisma.saleTender.findMany({ where: { storeId, saleId }, orderBy: { createdAt: "asc" } }),
  ]);
  const slices = slicesOf(installments, clock.timeZone);
  return {
    saleId,
    status: sale.status,
    openBalance: sale.openBalance == null ? null : num(sale.openBalance),
    paymentMethod: sale.paymentMethod,
    plan: plan ? { count: plan.count, frequency: plan.frequency, surcharge: num(plan.surcharge), financedAmount: num(plan.financedAmount), firstDueDate: ymd(plan.firstDueDate, clock.timeZone) } : null,
    installments: slices.map((slice) => ({ ...slice, status: installmentStatus(slice, clock.today) })),
    tenders: tenders.map((tender) => ({ id: tender.id, amount: num(tender.amount), currency: tender.currency, method: tender.method, role: tender.role, exchangeRate: tender.exchangeRate == null ? null : num(tender.exchangeRate) })),
  };
}

const DEFAULT_SETTINGS = { birthdayLeadDays: 0, warrantyMonths: 12, warrantyLeadDays: 7, inactiveDays: 90, includeDebts: true };

export async function getFollowUpSettings(storeId: string) {
  const row = await prisma.storeFollowUpSettings.findUnique({ where: { storeId } });
  return row ? { birthdayLeadDays: row.birthdayLeadDays, warrantyMonths: row.warrantyMonths, warrantyLeadDays: row.warrantyLeadDays, inactiveDays: row.inactiveDays, includeDebts: row.includeDebts } : DEFAULT_SETTINGS;
}

export async function saveFollowUpSettings(storeId: string, input: Partial<typeof DEFAULT_SETTINGS>) {
  const current = await getFollowUpSettings(storeId);
  const next = { ...current, ...input };
  if (next.birthdayLeadDays < 0 || next.birthdayLeadDays > 60) throw new DomainError("La anticipación de cumpleaños tiene que estar entre 0 y 60 días");
  if (next.warrantyLeadDays < 0 || next.warrantyLeadDays > 60) throw new DomainError("La anticipación de garantía tiene que estar entre 0 y 60 días");
  if (next.warrantyMonths < 0 || next.warrantyMonths > 36) throw new DomainError("La garantía tiene que estar entre 0 y 36 meses");
  if (next.inactiveDays < 30 || next.inactiveDays > 365) throw new DomainError("La inactividad tiene que estar entre 30 y 365 días");
  await prisma.storeFollowUpSettings.upsert({ where: { storeId }, create: { storeId, ...next }, update: next });
  return next;
}

export async function listFollowUps(storeId: string) {
  const clock = await storeClock(storeId);
  const settings = await getFollowUpSettings(storeId);
  const [clients, sales] = await Promise.all([
    prisma.client.findMany({ where: { storeId }, select: { id: true, name: true, phone: true, birthday: true, pendingBalance: true, lastPurchaseAt: true } }),
    prisma.sale.findMany({ where: { storeId, status: "COMPLETADA", clientId: { not: null }, warrantyDays: { gt: 0 } }, select: { id: true, saleNumber: true, clientId: true, deviceLabel: true, soldAt: true, warrantyDays: true, client: { select: { name: true, phone: true } } } }),
  ]);
  const cards: Array<{ id: string; kind: "CUMPLEANOS" | "GARANTIA" | "DEUDA" | "INACTIVO"; clientId: string; name: string; phone: string; title: string; detail: string }> = [];
  for (const client of clients) {
    if (client.birthday && monthDayWithin(ymd(client.birthday, "UTC"), clock.today, settings.birthdayLeadDays)) {
      cards.push({ id: `birthday-${client.id}`, kind: "CUMPLEANOS", clientId: client.id, name: client.name, phone: client.phone ?? "", title: "Cumpleaños", detail: client.name });
    }
    if (settings.includeDebts && num(client.pendingBalance) > 0) {
      cards.push({ id: `debt-${client.id}`, kind: "DEUDA", clientId: client.id, name: client.name, phone: client.phone ?? "", title: "Deuda pendiente", detail: `${client.name} tiene saldo` });
    }
    if (client.lastPurchaseAt) {
      const last = ymd(client.lastPurchaseAt, clock.timeZone);
      if (last < addDaysYmd(clock.today, -settings.inactiveDays)) {
        cards.push({ id: `inactive-${client.id}`, kind: "INACTIVO", clientId: client.id, name: client.name, phone: client.phone ?? "", title: "Hace tiempo no compra", detail: `Última compra ${last.split("-").reverse().join("/")}` });
      }
    }
  }
  const until = addDaysYmd(clock.today, settings.warrantyLeadDays);
  for (const sale of sales) {
    if (!sale.clientId || !sale.client) continue;
    const end = addDaysYmd(ymd(sale.soldAt, clock.timeZone), sale.warrantyDays ?? 0);
    if (end < clock.today || end > until) continue;
    cards.push({ id: `warranty-${sale.id}`, kind: "GARANTIA", clientId: sale.clientId, name: sale.client.name, phone: sale.client.phone ?? "", title: "Garantía por vencer", detail: `${sale.deviceLabel || `Venta ${sale.saleNumber}`} · vence ${end.split("-").reverse().join("/")}` });
  }
  const order = { CUMPLEANOS: 0, GARANTIA: 1, DEUDA: 2, INACTIVO: 3 };
  return { today: clock.today, settings, cards: cards.sort((left, right) => order[left.kind] - order[right.kind] || left.name.localeCompare(right.name, "es")) };
}

export async function recordPriceRise(
  tx: Prisma.TransactionClient,
  args: { storeId: string; clientId: string; saleId: string; amount: number; currency: string; actor?: Actor },
) {
  await tx.clientPayment.create({
    data: { storeId: args.storeId, clientId: args.clientId, saleId: args.saleId, amount: dec(args.amount), currency: args.currency, method: "AJUSTE", kind: "CARGO", note: "Diferencia por corrección de precio" },
  });
  const updated = await tx.client.update({ where: { id: args.clientId }, data: { pendingBalance: { increment: dec(args.amount) } } });
  if (args.actor) await writeAudit(tx, { storeId: args.storeId, actor: args.actor, action: "account.cargo", entityType: "sale", entityId: args.saleId, detail: `Precio +${args.amount} ${args.currency}` });
  return updated;
}

export async function releaseCompletedOpenBalance(tx: Prisma.TransactionClient, clientId: string, status: string, openBalance: Decimal | null) {
  if (status !== "COMPLETADA" || openBalance == null || num(openBalance) <= 0) return null;
  const client = await tx.client.findFirst({ where: { id: clientId } });
  if (!client) return null;
  const next = Decimal.max(new Decimal(0), new Decimal(client.pendingBalance.toString()).minus(openBalance));
  return tx.client.update({ where: { id: client.id }, data: { pendingBalance: next } });
}
