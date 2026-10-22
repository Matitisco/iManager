import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';

export const VIEW_SECTIONS = ['inventory', 'sales', 'tradeins', 'clients'] as const;
export type ViewSection = typeof VIEW_SECTIONS[number];
export type RecordVersion = { id: string; updatedAt: string };

// Identifiers are fixed here, never taken from request text.
const TABLES: Record<ViewSection, string> = {
  inventory: '"InventoryItem"', sales: '"Sale"', tradeins: '"TradeIn"', clients: '"Client"',
};

export async function listSectionChanges(storeId: string, userId: string, section: ViewSection): Promise<RecordVersion[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string; updatedAt: Date }>>(Prisma.sql`
    SELECT r.id, r."updatedAt" FROM ${Prisma.raw(TABLES[section])} r
    LEFT JOIN "SectionRecordView" v ON v."storeId" = r."storeId"
      AND v."userId" = ${userId} AND v.section = ${section} AND v."recordId" = r.id
    WHERE r."storeId" = ${storeId} AND (v."seenUpdatedAt" IS NULL OR v."seenUpdatedAt" < r."updatedAt")
    ORDER BY r."updatedAt" DESC, r.id
  `);
  return rows.map(row => ({ id: row.id, updatedAt: row.updatedAt.toISOString() }));
}

export async function markSectionViewed(storeId: string, userId: string, section: ViewSection, versions: RecordVersion[]) {
  if (!versions.length) return { viewed: [] as RecordVersion[] };
  // Deduplicate before ON CONFLICT; one statement covers the entire visit. Only existing
  // records in this store and versions no newer than the real record can be acknowledged.
  const unique = new Map<string, RecordVersion>();
  for (const row of versions) {
    const previous = unique.get(row.id);
    if (!previous || Date.parse(row.updatedAt) > Date.parse(previous.updatedAt)) unique.set(row.id, row);
  }
  const viewed = await prisma.$queryRaw<Array<{ id: string; updatedAt: Date }>>(Prisma.sql`
    INSERT INTO "SectionRecordView" ("storeId", "userId", section, "recordId", "seenUpdatedAt")
    SELECT ${storeId}, ${userId}, ${section}, input.id, input."updatedAt"
    FROM jsonb_to_recordset(${JSON.stringify([...unique.values()])}::jsonb) AS input(id text, "updatedAt" timestamp)
    JOIN ${Prisma.raw(TABLES[section])} r ON r.id = input.id AND r."storeId" = ${storeId}
    WHERE input."updatedAt" <= r."updatedAt"
    ON CONFLICT ("storeId", "userId", section, "recordId") DO UPDATE
      SET "seenUpdatedAt" = GREATEST("SectionRecordView"."seenUpdatedAt", EXCLUDED."seenUpdatedAt")
    RETURNING "recordId" AS id, "seenUpdatedAt" AS "updatedAt"
  `);
  return { viewed: viewed.map(row => ({ id: row.id, updatedAt: row.updatedAt.toISOString() })) };
}
