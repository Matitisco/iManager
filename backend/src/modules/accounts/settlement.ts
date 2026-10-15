import { recordCash } from '../cash/service.js';
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { DomainError } from "../../lib/domain-error.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import {
  convertTender,
  fromCents,
  cents,
  settleTenders,
  splitInstallments,
  unpaidInstallments,
  type ExcessMode,
  type Frequency,
} from "./ledger.js";

const dec = (value: number) => new Decimal(value).toDecimalPlaces(2);

export type TenderDraft = { amount: number; currency: "ARS" | "USD"; method: string; exchangeRate?: number | null };
export type InstallmentDraft = {
  count: number;
  frequency: Frequency;
  firstDueDate: string;
  surcharge?: number;
  collectFirstNow?: boolean;
  firstMethod?: string;
};
export type SettlementRequest = {
  tenders?: TenderDraft[];
  excess?: ExcessMode;
  changeMethod?: string;
  installments?: InstallmentDraft | null;
};

export function hasSettlement(input: SettlementRequest) {
  return Boolean(input.tenders?.length || input.installments);
}

export async function settleNewSale(
  tx: Prisma.TransactionClient,
  args: {
    storeId: string;
    saleId: string;
    clientId: string | null;
    due: number;
    currency: string;
    exchangeRate: number | null;
    input: SettlementRequest;
    actor?: Actor;
  },
): Promise<{ status: string; unpaid: number; method: string } | null> {
  if (!hasSettlement(args.input)) return null;
  if (args.currency !== "ARS" && args.currency !== "USD") throw new DomainError("Moneda inválida");
  if (args.input.installments && !args.clientId) throw new DomainError("Financiar en cuotas no está disponible para consumidor final");
  const existing = await tx.saleInstallmentPlan.findFirst({ where: { storeId: args.storeId, saleId: args.saleId }, select: { id: true } });
  if (existing) throw new DomainError("La venta ya tiene un plan de cuotas", 409);

  const drafts = args.input.tenders ?? [];
  const converted = drafts.map((tender) => {
    try {
      return convertTender(tender.amount, tender.currency, args.currency, tender.currency === args.currency ? 1 : tender.exchangeRate ?? args.exchangeRate);
    } catch (error) {
      throw new DomainError(error instanceof Error ? error.message : "Revisá la cotización antes de confirmar");
    }
  });
  let settled: ReturnType<typeof settleTenders>;
  try {
    settled = settleTenders(Math.max(0, args.due), converted, args.input.excess ?? "OMIT");
  } catch (error) {
    throw new DomainError(error instanceof Error ? error.message : "No se pudieron registrar los pagos");
  }
  if ((settled.credit > 0 || settled.shortfall > 0 || args.input.installments) && !args.clientId) {
    throw new DomainError("El saldo pendiente necesita un cliente");
  }
  if (settled.change > 0 && !args.input.changeMethod?.trim()) throw new DomainError("Indicá de qué medio sale el vuelto");

  const methods = new Set<string>();
  for (let index = 0; index < drafts.length; index += 1) {
    const recorded = settled.recorded[index] ?? 0;
    if (recorded <= 0) continue;
    const tender = drafts[index]!;
    methods.add(tender.method.trim());
    await createCashTender(tx, {
      data: {
        storeId: args.storeId,
        saleId: args.saleId,
        clientId: args.clientId,
        amount: dec(tender.amount),
        currency: tender.currency,
        exchangeRate: tender.exchangeRate ? dec(tender.exchangeRate) : args.exchangeRate ? dec(args.exchangeRate) : null,
        method: tender.method.trim(),
        role: "COBRO",
      },
    });
    if (args.clientId) {
      await tx.clientPayment.create({
        data: {
          storeId: args.storeId,
          clientId: args.clientId,
          saleId: args.saleId,
          amount: dec(recorded),
          currency: args.currency,
          method: tender.method.trim(),
          kind: "PAGO",
          note: "Cobro de venta",
        },
      });
    }
  }
  if (settled.change > 0 && args.clientId) {
    const method = args.input.changeMethod!.trim();
    methods.add(method);
    await createCashTender(tx, {
      data: {
        storeId: args.storeId,
        saleId: args.saleId,
        clientId: args.clientId,
        amount: dec(settled.change),
        currency: args.currency,
        method,
        role: "VUELTO",
      },
    });
    await tx.clientPayment.create({
      data: {
        storeId: args.storeId,
        clientId: args.clientId,
        saleId: args.saleId,
        amount: dec(settled.change),
        currency: args.currency,
        method,
        kind: "VUELTO",
        note: "Vuelto de venta",
      },
    });
  }
  if (settled.credit > 0 && args.clientId) {
    const rate = args.exchangeRate && args.exchangeRate > 0
      ? args.exchangeRate
      : drafts.find((tender) => tender.exchangeRate && tender.exchangeRate > 0)?.exchangeRate;
    if (!rate || rate <= 0) throw new DomainError("Revisá la cotización antes de dejar el saldo a favor");
    const usd = args.currency === "USD" ? settled.credit : fromCents(Math.round((settled.credit / rate) * 100));
    if (!(usd > 0)) throw new DomainError("El equivalente USD debe ser mayor a cero");
    await tx.clientDeposit.create({
      data: {
        storeId: args.storeId,
        clientId: args.clientId,
        requestKey: `excess-${args.saleId}`,
        amount: dec(settled.credit),
        currency: args.currency,
        exchangeRate: dec(rate),
        usdAmount: dec(usd),
        method: "SALDO",
        status: "CREDIT",
      },
    });
    if (args.actor) await writeAudit(tx, { storeId: args.storeId, actor: args.actor, action: "deposit.credited", entityType: "client", entityId: args.clientId, detail: `Excedente de venta ${args.saleId}: ${settled.credit} ${args.currency}` });
  }

  let unpaid = settled.shortfall;
  if (args.input.installments) {
    if (!(settled.shortfall > 0)) throw new DomainError("No queda saldo para financiar");
    const planInput = args.input.installments;
    let slices;
    try {
      slices = splitInstallments({
        financed: settled.shortfall,
        count: planInput.count,
        surcharge: planInput.surcharge ?? 0,
        firstDue: planInput.firstDueDate,
        frequency: planInput.frequency,
        collectFirst: Boolean(planInput.collectFirstNow),
      });
    } catch (error) {
      throw new DomainError(error instanceof Error ? error.message : "No se pudo armar el plan de cuotas");
    }
    if (planInput.collectFirstNow && !planInput.firstMethod?.trim()) throw new DomainError("Elegí el medio para cobrar la primera cuota");
    const plan = await tx.saleInstallmentPlan.create({
      data: {
        storeId: args.storeId,
        saleId: args.saleId,
        clientId: args.clientId!,
        count: planInput.count,
        frequency: planInput.frequency,
        firstDueDate: new Date(`${planInput.firstDueDate}T12:00:00.000Z`),
        surcharge: dec(planInput.surcharge ?? 0),
        financedAmount: dec(settled.shortfall),
        currency: args.currency,
      },
    });
    await tx.saleInstallment.createMany({
      data: slices.map((slice) => ({
        storeId: args.storeId,
        planId: plan.id,
        saleId: args.saleId,
        clientId: args.clientId!,
        sequence: slice.sequence,
        dueDate: new Date(`${slice.dueDate}T12:00:00.000Z`),
        amount: dec(slice.amount),
        paidAmount: dec(slice.paidAmount),
        currency: args.currency,
      })),
    });
    if (planInput.collectFirstNow) {
      const method = planInput.firstMethod!.trim();
      methods.add(method);
      const first = slices[0]!;
      await createCashTender(tx, {
        data: { storeId: args.storeId, saleId: args.saleId, clientId: args.clientId, amount: dec(first.amount), currency: args.currency, method, role: "COBRO" },
      });
      await tx.clientPayment.create({
        data: { storeId: args.storeId, clientId: args.clientId!, saleId: args.saleId, amount: dec(first.paidAmount), currency: args.currency, method, kind: "PAGO", note: "Cuota 1" },
      });
    }
    unpaid = unpaidInstallments(slices);
  }
  if (unpaid > 0 && !args.clientId) throw new DomainError("El saldo pendiente necesita un cliente");
  const method = methods.size > 1 ? "MIXTO" : [...methods][0] ?? "EFECTIVO";
  return { status: unpaid > 0 ? "PENDIENTE" : "COMPLETADA", unpaid: fromCents(cents(unpaid)), method };
}

async function createCashTender(tx: Prisma.TransactionClient, args: { data: Prisma.SaleTenderUncheckedCreateInput }) {
  const row = await tx.saleTender.create(args);
  await recordCash(tx, { storeId: row.storeId, amount: Number(row.amount) * (row.role === 'VUELTO' ? -1 : 1), currency: row.currency, method: row.method, sourceType: 'sale', sourceId: row.saleId, note: row.role === 'VUELTO' ? 'Vuelto de venta' : 'Cobro de venta', requestKey: `tender:${row.id}` });
  return row;
}
