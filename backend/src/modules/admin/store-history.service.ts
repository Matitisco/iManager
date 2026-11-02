import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { auditActions, auditDescription, eventDescription, HISTORY_TYPES, historyRole, PRODUCT_ACTIONS, type HistoryType } from './activity-events.js';
import { posthogHistory, latestPosthogActions, type HistoryPosition, type PosthogRow } from './posthog-history.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const date = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
}, 'Fecha inválida');
const position = z.object({ at: z.string().datetime(), id: z.string().min(1).max(200), until: z.string().datetime(), posthog: z.boolean() }).strict();
export const historyQuery = z.object({
  type: z.enum(HISTORY_TYPES).optional(), from: day.optional(), to: day.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  cursor: z.string().max(1200).transform((s, ctx) => {
    try { return position.parse(JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))); }
    catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cursor inválido' }); return z.NEVER; }
  }).optional(),
}).strict().refine(q => !q.from || !q.to || q.from <= q.to, 'Revisá el rango de fechas');
export type HistoryQuery = z.infer<typeof historyQuery>;
export type HistoryAction = { id: string; at: string; type: HistoryType; text: string; actor: { name: string; role: string | null }; source: 'database' | 'posthog' };
type LocalRow = { id: string; storeId: string; at: Date; name: string; userId: string | null; actorName: string | null; role: string | null; props: unknown; entityId: string | null; kind: 'audit' | 'product' };
type Candidate = { row: LocalRow | PosthogRow; action: HistoryAction; operation: string; userId: string | null; kind: 'audit' | 'product' | 'posthog' };
export const HISTORY_WARNING = 'No pudimos traer algunas acciones y conexiones. Te mostramos las acciones guardadas en la app. Podés reintentar en un rato.';
const auditSelect = Prisma.sql`SELECT concat('a:', a.id) AS id, a."storeId", a."createdAt" AS at, a.action AS name, a."actorUserId" AS "userId", a."actorName", COALESCE(a."actorRole", am.role::text) AS role, jsonb_path_query_array(a.changes::jsonb, '$[*].field') AS props, a."entityId", 'audit' AS kind FROM "AuditEvent" a LEFT JOIN "StoreMember" am ON am."userId" = a."actorUserId" AND am."storeId" = a."storeId"`;
const productSelect = Prisma.sql`SELECT concat('e:', e.id) AS id, e."storeId", e."createdAt" AS at, e.name, e."userId", u."displayName" AS "actorName", m.role::text AS role, e.props::jsonb, NULL::text AS "entityId", 'product' AS kind FROM "ProductEvent" e LEFT JOIN "User" u ON u.id = e."userId" LEFT JOIN "StoreMember" m ON m."userId" = e."userId" AND m."storeId" = e."storeId"`;
// Select the first connection of the Argentine calendar day before applying pagination.
const localConnection = Prisma.sql`(e.name <> 'active_day' OR (e."userId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "ProductEvent" earlier WHERE earlier."storeId" = e."storeId" AND earlier."userId" = e."userId"
    AND earlier.name = 'active_day'
    AND ((earlier."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      = ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    AND (earlier."createdAt", earlier.id COLLATE "C") < (e."createdAt", e.id COLLATE "C")
)))`;
const successfulProduct = Prisma.sql`(e.name <> 'stock_import_finished' OR e.props::jsonb->'ok' = 'true'::jsonb)`;
const connectionDay = (at: Date) => new Date(at.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const isCandidate = (c: Candidate | null): c is Candidate => c !== null;
function productNames(type?: HistoryType) { return Object.keys(PRODUCT_ACTIONS).filter(n => !type || PRODUCT_ACTIONS[n].type === type); }
const inList = (values: string[]) => values.length ? Prisma.join(values) : Prisma.sql`NULL`;
async function localHistory(storeId: string, q: HistoryQuery, until: Date, from?: Date, to?: Date): Promise<LocalRow[]> {
  const names = productNames(q.type);
  // Prisma binds Date as timestamptz; business timestamps are stored as UTC without a zone.
  // Convert explicitly so the database session timezone cannot change range/cursor semantics.
  const predicates = [Prisma.sql`r.at <= (${until}::timestamptz AT TIME ZONE 'UTC')`];
  if (from) predicates.push(Prisma.sql`r.at >= (${from}::timestamptz AT TIME ZONE 'UTC')`);
  if (to) predicates.push(Prisma.sql`r.at < (${to}::timestamptz AT TIME ZONE 'UTC')`);
  if (q.cursor) predicates.push(Prisma.sql`(r.at, r.id COLLATE "C") < ((${new Date(q.cursor.at)}::timestamptz AT TIME ZONE 'UTC'), ${q.cursor.id} COLLATE "C")`);
  return prisma.$queryRaw<LocalRow[]>(Prisma.sql`
    SELECT * FROM (
      ${auditSelect} WHERE a."storeId" = ${storeId} AND a.action IN (${inList(auditActions(q.type))})
      UNION ALL
      ${productSelect} WHERE e."storeId" = ${storeId} AND e.name IN (${inList(names)}) AND ${localConnection} AND ${successfulProduct}
    ) r WHERE ${Prisma.join(predicates, ' AND ')} ORDER BY r.at DESC, r.id COLLATE "C" DESC LIMIT ${q.limit + 1}`);
}
const compare = (a: { at: string; id: string }, b: { at: string; id: string }) => a.at === b.at ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.at < b.at ? 1 : -1;
function describeLocal(row: LocalRow): Candidate | null {
  const description = row.kind === 'audit' ? auditDescription(row.name, row.props) : eventDescription(row.name, (row.props ?? {}) as Record<string, unknown>, 'product');
  if (!description) return null;
  return { row, operation: description.operation, userId: row.userId, kind: row.kind,
    action: { id: row.id, at: row.at.toISOString(), type: description.type, text: description.text, actor: { name: row.actorName || (row.userId ? 'Usuario sin nombre' : 'Sistema'), role: historyRole(row.role) }, source: 'database' } };
}
function sameOperation(left: Candidate, right: Candidate) {
  if (left.operation !== right.operation) return false;
  if (left.operation === 'connection') return !!left.userId && left.userId === right.userId && connectionDay(left.row.at) === connectionDay(right.row.at);
  if (left.operation === 'sale') return !!left.row.entityId && left.row.entityId === right.row.entityId;
  // No fuzzy dedupe for distinct business operations.
  return ['invite', 'join', 'import'].includes(left.operation) && !!left.userId && left.userId === right.userId
    && Math.abs(left.row.at.getTime() - right.row.at.getTime()) <= 5000;
}
export function deduplicateActions(rows: Candidate[], canonical: Candidate[]): HistoryAction[] {
  const priority = { audit: 0, product: 1, posthog: 2 };
  return rows.filter(row => !canonical.some(other => (priority[other.kind] < priority[row.kind] || (row.operation === 'connection' && other.kind === row.kind && compare(other.action, row.action) > 0)) && sameOperation(row, other))).map(r => r.action);
}
type HistoryUser = { id: string; firebaseUid: string; displayName: string | null; role: string | null };
async function historyUsers(storeIds: string[]): Promise<HistoryUser[]> {
  return prisma.$queryRaw<HistoryUser[]>(Prisma.sql`
    SELECT u.id, u."firebaseUid", u."displayName", m.role::text AS role FROM "User" u
    LEFT JOIN "StoreMember" m ON m."userId" = u.id AND m."storeId" IN (${Prisma.join(storeIds)})
    WHERE m."userId" IS NOT NULL OR EXISTS (
      SELECT 1 FROM "ProductEvent" e WHERE e."storeId" IN (${Prisma.join(storeIds)}) AND e."userId" = u.id AND e.name = 'active_day'
    )`);
}
function describePosthog(rows: PosthogRow[], identities: HistoryUser[]): Candidate[] {
  // Former employees are resolved only for dedupe; display names still require current membership.
  const users = new Map(identities.flatMap(u => [u.id, u.firebaseUid].map(id => [id, u] as const)));
  return rows.map((row): Candidate | null => {
    const identity = users.get(row.userId);
    const description = eventDescription(row.name, row.props, 'posthog');
    if (!description) return null;
    return { row, operation: description.operation, userId: identity?.id ?? `posthog:${row.userId}`, kind: 'posthog',
      action: { id: row.id, at: row.at.toISOString(), type: description.type, text: description.text,
        actor: { name: (identity?.role && identity.displayName) || 'Usuario sin identificar', role: historyRole(identity?.role) }, source: 'posthog' } };
  }).filter(isCandidate);
}
/** Fetch authoritative counterparts independently of the cursor, including across page boundaries. */
async function counterparts(storeId: string, candidates: Candidate[], until: Date): Promise<Candidate[]> {
  const matches = candidates.filter(c => c.kind !== 'audit' && (c.row.entityId || ['invite', 'join', 'import'].includes(c.operation)));
  const connections = candidates.filter(c => c.kind === 'posthog' && c.operation === 'connection');
  const daily = connections.length ? await prisma.productEvent.findMany({ where: {
    storeId, name: 'active_day', userId: { in: [...new Set(connections.map(c => c.userId!))] },
    createdAt: {
      gte: new Date(`${connectionDay(new Date(Math.min(...connections.map(c => c.row.at.getTime()))))}T00:00:00-03:00`),
      lt: new Date(new Date(`${connectionDay(new Date(Math.max(...connections.map(c => c.row.at.getTime()))))}T00:00:00-03:00`).getTime() + 86400000),
      lte: until,
    },
  }, select: { id: true, storeId: true, createdAt: true, name: true, userId: true, props: true } }) : [];
  const dailyCandidates = daily.map(e => describeLocal({ id: `e:${e.id}`, storeId, at: e.createdAt, name: e.name, userId: e.userId, actorName: null, role: null, props: e.props, entityId: null, kind: 'product' })).filter(isCandidate);
  if (!matches.length) return dailyCandidates;
  const min = new Date(Math.min(...matches.map(c => c.row.at.getTime())) - 5000);
  const max = new Date(Math.max(...matches.map(c => c.row.at.getTime())) + 5000);
  const entityIds = matches.flatMap(c => c.operation === 'sale' && c.row.entityId ? [c.row.entityId] : []);
  const [audits, products] = await Promise.all([
    prisma.auditEvent.findMany({ where: { storeId, OR: [
      { createdAt: { gte: min, lte: max }, action: { in: ['member.invited', 'member.joined', 'inventory.imported'] } },
      ...(entityIds.length ? [{ action: 'sale.created', entityId: { in: entityIds } }] : []),
    ] }, select: { id: true, storeId: true, createdAt: true, action: true, actorUserId: true, actorName: true, actorRole: true, entityId: true } }),
    prisma.productEvent.findMany({ where: { storeId, createdAt: { gte: min, lte: max }, name: { in: ['invite_created', 'invite_accepted', 'stock_import_finished'] } }, select: { id: true, storeId: true, createdAt: true, name: true, userId: true, props: true } }),
  ]);
  return [
    ...dailyCandidates,
    ...audits.map(a => describeLocal({ id: `a:${a.id}`, storeId, at: a.createdAt, name: a.action, userId: a.actorUserId, actorName: a.actorName, role: a.actorRole, props: null, entityId: a.entityId, kind: 'audit' })),
    ...products.map(e => describeLocal({ id: `e:${e.id}`, storeId, at: e.createdAt, name: e.name, userId: e.userId, actorName: null, role: null, props: e.props, entityId: null, kind: 'product' })),
  ].filter(isCandidate);
}
export async function getStoreHistory(storeId: string, q: HistoryQuery, now = new Date()) {
  if (!await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })) return null;
  const until = q.cursor ? new Date(q.cursor.until) : now;
  const from = q.from ? new Date(`${q.from}T00:00:00-03:00`) : undefined;
  const to = q.to ? new Date(new Date(`${q.to}T00:00:00-03:00`).getTime() + 86400000) : undefined;
  const users = q.cursor?.posthog === false || q.type === 'update' || q.type === 'delete' ? [] : await historyUsers([storeId]);
  const aliases = users.map(u => ({ alias: u.firebaseUid, userId: u.id }));
  const external = q.cursor?.posthog === false ? Promise.resolve(null) : posthogHistory(storeId, { until, from, to, type: q.type, cursor: q.cursor, limit: q.limit + 1, aliases }).catch(() => null);
  const [local, remote] = await Promise.all([localHistory(storeId, q, until, from, to), external]);
  const candidates = [...local.map(describeLocal).filter(isCandidate), ...describePosthog(remote ?? [], users)].sort((a, b) => compare(a.action, b.action));
  const scanned = candidates.slice(0, q.limit);
  const canonical = [...scanned, ...await counterparts(storeId, scanned, until)];
  const last = scanned.at(-1)?.action;
  const nextCursor = candidates.length > q.limit && last ? Buffer.from(JSON.stringify({ at: last.at, id: last.id, until: until.toISOString(), posthog: remote !== null })).toString('base64url') : null;
  return { actions: deduplicateActions(scanned, canonical), nextCursor, warning: remote === null ? HISTORY_WARNING : null };
}

export async function latestStoreActions(storeIds: string[], now: Date) {
  if (!storeIds.length) return { actions: new Map<string, { text: string; at: string }>(), warning: null };
  const local = await prisma.$queryRaw<LocalRow[]>(Prisma.sql`
      SELECT r.* FROM unnest(ARRAY[${Prisma.join(storeIds)}]::text[]) AS s(id) CROSS JOIN LATERAL (
        SELECT * FROM (
          (${auditSelect} WHERE a."storeId" = s.id AND a.action IN (${inList(auditActions())}) AND a."createdAt" <= (${now}::timestamptz AT TIME ZONE 'UTC') ORDER BY a."createdAt" DESC, a.id DESC LIMIT 1)
          UNION ALL
          (${productSelect} WHERE e."storeId" = s.id AND e.name IN (${inList(productNames())}) AND ${localConnection} AND ${successfulProduct} AND e."createdAt" <= (${now}::timestamptz AT TIME ZONE 'UTC') ORDER BY e."createdAt" DESC, e.id DESC LIMIT 1)
        ) latest ORDER BY at DESC, id DESC LIMIT 1
      ) r`);
  // Only local days on/after each store's latest action can affect which external action wins.
  const dailyQuery = local.length ? prisma.$queryRaw<{ storeId: string; userId: string; firebaseUid: string; at: Date }[]>(Prisma.sql`
    SELECT e."storeId", e."userId", u."firebaseUid", e."createdAt" AS at FROM "ProductEvent" e
    JOIN "User" u ON u.id = e."userId"
    WHERE e.name = 'active_day' AND e."storeId" IN (${Prisma.join(local.map(r => r.storeId))})
      AND e."createdAt" >= (${new Date(`${connectionDay(new Date(Math.min(...local.map(r => r.at.getTime()))))}T00:00:00-03:00`)}::timestamptz AT TIME ZONE 'UTC')
      AND e."createdAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')`) : [];
  const [daily, users] = await Promise.all([dailyQuery, historyUsers(storeIds)]);
  const aliases = [...new Map(users.map(u => [u.firebaseUid, { alias: u.firebaseUid, userId: u.id }])).values()];
  const excluded = [...new Map(daily.flatMap(r => [r.userId, r.firebaseUid].map(userId => {
    const entry = { storeId: r.storeId, userId, day: connectionDay(r.at) };
    return [JSON.stringify(entry), entry] as const;
  }))).values()];
  const remote = await latestPosthogActions(storeIds, now, excluded, aliases).catch(() => null);
  const actions = new Map<string, { text: string; at: string }>();
  for (const row of local) { const candidate = describeLocal(row); if (candidate) { const { text, at } = candidate.action; actions.set(row.storeId, { text, at }); } }
  for (const row of remote ?? []) {
    if (!storeIds.includes(row.storeId)) continue;
    const description = eventDescription(row.name, row.props, 'posthog');
    if (!description) continue;
    const at = row.at.toISOString();
    if (!actions.has(row.storeId) || at > actions.get(row.storeId)!.at) actions.set(row.storeId, { text: description.text, at });
  }
  return { actions, warning: remote === null ? HISTORY_WARNING : null };
}
