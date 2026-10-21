import { Decimal } from "@prisma/client/runtime/library";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { writeAudit, type Actor } from "../audit/audit.js";
import { calendarDay, parseIsoDay } from "../periodic-reports/schedule.js";

const ZONE = "America/Argentina/Buenos_Aires";

export interface ExpenseInput {
  date: string;
  category: string;
  amount: number;
  currency: "ARS" | "USD";
  exchangeRate?: number | null;
  notes?: string | null;
}

export interface ExpenseView {
  id: string;
  date: string;
  category: string;
  amount: number;
  currency: "ARS" | "USD";
  exchangeRate: number | null;
  notes: string | null;
  deletedAt: string | null;
}

function moneyText(amount: number, currency: string) {
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(amount);
  return currency === "USD" ? `US$ ${formatted}` : `$ ${formatted}`;
}

function spentAt(date: string) {
  if (!parseIsoDay(date)) throw new DomainError("La fecha no es válida");
  return new Date(`${date}T15:00:00.000Z`);
}

function present(row: {
  id: string;
  spentAt: Date;
  category: string;
  amount: { toString(): string };
  currency: string;
  exchangeRate: { toString(): string } | null;
  notes: string | null;
  deletedAt: Date | null;
}): ExpenseView {
  return {
    id: row.id,
    date: calendarDay(row.spentAt, ZONE),
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency === "USD" ? "USD" : "ARS",
    exchangeRate: row.exchangeRate == null ? null : Number(row.exchangeRate),
    notes: row.notes,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function dataOf(input: ExpenseInput) {
  const category = input.category.trim();
  if (!category) throw new DomainError("Completá la categoría");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new DomainError("El monto tiene que ser mayor a cero");
  const rate = input.exchangeRate;
  return {
    spentAt: spentAt(input.date),
    category: category.slice(0, 80),
    amount: new Decimal(input.amount.toFixed(2)),
    currency: input.currency,
    exchangeRate: rate != null && Number.isFinite(rate) && rate > 0 ? new Decimal(rate.toFixed(2)) : null,
    notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
  };
}

export async function listExpenses(storeId: string, archived = false): Promise<ExpenseView[]> {
  const rows = await prisma.expense.findMany({
    where: { storeId, deletedAt: archived ? { not: null } : null },
    orderBy: [{ spentAt: "desc" }, { id: "desc" }],
  });
  return rows.map(present);
}

export async function createExpense(storeId: string, input: ExpenseInput, actor: Actor) {
  const data = dataOf(input);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: { storeId, ...data, createdBy: actor.name },
    });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "expense.created",
      entityType: "expense",
      entityId: created.id,
      entityLabel: created.category,
      detail: `Quedó registrado el gasto de ${created.category} por ${moneyText(Number(created.amount), created.currency)}.`,
    });
    return created;
  });
  return present(row);
}

export async function updateExpense(storeId: string, id: string, input: ExpenseInput, actor: Actor) {
  const row = await withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Expense" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`;
    const existing = await tx.expense.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!existing) return null;
    const data = dataOf(input);
    const updated = await tx.expense.update({ where: { id }, data });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "expense.updated",
      entityType: "expense",
      entityId: id,
      entityLabel: updated.category,
      detail: `Quedó actualizado el gasto de ${updated.category} por ${moneyText(Number(updated.amount), updated.currency)}.`,
    });
    return updated;
  });
  return row ? present(row) : null;
}

export async function archiveExpense(storeId: string, id: string, actor: Actor) {
  return withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Expense" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`;
    const existing = await tx.expense.findFirst({ where: { id, storeId, deletedAt: null } });
    if (!existing) return false;
    await tx.expense.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: actor.name } });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "expense.archived",
      entityType: "expense",
      entityId: id,
      entityLabel: existing.category,
      detail: `Quedó archivado el gasto de ${existing.category} y dejó de restar en la ganancia neta.`,
    });
    return true;
  });
}

export async function restoreExpense(storeId: string, id: string, actor: Actor) {
  const row = await withSerializableRetry(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Expense" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`;
    const existing = await tx.expense.findFirst({ where: { id, storeId, deletedAt: { not: null } } });
    if (!existing) return null;
    const restored = await tx.expense.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
    await writeAudit(tx, {
      storeId,
      actor,
      action: "expense.restored",
      entityType: "expense",
      entityId: id,
      entityLabel: restored.category,
      detail: `Volvió a contar el gasto de ${restored.category} en la ganancia neta.`,
    });
    return restored;
  });
  return row ? present(row) : null;
}
