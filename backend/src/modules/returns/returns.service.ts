import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { lockTransactionKey } from "../../lib/advisory-lock.js";
import { formatArMoney } from "../../lib/ar-money.js";
import { DomainError } from "../../lib/domain-error.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { prisma } from "../../plugins/prisma.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { recordCash } from "../cash/service.js";
import { calendarDay } from "../periodic-reports/schedule.js";
import {
  planCreditApplication,
  refundableAmount,
  resolutionError,
  returnCode,
  roundMoney,
  stockStatusForReturn,
  type Destination,
  type MoneyCurrency,
  type Resolution,
  type RmaStatus,
  type Settlement,
} from "./returns-math.js";

const ZONE = "America/Argentina/Buenos_Aires";
type Tx = Prisma.TransactionClient;

const caseInclude = {
  events: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
  creditNote: true,
  supplier: { select: { name: true } },
  sale: { select: { amount: true, amountCurrency: true, openBalance: true, status: true, warrantyDays: true, dateLabel: true, paymentMethod: true } },
  inventoryItem: { select: { cost: true, currency: true, status: true } },
} satisfies Prisma.ReturnCaseInclude;

type CaseRow = Prisma.ReturnCaseGetPayload<{ include: typeof caseInclude }>;

export interface ReturnCaseView {
  id: string;
  code: string;
  caseNumber: number;
  saleId: string | null;
  clientId: string | null;
  clientName: string;
  inventoryItemId: string | null;
  imei: string;
  deviceLabel: string;
  supplierId: string | null;
  supplierName: string | null;
  reason: string;
  diagnosis: string | null;
  openedOn: string;
  resolution: string | null;
  settlement: string | null;
  moneyAmount: number;
  moneyCurrency: string | null;
  destination: string | null;
  stockStatus: string | null;
  previousStatus: string | null;
  rmaStatus: string | null;
  status: string;
  resolvedOn: string | null;
  deletedAt: string | null;
  refundable: number;
  saleAmount: number;
  saleCurrency: string | null;
  saleDate: string | null;
  warrantyDays: number | null;
  itemCost: number;
  itemCurrency: string | null;
  creditNote: {
    id: string;
    amount: number;
    remaining: number;
    currency: string;
    status: string;
  } | null;
  events: Array<{ status: string; note: string | null; createdAt: string }>;
}

export interface CreditNoteView {
  id: string;
  clientId: string;
  returnCaseId: string;
  code: string;
  amount: number;
  remaining: number;
  currency: string;
  status: string;
  deletedAt: string | null;
}

function money(value: Decimal | number | null | undefined) {
  return roundMoney(Number(value ?? 0));
}

function currencyOf(value: string | null | undefined): MoneyCurrency {
  return value === "USD" ? "USD" : "ARS";
}

function present(row: CaseRow): ReturnCaseView {
  const sale = row.sale;
  return {
    id: row.id,
    code: returnCode(row.caseNumber),
    caseNumber: row.caseNumber,
    saleId: row.saleId,
    clientId: row.clientId,
    clientName: row.clientName,
    inventoryItemId: row.inventoryItemId,
    imei: row.imei,
    deviceLabel: row.deviceLabel,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    reason: row.reason,
    diagnosis: row.diagnosis,
    openedOn: calendarDay(row.openedAt, ZONE),
    resolution: row.resolution,
    settlement: row.settlement,
    moneyAmount: money(row.moneyAmount),
    moneyCurrency: row.moneyCurrency,
    destination: row.destination,
    stockStatus: row.stockStatus,
    previousStatus: row.previousStatus,
    rmaStatus: row.rmaStatus,
    status: row.status,
    resolvedOn: row.resolvedAt ? calendarDay(row.resolvedAt, ZONE) : null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    refundable: refundableAmount(sale ? { status: sale.status, amount: money(sale.amount), openBalance: sale.openBalance == null ? null : money(sale.openBalance) } : null),
    saleAmount: money(sale?.amount),
    saleCurrency: sale?.amountCurrency ?? null,
    saleDate: sale?.dateLabel ?? null,
    warrantyDays: sale?.warrantyDays ?? null,
    itemCost: money(row.inventoryItem?.cost),
    itemCurrency: row.inventoryItem?.currency ?? null,
    creditNote: row.creditNote && !row.creditNote.deletedAt ? {
      id: row.creditNote.id,
      amount: money(row.creditNote.amount),
      remaining: money(row.creditNote.remaining),
      currency: row.creditNote.currency,
      status: row.creditNote.status,
    } : null,
    events: row.events.map((event) => ({ status: event.status, note: event.note, createdAt: event.createdAt.toISOString() })),
  };
}

async function loadCase(tx: Tx | typeof prisma, storeId: string, id: string) {
  return tx.returnCase.findFirst({ where: { id, storeId }, include: caseInclude });
}

function openedDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError("La fecha no es válida.");
  return new Date(`${value}T15:00:00.000Z`);
}

async function nextNumber(tx: Tx, storeId: string) {
  const last = await tx.returnCase.aggregate({ where: { storeId }, _max: { caseNumber: true } });
  return (last._max.caseNumber ?? 0) + 1;
}

export async function listReturnCases(storeId: string, archived = false): Promise<ReturnCaseView[]> {
  const rows = await prisma.returnCase.findMany({
    where: { storeId, ...(archived ? { OR: [{ deletedAt: { not: null } }, { status: "ANULADO" }] } : { deletedAt: null, status: { not: "ANULADO" } }) },
    include: caseInclude,
    orderBy: [{ openedAt: "desc" }, { caseNumber: "desc" }],
  });
  return rows.map(present);
}

export async function listCreditNotes(storeId: string, clientId?: string): Promise<CreditNoteView[]> {
  const rows = await prisma.creditNote.findMany({
    where: {
      storeId,
      deletedAt: null,
      status: "ABIERTA",
      remaining: { gt: 0 },
      ...(clientId ? { clientId } : {}),
    },
    include: { returnCase: { select: { caseNumber: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    returnCaseId: row.returnCaseId,
    code: returnCode(row.returnCase.caseNumber),
    amount: money(row.amount),
    remaining: money(row.remaining),
    currency: row.currency,
    status: row.status,
    deletedAt: null,
  }));
}

export async function createReturnCase(storeId: string, input: {
  saleId: string;
  reason: string;
  openedOn: string;
  diagnosis?: string | null;
  imei?: string | null;
}, actor: Actor) {
  const reason = input.reason.trim();
  if (!reason) throw new DomainError("Completá el motivo.");
  const diagnosis = input.diagnosis?.trim() || null;
  const openedAt = openedDate(input.openedOn);
  return withSerializableRetry(async (tx) => {
    await lockTransactionKey(tx, `returns:${storeId}`);
    const sale = await tx.sale.findFirst({
      where: { id: input.saleId, storeId },
      include: { inventoryItem: true, client: { select: { id: true, name: true } } },
    });
    if (!sale) throw new DomainError("No encontramos esa venta.", 404);
    if (sale.voidedAt) throw new DomainError("No se puede devolver una venta anulada.");
    if (sale.status === "CANCELADA") throw new DomainError("No se puede devolver una venta cancelada.");
    if (sale.status !== "COMPLETADA") throw new DomainError("La venta tiene que estar cobrada para abrir el reclamo.");
    const existing = await tx.returnCase.findFirst({ where: { storeId, saleId: sale.id, deletedAt: null, status: { not: "ANULADO" } }, select: { id: true } });
    if (existing) throw new DomainError("Esta venta ya tiene un reclamo.", 409);
    const item = sale.inventoryItem;
    const imei = (input.imei?.trim() || item?.imei || "").slice(0, 100);
    const deviceLabel = (sale.deviceLabel || [item?.model, item?.capacity].filter(Boolean).join(" ")).slice(0, 160);
    const created = await tx.returnCase.create({
      data: {
        storeId,
        caseNumber: await nextNumber(tx, storeId),
        saleId: sale.id,
        clientId: sale.clientId,
        clientName: sale.client?.name || sale.clientName || "",
        inventoryItemId: item?.id ?? null,
        imei,
        deviceLabel,
        supplierId: item?.supplierId ?? null,
        reason,
        diagnosis,
        openedAt,
        previousStatus: sale.previousInventoryStatus,
        status: diagnosis ? "EN_DIAGNOSTICO" : "ABIERTO",
        createdBy: actor.name,
        events: {
          create: [
            { storeId, status: "ABIERTO", note: "Ingresó el reclamo." },
            ...(diagnosis ? [{ storeId, status: "EN_DIAGNOSTICO", note: "Quedó el diagnóstico." }] : []),
          ],
        },
      },
      include: caseInclude,
    });
    const code = returnCode(created.caseNumber);
    await writeAudit(tx, {
      storeId,
      actor,
      action: "return.created",
      entityType: "return",
      entityId: created.id,
      entityLabel: code,
      detail: `Quedó abierto el reclamo ${code} de ${created.clientName || "un cliente"} por ${created.deviceLabel || "el equipo"}.`,
    });
    return present(created);
  });
}

export interface UpdateReturnInput {
  reason?: string;
  openedOn?: string;
  diagnosis?: string | null;
  status?: "ABIERTO" | "EN_DIAGNOSTICO";
  note?: string | null;
}

export async function updateReturnCase(storeId: string, id: string, input: UpdateReturnInput, actor: Actor) {
  const reason = input.reason?.trim();
  if (reason === "") throw new DomainError("Completá el motivo.");
  return withSerializableRetry(async (tx) => {
    await lockTransactionKey(tx, `returns:${storeId}`);
    const current = await loadCase(tx, storeId, id);
    if (!current || current.deletedAt || current.status === "ANULADO") return null;
    if (input.status && (current.status === "RESUELTO" || current.status === "EN_PROVEEDOR")) {
      throw new DomainError("Este reclamo ya tiene una resolución.", 409);
    }
    const status = input.status ?? (current.status === "ABIERTO" && input.diagnosis?.trim() ? "EN_DIAGNOSTICO" : current.status);
    const diagnosis = input.diagnosis === undefined ? current.diagnosis : input.diagnosis?.trim() || null;
    const note = input.note?.trim() || null;
    const changed = status !== current.status || diagnosis !== current.diagnosis ||
      (reason !== undefined && reason !== current.reason) ||
      (input.openedOn !== undefined && input.openedOn !== calendarDay(current.openedAt, ZONE));
    if (!changed && !note) return present(current);
    await tx.returnCase.update({
      where: { id },
      data: { status, diagnosis, ...(reason !== undefined ? { reason } : {}), ...(input.openedOn ? { openedAt: openedDate(input.openedOn) } : {}) },
    });
    await tx.returnEvent.create({ data: { storeId, caseId: id, status, note: note ?? (diagnosis !== current.diagnosis ? "Diagnóstico actualizado." : "Reclamo actualizado.") } });
    await writeAudit(tx, {
      storeId, actor, action: "return.updated", entityType: "return", entityId: id,
      entityLabel: returnCode(current.caseNumber), detail: `Se actualizó el reclamo ${returnCode(current.caseNumber)}.`,
      changes: [
        { field: "status", label: "Estado", before: current.status, after: status },
        { field: "reason", label: "Motivo", before: current.reason, after: reason ?? current.reason },
        { field: "diagnosis", label: "Diagnóstico", before: current.diagnosis, after: diagnosis },
        { field: "openedOn", label: "Fecha", before: calendarDay(current.openedAt, ZONE), after: input.openedOn ?? calendarDay(current.openedAt, ZONE) },
      ],
    });
    return present(await loadCase(tx, storeId, id) as CaseRow);
  });
}

export async function updateReturnDiagnosis(storeId: string, id: string, diagnosis: string, actor: Actor) {
  if (!diagnosis.trim()) throw new DomainError("Completá el diagnóstico.");
  return updateReturnCase(storeId, id, { diagnosis }, actor);
}

async function moveStock(tx: Tx, itemId: string, status: string) {
  await tx.inventoryItem.update({
    where: { id: itemId },
    data: {
      status,
      pendingSaleRegistration: false,
      reservedDepositId: null,
      reservedClientId: null,
      reservedClientName: null,
      reservedAt: null,
    },
  });
}

export async function resolveReturnCase(storeId: string, id: string, input: {
  resolution: Resolution;
  settlement: Settlement;
  amount: number;
  destination: Destination;
  stockStatus?: string | null;
  diagnosis?: string | null;
  note?: string | null;
}, actor: Actor) {
  const problem = resolutionError(input);
  if (problem) throw new DomainError(problem);
  return withSerializableRetry(async (tx) => {
    await lockTransactionKey(tx, `returns:${storeId}`);
    const current = await loadCase(tx, storeId, id);
    if (!current || current.deletedAt || current.status === "ANULADO") return null;
    if (current.resolvedAt || current.status === "RESUELTO" || current.status === "EN_PROVEEDOR") {
      throw new DomainError("Este reclamo ya está resuelto.", 409);
    }
    const sale = current.saleId ? await tx.sale.findFirst({ where: { id: current.saleId, storeId } }) : null;
    const item = current.inventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: current.inventoryItemId, storeId } }) : null;
    // Cancelar el reclamo conserva sus movimientos: también consumen el límite.
    const previous = current.saleId ? await tx.returnCase.aggregate({
      where: {
        storeId, saleId: current.saleId, id: { not: current.id },
        settlement: { in: ["REINTEGRO", "NOTA_CREDITO"] },
      },
      _sum: { moneyAmount: true },
    }) : null;
    const cap = Math.max(0, roundMoney(refundableAmount(sale ? { status: sale.status, amount: money(sale.amount), openBalance: sale.openBalance == null ? null : money(sale.openBalance) } : null) - money(previous?._sum.moneyAmount)));
    const amount = roundMoney(input.amount);
    if (input.settlement !== "NINGUNO" && amount > cap + 0.001) {
      throw new DomainError("El importe supera lo que se cobró en esa venta.");
    }
    if (input.settlement !== "NINGUNO" && !current.clientId) {
      throw new DomainError("Para devolver plata o dejar una nota, la venta tiene que tener un cliente.");
    }
    const currency = currencyOf(sale?.amountCurrency);
    let stockStatus: string | null = null;
    let rmaStatus: string | null = null;
    let status = "RESUELTO";
    if (input.destination === "STOCK") {
      if (!item) throw new DomainError("Esta venta no tiene un equipo en stock para devolver.");
      const chosen = stockStatusForReturn(item.status, current.previousStatus, input.stockStatus ?? "");
      if (!chosen.ok) throw new DomainError(chosen.message);
      stockStatus = chosen.status;
      await moveStock(tx, item.id, stockStatus);
    }
    if (input.destination === "PROVEEDOR") {
      if (!item) throw new DomainError("Esta venta no tiene un equipo para mandar al proveedor.");
      if (!item.supplierId && !current.supplierId) {
        throw new DomainError("Este equipo no tiene proveedor. Cargalo en el inventario antes de mandarlo a RMA.");
      }
      rmaStatus = "ENVIADO";
      status = "EN_PROVEEDOR";
      await moveStock(tx, item.id, "EN_RMA");
    }
    const now = new Date();
    if (input.settlement === "REINTEGRO" && current.clientId && sale) {
      await tx.clientPayment.create({
        data: {
          storeId,
          clientId: current.clientId,
          amount: new Decimal(amount),
          currency,
          method: sale.paymentMethod,
          kind: "DEVOLUCION",
          paidAt: now,
          note: `Reintegro del reclamo ${returnCode(current.caseNumber)}`.slice(0, 200),
          saleId: sale.id,
        },
      });
      await recordCash(tx, {
        storeId,
        amount: -amount,
        currency,
        method: sale.paymentMethod,
        sourceType: "return",
        sourceId: current.id,
        note: "Reintegro de devolución",
        actor,
      });
    }
    if (input.settlement === "NOTA_CREDITO" && current.clientId) {
      await tx.creditNote.create({
        data: {
          storeId,
          clientId: current.clientId,
          returnCaseId: current.id,
          saleId: sale?.id ?? null,
          amount: new Decimal(amount),
          remaining: new Decimal(amount),
          currency,
          status: "ABIERTA",
        },
      });
    }
    if (current.clientId && amount > 0 && input.settlement !== "NINGUNO") {
      const client = await tx.client.findFirst({ where: { id: current.clientId, storeId }, select: { totalSpent: true } });
      if (client) {
        const next = Math.max(0, money(client.totalSpent) - amount);
        await tx.client.update({ where: { id: current.clientId }, data: { totalSpent: new Decimal(next) } });
      }
    }
    const supplierId = item?.supplierId ?? current.supplierId;
    await tx.returnCase.update({
      where: { id },
      data: {
        ...(input.diagnosis !== undefined ? { diagnosis: input.diagnosis?.trim() || null } : {}),
        resolution: input.resolution,
        settlement: input.settlement,
        moneyAmount: new Decimal(amount),
        moneyCurrency: currency,
        destination: input.destination,
        stockStatus,
        rmaStatus,
        status,
        supplierId,
        resolvedAt: status === "RESUELTO" ? now : null,
      },
    });
    const eventNote = input.destination === "PROVEEDOR"
      ? "Se mandó el equipo al proveedor."
      : input.destination === "STOCK"
        ? "El equipo volvió al stock."
        : "El equipo sigue con el cliente.";
    await tx.returnEvent.create({ data: { storeId, caseId: id, status, note: input.note?.trim() || eventNote } });
    const code = returnCode(current.caseNumber);
    const moneyText = input.settlement === "REINTEGRO"
      ? `con un reintegro de ${formatArMoney(amount, currency)}`
      : input.settlement === "NOTA_CREDITO"
        ? `con una nota de crédito de ${formatArMoney(amount, currency)}`
        : "sin movimiento de plata";
    const where = input.destination === "PROVEEDOR"
      ? "El equipo quedó en RMA con el proveedor."
      : input.destination === "STOCK"
        ? "El equipo volvió al stock con otro estado."
        : "El equipo sigue con el cliente.";
    await writeAudit(tx, {
      storeId,
      actor,
      action: "return.resolved",
      entityType: "return",
      entityId: id,
      entityLabel: code,
      detail: `Quedó resuelto el reclamo ${code} ${moneyText}. ${where}`,
    });
    return present(await loadCase(tx, storeId, id) as CaseRow);
  });
}

export async function advanceRma(storeId: string, id: string, input: { status: RmaStatus; stockStatus?: string | null; note?: string | null }, actor: Actor) {
  return withSerializableRetry(async (tx) => {
    await lockTransactionKey(tx, `returns:${storeId}`);
    const current = await loadCase(tx, storeId, id);
    if (!current || current.deletedAt || current.status === "ANULADO") return null;
    if (current.status !== "EN_PROVEEDOR") throw new DomainError("Este reclamo no está en el proveedor.");
    if (current.rmaStatus === "RECIBIDO" || current.rmaStatus === "RECHAZADO") {
      throw new DomainError("El RMA con el proveedor ya terminó.", 409);
    }
    if (input.status === current.rmaStatus) throw new DomainError("El RMA ya está en ese estado.");
    let stockStatus = current.stockStatus;
    let status = current.status;
    let resolvedAt = current.resolvedAt;
    if (input.status === "RECIBIDO") {
      const item = current.inventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: current.inventoryItemId, storeId } }) : null;
      if (!item) throw new DomainError("No encontramos el equipo de este reclamo.", 404);
      if (current.resolution === "REPARACION") {
        await moveStock(tx, item.id, "VENDIDO");
        stockStatus = "VENDIDO";
      } else {
        const chosen = stockStatusForReturn(item.status, current.previousStatus, input.stockStatus ?? "");
        if (!chosen.ok) throw new DomainError(chosen.message);
        stockStatus = chosen.status;
        await moveStock(tx, item.id, stockStatus);
      }
      status = "RESUELTO";
      resolvedAt = new Date();
    }
    if (input.status === "RECHAZADO") {
      status = "RESUELTO";
      resolvedAt = new Date();
    }
    await tx.returnCase.update({
      where: { id },
      data: { rmaStatus: input.status, stockStatus, status, resolvedAt },
    });
    const note = input.status === "RECIBIDO"
      ? "El proveedor devolvió el equipo."
      : input.status === "RECHAZADO"
        ? "El proveedor rechazó el RMA."
        : "Cambió el estado del RMA.";
    await tx.returnEvent.create({ data: { storeId, caseId: id, status: input.status, note: input.note?.trim() || note } });
    const code = returnCode(current.caseNumber);
    const sentence: Record<RmaStatus, string> = {
      ENVIADO: `El reclamo ${code} quedó enviado al proveedor.`,
      EN_REVISION: `El reclamo ${code} quedó en revisión del proveedor.`,
      APROBADO: `El proveedor aprobó el reclamo ${code}.`,
      RECHAZADO: `El proveedor rechazó el reclamo ${code}. El equipo sigue en RMA.`,
      RECIBIDO: `El proveedor devolvió el equipo del reclamo ${code}.`,
    };
    await writeAudit(tx, {
      storeId,
      actor,
      action: "return.rma",
      entityType: "return",
      entityId: id,
      entityLabel: code,
      detail: sentence[input.status],
    });
    return present(await loadCase(tx, storeId, id) as CaseRow);
  });
}

export async function archiveReturnCase(storeId: string, id: string, actor: Actor, reason?: string | null) {
  return withSerializableRetry(async (tx) => {
    await lockTransactionKey(tx, `returns:${storeId}`);
    const current = await tx.returnCase.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!current) return false;
    if (current.status === "ANULADO") return true;
    await tx.returnCase.update({ where: { id }, data: { status: "ANULADO", deletedAt: new Date(), deletedBy: actor.name } });
    await tx.returnEvent.create({ data: { storeId, caseId: id, status: "ANULADO", note: reason?.trim().slice(0, 280) || "Reclamo anulado." } });
    const code = returnCode(current.caseNumber);
    await writeAudit(tx, {
      storeId,
      actor,
      reason,
      action: "return.cancelled",
      entityType: "return",
      entityId: id,
      entityLabel: code,
      detail: `Quedó anulado el reclamo ${code}. Se conserva el historial.`,
    });
    return true;
  });
}

export async function restoreReturnCase(storeId: string, id: string, actor: Actor) {
  return withSerializableRetry(async (tx) => {
    await lockTransactionKey(tx, `returns:${storeId}`);
    const current = await tx.returnCase.findFirst({ where: { id, storeId, deletedAt: { not: null } } });
    if (!current) return null;
    if (current.status === "ANULADO") throw new DomainError("Un reclamo anulado no se puede restaurar.", 409);
    if (current.saleId) {
      const other = await tx.returnCase.findFirst({ where: { storeId, saleId: current.saleId, deletedAt: null, id: { not: id } }, select: { id: true } });
      if (other) throw new DomainError("Esa venta ya tiene otro reclamo activo.", 409);
    }
    await tx.returnCase.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
    const code = returnCode(current.caseNumber);
    await writeAudit(tx, {
      storeId,
      actor,
      action: "return.restored",
      entityType: "return",
      entityId: id,
      entityLabel: code,
      detail: `Volvió a estar activo el reclamo ${code}.`,
    });
    return present(await loadCase(tx, storeId, id) as CaseRow);
  });
}

export async function coverSaleWithCredits(tx: Tx, input: {
  storeId: string;
  clientId: string | null;
  saleId: string;
  noteIds: string[];
  due: number;
  currency: string;
  rate: number | null;
  actor?: Actor | null;
}) {
  if (!input.noteIds.length) return 0;
  if (!input.clientId) throw new DomainError("La nota de crédito necesita un cliente en la venta.");
  await lockTransactionKey(tx, `returns:${input.storeId}`);
  const notes = await tx.creditNote.findMany({
    where: { id: { in: input.noteIds }, storeId: input.storeId, deletedAt: null },
    include: { returnCase: { select: { caseNumber: true } } },
  });
  if (notes.length !== new Set(input.noteIds).size) throw new DomainError("No encontramos esa nota de crédito.", 404);
  if (notes.some((note) => note.clientId !== input.clientId)) throw new DomainError("La nota de crédito es de otro cliente.");
  if (notes.some((note) => note.status !== "ABIERTA" || money(note.remaining) <= 0)) {
    throw new DomainError("Esa nota de crédito ya no tiene saldo.");
  }
  const byId = new Map(notes.map((note) => [note.id, note]));
  const ordered = input.noteIds.map((id) => byId.get(id)!);
  const plan = planCreditApplication({
    due: input.due,
    currency: currencyOf(input.currency),
    rate: input.rate,
    notes: ordered.map((note) => ({ id: note.id, remaining: money(note.remaining), currency: currencyOf(note.currency) })),
  });
  if (plan.ok === false) throw new DomainError(plan.message);
  for (const application of plan.applications) {
    const note = byId.get(application.id)!;
    const remaining = roundMoney(money(note.remaining) - application.noteAmount);
    await tx.creditNote.update({
      where: { id: note.id },
      data: { remaining: new Decimal(remaining), status: remaining <= 0 ? "APLICADA" : "ABIERTA" },
    });
    await tx.creditNoteApplication.create({
      data: {
        storeId: input.storeId,
        creditNoteId: note.id,
        saleId: input.saleId,
        amount: new Decimal(application.saleAmount),
        currency: currencyOf(input.currency),
      },
    });
    const code = returnCode(note.returnCase.caseNumber);
    await writeAudit(tx, {
      storeId: input.storeId,
      actor: input.actor,
      action: "credit.applied",
      entityType: "return",
      entityId: note.returnCaseId,
      entityLabel: code,
      detail: `Se aplicó la nota de crédito ${code} de ${formatArMoney(application.saleAmount, input.currency)} a la venta.`,
    });
  }
  return plan.covered;
}
