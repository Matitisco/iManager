import { prisma } from "../plugins/prisma.js";
import { createTestAuthToken } from "../testing/test-auth.js";

export async function ensureTestDatabase() {
  await prisma.$queryRawUnsafe(`SELECT 1`);
}

export async function resetDatabase() {
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  );

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((table) => `"public"."${table.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

export async function seedStoreContext(options?: {
  firebaseUid?: string;
  email?: string;
  displayName?: string;
  role?: "OWNER" | "MANAGER" | "STAFF";
  createStore?: boolean;
}) {
  const firebaseUid = options?.firebaseUid ?? "test-owner";
  const email = options?.email ?? "owner@example.com";
  const displayName = options?.displayName ?? "Test Owner";

  const user = await prisma.user.create({
    data: {
      firebaseUid,
      email,
      displayName,
    },
  });

  if (options?.createStore === false) {
    return { user, store: null, membership: null };
  }

  const store = await prisma.store.create({
    data: {
      name: "Test Store",
      legalName: "Test Store SRL",
      taxId: "20-12345678-9",
      phone: "2615551234",
      address: "San Martin 123",
      currency: "ARS",
      timezone: "America/Argentina/Buenos_Aires",
    },
  });

  const membership = await prisma.storeMember.create({
    data: {
      storeId: store.id,
      userId: user.id,
      role: options?.role ?? "OWNER",
      isDefault: true,
    },
  });

  return { user, store, membership };
}

export async function seedCatalogFixture(storeId: string) {
  const [clientCategory, inventoryCategory, saleCategory, tradeInCategory] = await Promise.all([
    prisma.clientCategory.create({ data: { storeId, name: "Frecuentes", sortOrder: 0 } }),
    prisma.inventoryCategory.create({ data: { storeId, name: "iPhone", sortOrder: 0 } }),
    prisma.saleCategory.create({ data: { storeId, name: "Ventas mostrador", sortOrder: 0 } }),
    prisma.tradeInCategory.create({ data: { storeId, name: "Canjes premium", sortOrder: 0 } }),
  ]);

  const client = await prisma.client.create({
    data: {
      storeId,
      categoryId: clientCategory.id,
      dni: "30111222",
      name: "Juan Perez",
      email: "juan@example.com",
      phone: "2614000000",
      lastPurchaseAt: null,
      totalSpent: 0,
      pendingBalance: 0,
    },
  });

  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      storeId,
      categoryId: inventoryCategory.id,
      imei: "IMEI-1234567890",
      model: "iPhone 14",
      capacity: "128GB",
      color: "Black",
      condition: "USADO",
      grade: "A",
      batteryHealth: "91%",
      cost: 800,
      price: 1200,
      status: "DISPONIBLE",
    },
  });

  return {
    clientCategory,
    inventoryCategory,
    saleCategory,
    tradeInCategory,
    client,
    inventoryItem,
  };
}

export function buildAuthHeaders(payload?: {
  uid?: string;
  email?: string;
  name?: string;
}) {
  return {
    Authorization: `Bearer ${createTestAuthToken({
      uid: payload?.uid ?? "test-owner",
      email: payload?.email ?? "owner@example.com",
      name: payload?.name ?? "Test Owner",
      emailVerified: true,
    })}`,
  };
}
