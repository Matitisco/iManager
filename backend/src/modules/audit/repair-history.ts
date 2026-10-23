import { Prisma, type AuditEvent } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";
import type { HistoryQuery } from "./history.service.js";

type StatusRow = {
  id: string;
  status: string;
  previousStatus: string | null;
  first: boolean;
  createdAt: Date;
  orderNumber: number;
  device: string;
};

/** Older status events have no actor. Keep them without duplicating their audits. */
export async function repairHistoryRows(
  storeId: string,
  query: HistoryQuery,
  allowedActions: string[] | null,
  cursor: { createdAt: Date; id: string } | null,
  take: number,
  db: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma,
): Promise<AuditEvent[]> {
  const entityId = query.entityId;
  if (query.entityType !== "repair" || !entityId || query.actorUserId) return [];
  // Prisma binds Date as timestamptz; stored timestamps use UTC without a zone.
  // Normalize boundaries before comparing, regardless of the server TimeZone.
  const conditions: Prisma.Sql[] = [];
  if (query.from) conditions.push(Prisma.sql`e."createdAt" >= (${query.from}::timestamptz AT TIME ZONE 'UTC')`);
  if (query.to) conditions.push(Prisma.sql`e."createdAt" <= (${query.to}::timestamptz AT TIME ZONE 'UTC')`);
  if (allowedActions) conditions.push(Prisma.sql`(CASE WHEN e.first THEN 'repair.created' ELSE 'repair.status' END) IN (${Prisma.join(allowedActions.length ? allowedActions : ["__none__"])})`);
  if (cursor) conditions.push(Prisma.sql`(e."createdAt", 'repair-event:' || e.id) < ((${cursor.createdAt}::timestamptz AT TIME ZONE 'UTC'), ${cursor.id})`);
  if (query.q?.trim()) {
    const like = `%${query.q.trim().replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(Prisma.sql`(e.status ILIKE ${like} OR e."previousStatus" ILIKE ${like} OR e.device ILIKE ${like} OR ('OT-' || LPAD(e."orderNumber"::text, GREATEST(4, LENGTH(e."orderNumber"::text)), '0')) ILIKE ${like})`);
  }
  const rows = await db.$queryRaw<StatusRow[]>`
    WITH events AS (
      SELECT s.*, r."orderNumber", r.device,
        LAG(s.status) OVER timeline AS "previousStatus",
        LEAD(s."createdAt") OVER timeline AS "nextAt",
        ROW_NUMBER() OVER timeline = 1 AS first
      FROM "RepairStatusEvent" s
      JOIN "RepairOrder" r ON r.id = s."orderId" AND r."storeId" = s."storeId"
      WHERE s."storeId" = ${storeId} AND s."orderId" = ${entityId}
      WINDOW timeline AS (ORDER BY s."createdAt", s.id)
    )
    SELECT e.* FROM events e
    WHERE NOT EXISTS (
      SELECT 1 FROM "AuditEvent" a
      WHERE a."storeId" = ${storeId} AND a."entityType" = 'repair' AND a."entityId" = ${entityId}
        AND ((e.first AND a.action = 'repair.created') OR
          (a.action = 'repair.status'
            AND a."createdAt" >= e."createdAt"
            AND (e."nextAt" IS NULL OR a."createdAt" < e."nextAt" OR a."createdAt" = e."createdAt")
            AND a.changes @> jsonb_build_array(jsonb_build_object('field', 'status', 'after', e.status))))
    )
    ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
    ORDER BY e."createdAt" DESC, e.id DESC
    LIMIT ${take}
  `;
  return rows.map(row => ({
    id: `repair-event:${row.id}`,
    storeId,
    createdAt: row.createdAt,
    action: row.first ? "repair.created" : "repair.status",
    entityType: "repair",
    entityId,
    entityLabel: `OT-${String(row.orderNumber).padStart(4, "0")} · ${row.device}`.slice(0, 160),
    actorUserId: null,
    actorName: "Sin autor registrado",
    actorRole: null,
    detail: null,
    reason: null,
    source: null,
    changes: [{ field: "status", label: "Estado", before: row.previousStatus, after: row.status }],
  }));
}
