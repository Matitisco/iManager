import type { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";
import {
  actionsForGroup,
  actionsForSection,
  AUDIT_GROUPS,
  AUDIT_SECTIONS,
  batchOf,
  describeAudit,
  hiddenChange,
  roleLabel,
  sectionLabel,
} from "./audit-actions.js";
import { saleCode } from "./archive.js";
import type { AuditChange } from "./diff-fields.js";

const PAGE = 50;

export type HistoryEvent = {
  id: string;
  createdAt: string;
  action: string;
  group: string;
  section: string;
  sectionLabel: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: string | null;
  actorRoleLabel: string | null;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  detail: string | null;
  changes: AuditChange[];
  reason: string | null;
  source: string | null;
  legacy: boolean;
  title: string;
  verb: string;
  target: string;
  suffix: string;
  recordState: "active" | "archived" | "voided" | "gone";
};

export type HistoryQuery = {
  actorUserId?: string;
  from?: Date;
  to?: Date;
  group?: string;
  section?: string;
  q?: string;
  entityType?: string;
  entityId?: string;
  cursor?: string;
  limit?: number;
};

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const createdAt = new Date(iso);
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function asChanges(value: unknown): AuditChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.field !== "string" || typeof row.label !== "string") return [];
    return [{
      field: row.field,
      label: row.label,
      before: row.before == null ? null : String(row.before),
      after: row.after == null ? null : String(row.after),
    }];
  });
}

async function searchIds(storeId: string, q: string) {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AuditEvent"
    WHERE "storeId" = ${storeId}
      AND (
        COALESCE("entityLabel", '') ILIKE ${like}
        OR COALESCE("detail", '') ILIKE ${like}
        OR COALESCE("reason", '') ILIKE ${like}
        OR "actorName" ILIKE ${like}
        OR COALESCE("changes"::text, '') ILIKE ${like}
      )
    ORDER BY "createdAt" DESC
    LIMIT 5000
  `;
  return rows.map((row) => row.id);
}

const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shortLabel(value: string) {
  return value.trim().slice(0, 160);
}

function preferredLabel(stored: string | null, lookedUp: string | undefined) {
  const text = stored?.trim() ?? "";
  if (text && !OPAQUE_ID.test(text)) return text;
  return lookedUp ?? null;
}

async function recordContext(storeId: string, rows: { entityType: string; entityId: string }[]) {
  const ids = (type: string) => [...new Set(rows.filter((row) => row.entityType === type).map((row) => row.entityId))];
  const cashIds = ids("cash");
  const [items, sales, trades, clients, repairs, registers, sessions, movements, suppliers, expenses, purchases, claims] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { storeId, id: { in: ids("inventory") } }, select: { id: true, archivedAt: true, model: true, capacity: true } }),
    prisma.sale.findMany({ where: { storeId, id: { in: ids("sale") } }, select: { id: true, voidedAt: true, saleNumber: true } }),
    prisma.tradeIn.findMany({ where: { storeId, id: { in: ids("trade") } }, select: { id: true, voidedAt: true, deviceReceived: true } }),
    prisma.client.findMany({ where: { storeId, id: { in: ids("client") } }, select: { id: true, archivedAt: true, name: true } }),
    prisma.repairOrder.findMany({ where: { storeId, id: { in: ids("repair") } }, select: { id: true, archivedAt: true, orderNumber: true, device: true } }),
    cashIds.length ? prisma.cashRegister.findMany({ where: { storeId, id: { in: cashIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    cashIds.length ? prisma.cashSession.findMany({ where: { storeId, id: { in: cashIds } }, select: { id: true, register: { select: { name: true } } } }) : Promise.resolve([]),
    cashIds.length ? prisma.cashMovement.findMany({ where: { storeId, id: { in: cashIds } }, select: { id: true, register: { select: { name: true } } } }) : Promise.resolve([]),
    prisma.supplier.findMany({ where: { storeId, id: { in: ids("supplier") } }, select: { id: true, name: true, deletedAt: true } }),
    prisma.expense.findMany({ where: { storeId, id: { in: ids("expense") } }, select: { id: true, category: true, deletedAt: true } }),
    prisma.stockPurchase.findMany({ where: { storeId, id: { in: ids("purchase") } }, select: { id: true, deletedAt: true, supplier: { select: { name: true } } } }),
    prisma.returnCase.findMany({ where: { storeId, id: { in: ids("return") } }, select: { id: true, caseNumber: true, deletedAt: true, deviceLabel: true } }),
  ]);
  const state = new Map<string, HistoryEvent["recordState"]>();
  const labels = new Map<string, string>();
  for (const row of items) {
    state.set(`inventory:${row.id}`, row.archivedAt ? "archived" : "active");
    labels.set(`inventory:${row.id}`, shortLabel([row.model, row.capacity].filter(Boolean).join(" ")) || "Equipo");
  }
  for (const row of sales) {
    state.set(`sale:${row.id}`, row.voidedAt ? "voided" : "active");
    labels.set(`sale:${row.id}`, saleCode(row.saleNumber));
  }
  for (const row of trades) {
    state.set(`trade:${row.id}`, row.voidedAt ? "voided" : "active");
    labels.set(`trade:${row.id}`, shortLabel(row.deviceReceived) || "Canje");
  }
  for (const row of clients) {
    state.set(`client:${row.id}`, row.archivedAt ? "archived" : "active");
    labels.set(`client:${row.id}`, shortLabel(row.name) || "Cliente");
  }
  for (const row of repairs) {
    state.set(`repair:${row.id}`, row.archivedAt ? "archived" : "active");
    labels.set(`repair:${row.id}`, shortLabel(`OT-${String(row.orderNumber).padStart(4, "0")} · ${row.device}`));
  }
  for (const row of registers) labels.set(`cash:${row.id}`, shortLabel(row.name) || "Caja");
  for (const row of sessions) if (row.register.name) labels.set(`cash:${row.id}`, shortLabel(row.register.name));
  for (const row of movements) if (row.register?.name) labels.set(`cash:${row.id}`, shortLabel(row.register.name));
  for (const row of suppliers) {
    state.set(`supplier:${row.id}`, row.deletedAt ? "archived" : "active");
    labels.set(`supplier:${row.id}`, shortLabel(row.name) || "Proveedor");
  }
  for (const row of expenses) {
    state.set(`expense:${row.id}`, row.deletedAt ? "archived" : "active");
    labels.set(`expense:${row.id}`, shortLabel(row.category) || "Gasto");
  }
  for (const row of purchases) {
    state.set(`purchase:${row.id}`, row.deletedAt ? "archived" : "active");
    labels.set(`purchase:${row.id}`, shortLabel(row.supplier.name) || "Compra");
  }
  for (const row of claims) {
    state.set(`return:${row.id}`, row.deletedAt ? "archived" : "active");
    labels.set(`return:${row.id}`, shortLabel(`RMA-${String(row.caseNumber).padStart(4, "0")} · ${row.deviceLabel}`) || "Reclamo");
  }
  return { state, labels };
}

export async function listHistory(storeId: string, query: HistoryQuery) {
  const limit = Math.min(Math.max(query.limit ?? PAGE, 1), 50);
  const where: Prisma.AuditEventWhereInput = { storeId };
  if (query.actorUserId) where.actorUserId = query.actorUserId;
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }
  const groupActions = query.group ? actionsForGroup(query.group) : null;
  const sectionActions = query.section ? actionsForSection(query.section) : null;
  if (query.group && !groupActions) return { events: [], nextCursor: null, groups: AUDIT_GROUPS, sections: AUDIT_SECTIONS };
  if (query.section && !sectionActions) return { events: [], nextCursor: null, groups: AUDIT_GROUPS, sections: AUDIT_SECTIONS };
  const actionIn = [groupActions, sectionActions].filter((list): list is string[] => Boolean(list));
  if (actionIn.length) {
    const allowed = actionIn.reduce((acc, list) => acc.filter((action) => list.includes(action)));
    where.action = { in: allowed.length ? allowed : ["__none__"] };
  }
  if (query.q?.trim()) {
    const ids = await searchIds(storeId, query.q.trim());
    where.id = { in: ids.length ? ids : ["__none__"] };
  }
  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    where.AND = [{
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    }];
  }

  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const { state: states, labels } = await recordContext(storeId, page);
  const events: HistoryEvent[] = [];
  const seenBatches = new Set<string>();
  for (const row of page) {
    const changes = asChanges(row.changes);
    const batch = batchOf(changes);
    if (batch.id) {
      if (seenBatches.has(batch.id)) continue;
      seenBatches.add(batch.id);
    }
    const legacy = row.action.endsWith(".deleted");
    const entityLabel = preferredLabel(row.entityLabel, labels.get(`${row.entityType}:${row.entityId}`));
    const described = describeAudit({
      action: row.action,
      entityLabel,
      detail: row.detail,
      reason: row.reason,
      changes,
    });
    const known = states.get(`${row.entityType}:${row.entityId}`);
    events.push({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      group: described.group,
      section: described.section,
      sectionLabel: sectionLabel(described.section),
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      actorRole: row.actorRole,
      actorRoleLabel: roleLabel(row.actorRole),
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel,
      detail: row.detail,
      changes: changes.filter((change) => !hiddenChange(change.field)),
      reason: row.reason,
      source: row.source,
      legacy,
      title: described.title,
      verb: described.verb,
      target: described.target,
      suffix: described.suffix,
      recordState: legacy ? "gone" : known ?? "gone",
    });
  }
  const last = page.at(-1);
  return {
    events,
    nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    groups: AUDIT_GROUPS,
    sections: AUDIT_SECTIONS,
  };
}

export async function listHistoryActors(storeId: string) {
  const members = await prisma.storeMember.findMany({
    where: { storeId },
    include: { user: { select: { id: true, displayName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return members.map((member) => ({
    userId: member.userId,
    name: member.user.displayName?.trim() || member.user.email || "Usuario",
    role: member.role,
    removed: Boolean(member.removedAt),
  }));
}
