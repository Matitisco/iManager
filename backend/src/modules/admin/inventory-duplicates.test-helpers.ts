import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';

export async function item(storeId: string, overrides: Partial<Prisma.InventoryItemUncheckedCreateInput> = {}) {
  return prisma.inventoryItem.create({ data: {
    storeId, model: 'iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A',
    batteryHealth: '90%', cost: '123.45', price: '234.56', status: 'DISPONIBLE', cantidad: 1,
    entryDate: new Date('2026-10-01T12:00:00.000Z'),
    createdAt: new Date('2026-10-02T12:00:00.000Z'), updatedAt: new Date('2026-10-02T12:00:00.000Z'),
    ...overrides,
  } });
}

// Compare every row of every business table, including users, audit and session metadata.
export async function snapshot() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
  const data: Record<string, string> = {};
  for (const { tablename } of tables) {
    const [result] = await prisma.$queryRaw<{ rows: string }[]>(Prisma.sql`
      SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb)::text AS rows
      FROM ${Prisma.raw(`"${tablename.replace(/"/g, '""')}"`)} t`);
    data[tablename] = result!.rows;
  }
  return data;
}

