import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { recordCash } from '../cash/service.js';
import { parseMoney } from "../import/sheet-plan.js";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { normalizeCustomFields } from "../../lib/custom-fields.js";
import { formatArDate, parseArDate } from "../../lib/ar-date.js";
import { moneyChanged, writeAudit, type Actor } from "../audit/audit.js";
import { diffFields } from "../audit/diff-fields.js";
import { archivedMatch, cleanReason, type ArchiveMeta } from "../audit/archive.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { clientsRepository } from "./clients.repository.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";
import { blankFieldsToFill, decideClientLink } from "../import/link-imported-sale.js";
import { normalizeImportedDni, normalizeImportedEmail, normalizeImportedInstagram, normalizeImportedPhone } from "../import/normalize-import.js";
import { clientDeleteRefusal, creditAmount, type DepositBalanceRow } from "./client-balance.js";

export interface ClientInput {
  dni?: string | null;
  name: string;
  categoryId?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  lastPurchaseDate?: string | null;
  totalSpent?: number;
  pendingBalance?: number;
  balanceCurrency?: string | null;
  tag?: string | null;
  birthday?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface ClientResponse {
  id: string;
  dni: string;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  lastPurchaseDate: string;
  totalSpent: number;
  importedSpent: number | null;
  importedSpentCurrency: string | null;
  pendingBalance: number;
  creditBalance: number;
  balanceCurrency: string | null;
  categoryId: string | null;
  tag: string | null;
  birthday: string | null;
  customFields: Record<string, unknown>;
  createdAt: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
}

export interface ClientCategoryResponse {
  id: string;
  name: string;
  archived?: boolean;
}

type ClientRecord = {
  id: string;
  dni: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  instagram?: string | null;
  lastPurchaseAt: Date | null;
  totalSpent: Decimal;
  importedSpent?: Decimal | null;
  importedSpentCurrency?: string | null;
  pendingBalance: Decimal;
  balanceCurrency?: string | null;
  categoryId: string | null;
  tag?: string | null;
  birthday?: Date | null;
  customFields: Prisma.JsonValue | null;
  createdAt?: Date | null;
  archivedAt?: Date | null;
  archivedBy?: string | null;
};

class ClientsError extends DomainError {}

const toDecimal = (value?: number) => new Decimal(value ?? 0);

async function assertCategoryBelongsToStore(storeId: string, categoryId?: string | null, db: Prisma.TransactionClient = prisma) {
  if (categoryId === undefined || categoryId === null) {
    return;
  }

  const category = await db.clientCategory.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });

  if (!category) {
    throw new ClientsError("Category not found", 404);
  }
}

const toCustomFields = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const formatDate = (value: Date | null) => {
  if (!value) return "N/A";
  return formatArDate(value);
};

export function serializeClient(client: ClientRecord, creditBalance = 0): ClientResponse {
  return {
    id: client.id,
    dni: client.dni ?? "",
    name: client.name,
    email: client.email ?? "",
    phone: client.phone ?? "",
    instagram: client.instagram ?? "",
    lastPurchaseDate: formatDate(client.lastPurchaseAt),
    totalSpent: client.totalSpent.toNumber(),
    importedSpent: client.importedSpent?.toNumber() ?? null,
    importedSpentCurrency: client.importedSpentCurrency ?? null,
    pendingBalance: client.pendingBalance.toNumber(),
    creditBalance,
    balanceCurrency: client.balanceCurrency ?? null,
    categoryId: client.categoryId ?? null,
    tag: client.tag ?? null,
    birthday: client.birthday ? client.birthday.toISOString().slice(0, 10) : null,
    customFields: toCustomFields(client.customFields),
    createdAt: client.createdAt ? client.createdAt.toISOString() : null,
    archivedAt: client.archivedAt ? client.archivedAt.toISOString() : null,
    archivedBy: client.archivedBy ?? null,
  };
}

function parseBirthday(value?: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ClientsError("El cumpleaños tiene que tener formato aaaa-mm-dd");
  return new Date(`${value}T12:00:00.000Z`);
}

function parseLastPurchaseDate(value?: string | null) {
  if (!value || value === "N/A") {
    return null;
  }

  return parseArDate(value);
}

export async function listClients(storeId: string, options?: { archived?: boolean }) {
  const [clients, credits] = await Promise.all([
    clientsRepository.list(storeId, Boolean(options?.archived)),
    prisma.clientDeposit.findMany({
      where: { storeId, status: "CREDIT" },
      select: { clientId: true, status: true, amount: true, currency: true, usdAmount: true, exchangeRate: true },
    }),
  ]);
  const byClient = new Map<string, DepositBalanceRow[]>();
  for (const row of credits) {
    const list = byClient.get(row.clientId) ?? [];
    list.push(row);
    byClient.set(row.clientId, list);
  }

  return clients.map((client) => serializeClient(client, creditAmount(byClient.get(client.id) ?? [], client.balanceCurrency ?? null)));
}

function normalizeDni(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export async function createClient(storeId: string, input: ClientInput, actor?: Actor | null) {
  const dni = normalizeDni(input.dni);
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  if (dni) {
    const existing = await clientsRepository.findIdByDni(storeId, dni);

    if (existing?.archivedAt) {
      throw archivedMatch("Este cliente está archivado. ¿Restaurarlo?", existing.id, "client");
    }
    if (existing) {
      throw new ClientsError("Client already exists", 409);
    }
  }

  const balanceCurrency = currencyOnWrite(
    input.balanceCurrency,
    input.pendingBalance !== undefined || input.totalSpent !== undefined,
    await storeCurrency(storeId, prisma),
  );
  const client = await clientsRepository.create({
      storeId,
      dni,
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      instagram: normalizeImportedInstagram(input.instagram ?? undefined) || null,
      categoryId: input.categoryId ?? null,
      lastPurchaseAt: parseLastPurchaseDate(input.lastPurchaseDate),
      totalSpent: toDecimal(input.totalSpent),
      pendingBalance: toDecimal(input.pendingBalance),
      ...(balanceCurrency ? { balanceCurrency } : {}),
      tag: input.tag || null,
      birthday: parseBirthday(input.birthday),
      customFields: normalizeCustomFields(input.customFields),
  });

  if (actor) {
    await writeAudit(prisma, {
      storeId,
      actor,
      action: "client.created",
      entityType: "client",
      entityId: client.id,
      entityLabel: client.name,
      detail: client.name,
    });
  }

  return serializeClient(client);
}

export async function updateClient(storeId: string, id: string, input: Partial<ClientInput>, actor?: Actor | null) {
  const updated = await withSerializableRetry(async (tx) => {
    const existing = await tx.client.findFirst({ where: { id, storeId } });

    if (!existing) {
      return null;
    }

    if (input.dni !== undefined) {
      const nextDni = normalizeDni(input.dni);
      if (nextDni) {
        const duplicate = await tx.client.findFirst({ where: { storeId, dni: nextDni, id: { not: id } } });

        if (duplicate?.archivedAt) {
          throw archivedMatch("Este cliente está archivado. ¿Restaurarlo?", duplicate.id, "client");
        }
        if (duplicate) {
          throw new ClientsError("Client already exists", 409);
        }
      }
    }

    await assertCategoryBelongsToStore(storeId, input.categoryId, tx);
    const spentChanges = input.totalSpent !== undefined && moneyChanged(existing.totalSpent, input.totalSpent);
    const balanceChanges = input.pendingBalance !== undefined && moneyChanged(existing.pendingBalance, input.pendingBalance);
    if (spentChanges || balanceChanges) {
      const activeIntegratedSale = await tx.sale.findFirst({ where: { storeId, clientId: id, integratedOperation: true, status: { not: "CANCELADA" }, voidedAt: null }, select: { id: true } });
      if (activeIntegratedSale) throw new ClientsError("Los saldos vinculados a una operación se actualizan desde Operaciones o Pagos", 409);
    }
    const nextCurrency = currencyOnWrite(input.balanceCurrency, spentChanges || balanceChanges, spentChanges || balanceChanges ? await storeCurrency(storeId, tx) : "ARS");

    const client = await tx.client.update({
      where: { id },
      data: {
        ...(input.dni !== undefined ? { dni: normalizeDni(input.dni) } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.instagram !== undefined ? { instagram: normalizeImportedInstagram(input.instagram ?? undefined) || null } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.lastPurchaseDate !== undefined ? { lastPurchaseAt: parseLastPurchaseDate(input.lastPurchaseDate) } : {}),
        ...(input.totalSpent !== undefined ? { totalSpent: toDecimal(input.totalSpent) } : {}),
        ...(input.pendingBalance !== undefined ? { pendingBalance: toDecimal(input.pendingBalance) } : {}),
        ...(nextCurrency ? { balanceCurrency: nextCurrency } : {}),
        ...(input.tag !== undefined ? { tag: input.tag || null } : {}),
        ...(input.birthday !== undefined ? { birthday: parseBirthday(input.birthday) } : {}),
        ...(input.customFields !== undefined ? { customFields: normalizeCustomFields(input.customFields) } : {}),
      },
    });
    if (input.name !== undefined && client.name !== existing.name) {
      await tx.inventoryItem.updateMany({ where: { storeId, reservedClientId: id }, data: { reservedClientName: client.name } });
      await tx.sale.updateMany({ where: { storeId, clientId: id, integratedOperation: true }, data: { clientName: client.name } });
      await tx.tradeIn.updateMany({ where: { storeId, clientId: id, confirmationStatus: { not: null } }, data: { clientName: client.name } });
    }
    const changes = diffFields(
      { name: existing.name, dni: existing.dni, phone: existing.phone, email: existing.email, instagram: existing.instagram, tag: existing.tag },
      { name: client.name, dni: client.dni, phone: client.phone, email: client.email, instagram: client.instagram, tag: client.tag },
      [
        { field: "name", label: "Nombre" },
        { field: "dni", label: "DNI" },
        { field: "phone", label: "Teléfono" },
        { field: "email", label: "Email" },
        { field: "instagram", label: "Instagram" },
        { field: "tag", label: "Etiqueta" },
      ],
    );
    if (actor && changes.length) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "client.updated",
        entityType: "client",
        entityId: id,
        entityLabel: client.name,
        detail: client.name,
        changes,
      });
    }
    return client;
  });

  return updated ? serializeClient(updated) : null;
}

export async function listClientPayments(storeId: string, clientId: string) {
  const client = await clientsRepository.findForDelete(storeId, clientId);
  if (!client) return null;

  const rows = await clientsRepository.listPayments(storeId, clientId);

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount.toNumber(),
    method: row.method,
    kind: row.kind,
    note: row.note,
    saleId: row.saleId,
    paidAt: row.paidAt.toISOString(),
    currency: row.currency ?? null,
  }));
}

export async function registerClientPayment(
  storeId: string,
  clientId: string,
  input: { amount: number; method: string; currency?: string | null }
) {
  return withSerializableRetry(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: clientId, storeId } });
    if (!client) return null;

    const balance = new Decimal(client.pendingBalance.toString());
    const amount = new Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new ClientsError("El monto tiene que ser mayor a cero");
    if (amount.greaterThan(balance)) throw new ClientsError("El monto supera el saldo");
    const currency = currencyOnWrite(input.currency, true, await storeCurrency(storeId, tx));

    await tx.clientPayment.create({
      data: {
        storeId,
        clientId,
        amount,
        currency,
        method: input.method.trim(),
        paidAt: new Date(),
      },
    });

    await recordCash(tx, { storeId, amount: input.amount, currency: currency ?? await storeCurrency(storeId, tx), method: input.method, sourceType: 'client', sourceId: clientId, note: 'Cobro de cuenta corriente' });
    const updated = await tx.client.update({
      where: { id: clientId },
      data: { pendingBalance: balance.minus(amount) },
    });

    return serializeClient(updated);
  });
}

export async function deleteClient(storeId: string, id: string, actor?: Actor | null, meta?: ArchiveMeta) {
  return withSerializableRetry(async (tx) => {
    const existing = await tx.client.findFirst({ where: { id, storeId } });
    if (!existing || existing.archivedAt) return false;
    const [activeOperation, activeTrade, deposits] = await Promise.all([
      tx.sale.findFirst({ where: { storeId, clientId: id, integratedOperation: true, status: { not: "CANCELADA" }, voidedAt: null }, select: { id: true } }),
      tx.tradeIn.findFirst({ where: { storeId, clientId: id, confirmationStatus: { not: "CANCELLED" }, voidedAt: null }, select: { id: true } }),
      tx.clientDeposit.findMany({ where: { storeId, clientId: id }, select: { status: true, amount: true, currency: true, usdAmount: true, exchangeRate: true } }),
    ]);
    if (activeOperation || activeTrade) throw new ClientsError("El cliente tiene una operación activa y no se puede archivar", 409);
    const refusal = clientDeleteRefusal(deposits, existing.balanceCurrency ?? null);
    if (refusal) throw new ClientsError(refusal, 409);
    const reason = cleanReason(meta?.reason);
    await tx.client.update({
      where: { id },
      data: { archivedAt: new Date(), archivedBy: actor?.name ?? null },
    });
    if (actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "client.archived",
        entityType: "client",
        entityId: id,
        entityLabel: existing.name,
        detail: existing.name,
        reason,
        source: meta?.source ?? "app",
        changes: [{ field: "status", label: "Estado", before: "Activo", after: "Archivado" }],
      });
    }
    return true;
  });
}

export async function restoreClient(storeId: string, id: string, actor?: Actor | null) {
  const existing = await clientsRepository.findInStore(storeId, id);
  if (!existing?.archivedAt) return null;
  if (existing.dni) {
    const clash = await clientsRepository.findDniDuplicate(storeId, existing.dni, id);
    if (clash && !clash.archivedAt) throw new ClientsError("Ya hay un cliente activo con ese DNI", 409);
  }
  const updated = await clientsRepository.update(id, { archivedAt: null, archivedBy: null });
  await writeAudit(prisma, {
    storeId,
    actor,
    action: "client.restored",
    entityType: "client",
    entityId: id,
    entityLabel: existing.name,
    changes: [{ field: "status", label: "Estado", before: "Archivado", after: "Activo" }],
  });
  return serializeClient(updated);
}

export interface ClientImportRow {
  importedSpent?: string;
  importedSpentCurrency?: string;
  name?: string;
  dni?: string;
  email?: string;
  phone?: string;
  instagram?: string;
}

export interface ClientImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importClients(
  storeId: string,
  rows: ClientImportRow[]
): Promise<ClientImportResult> {
  let imported = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];
  const known = (await clientsRepository.list(storeId)).map((client) => ({
    id: client.id,
    name: client.name,
    dni: client.dni,
    phone: client.phone,
    email: client.email,
    instagram: client.instagram,
  }));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const name = r.name?.trim().replace(/\s+/g, " ") ?? "";
    if (!name) {
      errors.push({ row: rowNum, message: "Nombre requerido" });
      continue;
    }

    const dni = normalizeImportedDni(r.dni);
    const phone = normalizeImportedPhone(r.phone);
    const email = normalizeImportedEmail(r.email);
    const instagram = normalizeImportedInstagram(r.instagram);

    try {
      // A snapshot replaces the previous opening history. Never add it to the
      // mutable accumulator, balances or the count of actual receipts.
      const hasHistory = Boolean(r.importedSpent?.trim());
      const amount = hasHistory ? parseMoney(r.importedSpent!) : null;
      const currency = r.importedSpentCurrency?.trim().toUpperCase();
      if (hasHistory && (amount == null || amount < 0 || amount > 9999999999.99)) {
        errors.push({ row: rowNum, message: "El histórico importado debe ser un monto válido, mayor o igual a cero" });
        continue;
      }
      if (hasHistory && currency !== "ARS" && currency !== "USD") {
        errors.push({ row: rowNum, message: "Indicá ARS o USD como moneda del histórico importado" });
        continue;
      }
      const history = hasHistory ? { importedSpent: new Decimal(amount!).toDecimalPlaces(2), importedSpentCurrency: currency! } : {};
      const decision = decideClientLink(known, { name, dni, phone, email });
      if (decision.action === "ambiguous") {
        errors.push({ row: rowNum, message: "Hay más de un cliente con esos datos y no se duplicó" });
        continue;
      }
      if (decision.action === "use") {
        const current = known.find((client) => client.id === decision.clientId);
        if (!current) continue;
        const dniTaken = Boolean(dni && known.some((client) => client.id !== current.id && normalizeImportedDni(client.dni ?? "") === dni));
        const patch = { ...blankFieldsToFill(current, { dni, phone, email, instagram }, dniTaken), ...history };
        if (Object.keys(patch).length > 0) {
          await clientsRepository.update(current.id, patch);
          Object.assign(current, patch);
        }
        updated++;
        continue;
      }

      const created = await clientsRepository.create({
        storeId,
        name: name.slice(0, 120),
        ...history,
        dni: dni || null,
        email: email || null,
        phone: phone || null,
        instagram: instagram || null,
      });
      known.push({
        id: created.id,
        name: created.name,
        dni: created.dni,
        phone: created.phone,
        email: created.email,
        instagram: created.instagram,
      });
      imported++;
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  return { imported, updated, errors };
}

// ── Client Categories ─────────────────────────────────────────────────────────

export async function listClientCategories(storeId: string): Promise<ClientCategoryResponse[]> {
  const rows = await clientsRepository.listCategories(storeId);
  return rows.map((row) => ({
    id: row.id,
    name: row.archivedAt ? `${row.name} (archivada)` : row.name,
    archived: Boolean(row.archivedAt),
  }));
}

export async function createClientCategory(storeId: string, name: string): Promise<ClientCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new ClientsError("Category name required", 400);
  const existing = await clientsRepository.findCategoryByName(storeId, trimmed);
  if (existing?.archivedAt) {
    return clientsRepository.updateCategoryArchive(existing.id, null);
  }
  if (existing) throw new ClientsError("Category already exists", 409);
  const count = await clientsRepository.countCategories(storeId);
  return clientsRepository.createCategory(storeId, trimmed, count);
}

export async function renameClientCategory(storeId: string, id: string, name: string): Promise<ClientCategoryResponse | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new ClientsError("Category name required", 400);
  const existing = await clientsRepository.findCategoryInStore(storeId, id);
  if (!existing) return null;
  return clientsRepository.renameCategory(id, trimmed);
}

export async function deleteClientCategory(storeId: string, id: string, actor?: Actor | null): Promise<boolean> {
  const existing = await clientsRepository.findCategoryInStore(storeId, id);
  if (!existing || existing.archivedAt) return false;
  await clientsRepository.archiveCategory(storeId, id);
  if (actor) {
    await writeAudit(prisma, {
      storeId,
      actor,
      action: "category.archived",
      entityType: "category",
      entityId: id,
      entityLabel: existing.name,
      detail: "Clientes",
    });
  }
  return true;
}

export async function reorderClientCategories(storeId: string, categoryIds: string[]): Promise<void> {
  await clientsRepository.reorderCategories(storeId, categoryIds);
}

export async function bulkMoveClientCategory(storeId: string, ids: string[], categoryId: string | null): Promise<number> {
  if (categoryId !== null) {
    const cat = await clientsRepository.findCategoryInStore(storeId, categoryId);
    if (!cat) throw new ClientsError("Category not found", 404);
  }
  const result = await clientsRepository.moveToCategory(storeId, ids, categoryId);
  return result.count;
}
