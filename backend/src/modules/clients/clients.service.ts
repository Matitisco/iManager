import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../plugins/prisma.js";

export interface ClientInput {
  dni: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  lastPurchaseDate?: string | null;
  totalSpent?: number;
  pendingBalance?: number;
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
};

class ClientsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const toDecimal = (value?: number) => new Decimal(value ?? 0);

const formatDate = (value: Date | null) => {
  if (!value) return "N/A";
  return value.toLocaleDateString("es-AR");
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
  };
}

function parseLastPurchaseDate(value?: string | null) {
  if (!value || value === "N/A") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
      lastPurchaseAt: parseLastPurchaseDate(input.lastPurchaseDate),
      totalSpent: toDecimal(input.totalSpent),
      pendingBalance: toDecimal(input.pendingBalance),
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

  const updated = await prisma.client.update({
    where: { id },
    data: {
      dni: input.dni !== undefined ? input.dni.trim() : existing.dni,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      email: input.email !== undefined ? input.email || null : existing.email,
      phone: input.phone !== undefined ? input.phone || null : existing.phone,
      lastPurchaseAt:
        input.lastPurchaseDate !== undefined
          ? parseLastPurchaseDate(input.lastPurchaseDate)
          : existing.lastPurchaseAt,
      totalSpent:
        input.totalSpent !== undefined ? toDecimal(input.totalSpent) : existing.totalSpent,
      pendingBalance:
        input.pendingBalance !== undefined ? toDecimal(input.pendingBalance) : existing.pendingBalance,
    },
  });

  return serializeClient(updated);
}

export async function deleteClient(storeId: string, id: string) {
  const existing = await prisma.client.findFirst({
    where: { id, storeId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.client.delete({
    where: { id },
  });

  return true;
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
