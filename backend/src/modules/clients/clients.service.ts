import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { formatArDate, parseArDate } from "../../lib/ar-date.js";
import { prisma } from "../../plugins/prisma.js";

export interface ClientInput {
  dni: string;
  name: string;
  categoryId?: string | null;
  email?: string | null;
  phone?: string | null;
  lastPurchaseDate?: string | null;
  totalSpent?: number;
  pendingBalance?: number;
  tag?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface ClientResponse {
  id: string;
  dni: string;
  name: string;
  email: string;
  phone: string;
  lastPurchaseDate: string;
  totalSpent: number;
  pendingBalance: number;
  categoryId: string | null;
  tag: string | null;
  customFields: Record<string, unknown>;
}

export interface ClientCategoryResponse {
  id: string;
  name: string;
}

type ClientRecord = {
  id: string;
  dni: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastPurchaseAt: Date | null;
  totalSpent: Decimal;
  pendingBalance: Decimal;
  categoryId: string | null;
  tag?: string | null;
  customFields: Prisma.JsonValue | null;
};

class ClientsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const toDecimal = (value?: number) => new Decimal(value ?? 0);

async function assertCategoryBelongsToStore(storeId: string, categoryId?: string | null) {
  if (categoryId === undefined || categoryId === null) {
    return;
  }

  const category = await prisma.clientCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

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

function normalizeCustomFields(customFields?: Record<string, unknown> | null) {
  if (!customFields) {
    return {} as Prisma.InputJsonValue;
  }

  return (Object.keys(customFields).length > 0 ? customFields : {}) as Prisma.InputJsonValue;
}

const formatDate = (value: Date | null) => {
  if (!value) return "N/A";
  return formatArDate(value);
};

export function serializeClient(client: ClientRecord): ClientResponse {
  return {
    id: client.id,
    dni: client.dni,
    name: client.name,
    email: client.email ?? "",
    phone: client.phone ?? "",
    lastPurchaseDate: formatDate(client.lastPurchaseAt),
    totalSpent: client.totalSpent.toNumber(),
    pendingBalance: client.pendingBalance.toNumber(),
    categoryId: client.categoryId ?? null,
    tag: client.tag ?? null,
    customFields: toCustomFields(client.customFields),
  };
}

function parseLastPurchaseDate(value?: string | null) {
  if (!value || value === "N/A") {
    return null;
  }

  return parseArDate(value);
}

export async function listClients(storeId: string) {
  const clients = await prisma.client.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });

  return clients.map(serializeClient);
}

export async function createClient(storeId: string, input: ClientInput) {
  const dni = input.dni.trim();
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  const existing = await prisma.client.findFirst({
    where: { storeId, dni },
    select: { id: true },
  });

  if (existing) {
    throw new ClientsError("Client already exists", 409);
  }

  const client = await prisma.client.create({
    data: {
      storeId,
      dni,
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      categoryId: input.categoryId ?? null,
      lastPurchaseAt: parseLastPurchaseDate(input.lastPurchaseDate),
      totalSpent: toDecimal(input.totalSpent),
      pendingBalance: toDecimal(input.pendingBalance),
      tag: input.tag || null,
      customFields: normalizeCustomFields(input.customFields),
    },
  });

  return serializeClient(client);
}

export async function updateClient(storeId: string, id: string, input: Partial<ClientInput>) {
  const existing = await prisma.client.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return null;
  }

  if (input.dni !== undefined) {
    const nextDni = input.dni.trim();
    const duplicate = await prisma.client.findFirst({
      where: {
        storeId,
        dni: nextDni,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ClientsError("Client already exists", 409);
    }
  }

  await assertCategoryBelongsToStore(storeId, input.categoryId);

  const updated = await prisma.client.update({
    where: { id },
    data: {
      dni: input.dni !== undefined ? input.dni.trim() : existing.dni,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      email: input.email !== undefined ? input.email || null : existing.email,
      phone: input.phone !== undefined ? input.phone || null : existing.phone,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      lastPurchaseAt:
        input.lastPurchaseDate !== undefined
          ? parseLastPurchaseDate(input.lastPurchaseDate)
          : existing.lastPurchaseAt,
      totalSpent:
        input.totalSpent !== undefined ? toDecimal(input.totalSpent) : existing.totalSpent,
      pendingBalance:
        input.pendingBalance !== undefined ? toDecimal(input.pendingBalance) : existing.pendingBalance,
      tag: input.tag !== undefined ? input.tag || null : existing.tag,
      customFields:
        input.customFields !== undefined
          ? normalizeCustomFields(input.customFields)
          : ((existing.customFields ?? {}) as Prisma.InputJsonValue),
    },
  });

  return serializeClient(updated);
}

export async function listClientPayments(storeId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, storeId },
    select: { id: true },
  });
  if (!client) return null;

  const rows = await prisma.clientPayment.findMany({
    where: { storeId, clientId },
    orderBy: { paidAt: "desc" },
    take: 8,
  });

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount.toNumber(),
    method: row.method,
    paidAt: row.paidAt.toISOString(),
  }));
}

export async function registerClientPayment(
  storeId: string,
  clientId: string,
  input: { amount: number; method: string }
) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: clientId, storeId } });
    if (!client) return null;

    const balance = new Decimal(client.pendingBalance.toString());
    const amount = new Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new ClientsError("El monto tiene que ser mayor a cero");
    if (amount.greaterThan(balance)) throw new ClientsError("El monto supera el saldo");

    await tx.clientPayment.create({
      data: {
        storeId,
        clientId,
        amount,
        method: input.method.trim(),
        paidAt: new Date(),
      },
    });

    const updated = await tx.client.update({
      where: { id: clientId },
      data: { pendingBalance: balance.minus(amount) },
    });

    return serializeClient(updated);
  });
}

export async function deleteClient(storeId: string, id: string) {
  const existing = await prisma.client.findFirst({
    where: { id, storeId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  // Sales and trade-ins keep their history. Drop the client reference first so
  // delete succeeds whether the live FK is SET NULL or RESTRICT. No schema change.
  await prisma.$transaction([
    prisma.sale.updateMany({
      where: { storeId, clientId: id },
      data: { clientId: null },
    }),
    prisma.tradeIn.updateMany({
      where: { storeId, clientId: id },
      data: { clientId: null },
    }),
    prisma.client.delete({
      where: { id },
    }),
  ]);

  return true;
}

export interface ClientImportRow {
  name?: string;
  dni?: string;
  email?: string;
  phone?: string;
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

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // 1-based + header row
    const name = r.name?.trim();
    if (!name) {
      errors.push({ row: rowNum, message: "Nombre requerido" });
      continue;
    }

    try {
      const dni = r.dni?.trim() || "";

      // Match existing: by DNI first, then by name
      let existing = null;
      if (dni) {
        existing = await prisma.client.findFirst({ where: { storeId, dni } });
      }
      if (!existing) {
        existing = await prisma.client.findFirst({
          where: { storeId, name: { equals: name, mode: "insensitive" } },
        });
      }

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            name,
            ...(dni && { dni }),
            ...(r.email?.trim() && { email: r.email.trim() }),
            ...(r.phone?.trim() && { phone: r.phone.trim() }),
          },
        });
        updated++;
      } else {
        // Generate unique DNI placeholder if not provided
        const effectiveDni = dni || `IMP-${Date.now()}-${i}`;
        await prisma.client.create({
          data: {
            storeId,
            name,
            dni: effectiveDni,
            email: r.email?.trim() || null,
            phone: r.phone?.trim() || null,
          },
        });
        imported++;
      }
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  return { imported, updated, errors };
}

export function getClientsErrorStatus(error: unknown) {
  if (error instanceof ClientsError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}

// ── Client Categories ─────────────────────────────────────────────────────────

export async function listClientCategories(storeId: string): Promise<ClientCategoryResponse[]> {
  return prisma.clientCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

export async function createClientCategory(storeId: string, name: string): Promise<ClientCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new ClientsError("Category name required", 400);
  const existing = await prisma.clientCategory.findFirst({ where: { storeId, name: trimmed } });
  if (existing) throw new ClientsError("Category already exists", 409);
  const count = await prisma.clientCategory.count({ where: { storeId } });
  return prisma.clientCategory.create({ data: { storeId, name: trimmed, sortOrder: count }, select: { id: true, name: true } });
}

export async function renameClientCategory(storeId: string, id: string, name: string): Promise<ClientCategoryResponse | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new ClientsError("Category name required", 400);
  const existing = await prisma.clientCategory.findFirst({ where: { id, storeId } });
  if (!existing) return null;
  return prisma.clientCategory.update({ where: { id }, data: { name: trimmed }, select: { id: true, name: true } });
}

export async function deleteClientCategory(storeId: string, id: string): Promise<boolean> {
  const existing = await prisma.clientCategory.findFirst({ where: { id, storeId } });
  if (!existing) return false;
  await prisma.$transaction([
    prisma.client.updateMany({ where: { storeId, categoryId: id }, data: { categoryId: null } }),
    prisma.clientCategory.delete({ where: { id } }),
  ]);
  return true;
}

export async function reorderClientCategories(storeId: string, categoryIds: string[]): Promise<void> {
  await prisma.$transaction(
    categoryIds.map((id, idx) =>
      prisma.clientCategory.updateMany({ where: { id, storeId }, data: { sortOrder: idx } })
    )
  );
}

export async function bulkMoveClientCategory(storeId: string, ids: string[], categoryId: string | null): Promise<number> {
  if (categoryId !== null) {
    const cat = await prisma.clientCategory.findFirst({ where: { id: categoryId, storeId } });
    if (!cat) throw new ClientsError("Category not found", 404);
  }
  const result = await prisma.client.updateMany({ where: { storeId, id: { in: ids } }, data: { categoryId } });
  return result.count;
}
