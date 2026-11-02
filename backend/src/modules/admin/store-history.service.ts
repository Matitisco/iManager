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
export const HISTORY_WARNING = 'No pudimos traer algunas visitas y acciones de uso. Te mostramos las acciones guardadas en la app. Podés reintentar en un rato.';
const auditSelect = Prisma.sql`SELECT concat('a:', a.id) AS id, a."storeId", a."createdAt" AS at, a.action AS name, a."actorUserId" AS "userId", a."actorName", COALESCE(a."actorRole", am.role::text) AS role, NULL::jsonb AS props, a."entityId", 'audit' AS kind FROM "AuditEvent" a LEFT JOIN "StoreMember" am ON am."userId" = a."actorUserId" AND am."storeId" = a."storeId"`;
const productSelect = Prisma.sql`SELECT concat('e:', e.id) AS id, e."storeId", e."createdAt" AS at, e.name, e."userId", u."displayName" AS "actorName", m.role::text AS role, e.props::jsonb, NULL::text AS "entityId", 'product' AS kind FROM "ProductEvent" e LEFT JOIN "User" u ON u.id = e."userId" LEFT JOIN "StoreMember" m ON m."userId" = e."userId" AND m."storeId" = e."storeId"`;
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
      ${auditSelect} WHERE a."storeId" = ${storeId} ${q.type ? Prisma.sql`AND a.action IN (${inList(auditActions(q.type))})` : Prisma.empty}
      UNION ALL
      ${productSelect} WHERE e."storeId" = ${storeId} AND e.name IN (${inList(names)})
    ) r WHERE ${Prisma.join(predicates, ' AND ')} ORDER BY r.at DESC, r.id COLLATE "C" DESC LIMIT ${q.limit + 1}`);
}
const compare = (a: { at: string; id: string }, b: { at: string; id: string }) => a.at === b.at ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.at < b.at ? 1 : -1;
function describeLocal(row: LocalRow): Candidate {
  const description = row.kind === 'audit' ? auditDescription(row.name) : eventDescription(row.name, (row.props ?? {}) as Record<string, unknown>, 'product')!;
  return { row, operation: description.operation, userId: row.userId, kind: row.kind,
    action: { id: row.id, at: row.at.toISOString(), type: description.type, text: description.text, actor: { name: row.actorName || (row.userId ? 'Usuario sin nombre' : 'Sistema'), role: historyRole(row.role) }, source: 'database' } };
}
function sameOperation(left: Candidate, right: Candidate) {
  if (left.operation !== right.operation) return false;
  if (left.operation === 'sale') return !!left.row.entityId && left.row.entityId === right.row.entityId;
  // No fuzzy dedupe for sales, navigation, daily entries or unrelated operations.
  return ['invite', 'join', 'import', 'signup'].includes(left.operation) && !!left.userId && left.userId === right.userId
    && Math.abs(left.row.at.getTime() - right.row.at.getTime()) <= 5000;
}
export function deduplicateActions(rows: Candidate[], canonical: Candidate[]): HistoryAction[] {
  const priority = { audit: 0, product: 1, posthog: 2 };
  return rows.filter(row => !canonical.some(other => priority[other.kind] < priority[row.kind] && sameOperation(row, other))).map(r => r.action);
}
async function describePosthog(rows: PosthogRow[], storeId: string): Promise<Candidate[]> {
  if (!rows.length) return [];
  const members = await prisma.storeMember.findMany({ where: { storeId }, select: { role: true, user: { select: { id: true, firebaseUid: true, displayName: true } } } });
  const users = new Map(members.flatMap(m => [m.user.id, m.user.firebaseUid].map(id => [id, m] as const)));
  return rows.map(row => {
    const member = users.get(row.userId);
    const description = eventDescription(row.name, row.props, 'posthog')!;
    return { row, operation: description.operation, userId: member?.user.id ?? null, kind: 'posthog',
      action: { id: row.id, at: row.at.toISOString(), type: description.type, text: description.text,
        actor: { name: member?.user.displayName || 'Usuario sin identificar', role: historyRole(member?.role) }, source: 'posthog' } };
  });
}
/** Fetch authoritative counterparts independently of the cursor, including across page boundaries. */
async function counterparts(storeId: string, candidates: Candidate[]): Promise<Candidate[]> {
  const matches = candidates.filter(c => c.kind !== 'audit' && (c.row.entityId || ['invite', 'join', 'import', 'signup'].includes(c.operation)));
  if (!matches.length) return [];
  const min = new Date(Math.min(...matches.map(c => c.row.at.getTime())) - 5000);
  const max = new Date(Math.max(...matches.map(c => c.row.at.getTime())) + 5000);
  const entityIds = matches.flatMap(c => c.operation === 'sale' && c.row.entityId ? [c.row.entityId] : []);
  const [audits, products] = await Promise.all([
    prisma.auditEvent.findMany({ where: { storeId, OR: [
      { createdAt: { gte: min, lte: max }, action: { in: ['member.invited', 'member.joined', 'inventory.imported'] } },
      ...(entityIds.length ? [{ action: 'sale.created', entityId: { in: entityIds } }] : []),
    ] }, select: { id: true, storeId: true, createdAt: true, action: true, actorUserId: true, actorName: true, actorRole: true, entityId: true } }),
    prisma.productEvent.findMany({ where: { storeId, createdAt: { gte: min, lte: max }, name: { in: ['invite_created', 'invite_accepted', 'stock_import_finished', 'signup'] } }, select: { id: true, storeId: true, createdAt: true, name: true, userId: true, props: true } }),
  ]);
  return [
    ...audits.map(a => describeLocal({ id: `a:${a.id}`, storeId, at: a.createdAt, name: a.action, userId: a.actorUserId, actorName: a.actorName, role: a.actorRole, props: null, entityId: a.entityId, kind: 'audit' })),
    ...products.map(e => describeLocal({ id: `e:${e.id}`, storeId, at: e.createdAt, name: e.name, userId: e.userId, actorName: null, role: null, props: e.props, entityId: null, kind: 'product' })),
  ];
}
export async function getStoreHistory(storeId: string, q: HistoryQuery, now = new Date()) {
  if (!await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })) return null;
  const until = q.cursor ? new Date(q.cursor.until) : now;
  const from = q.from ? new Date(`${q.from}T00:00:00-03:00`) : undefined;
  const to = q.to ? new Date(new Date(`${q.to}T00:00:00-03:00`).getTime() + 86400000) : undefined;
  const external = q.cursor?.posthog === false ? Promise.resolve(null) : posthogHistory(storeId, { until, from, to, type: q.type, cursor: q.cursor, limit: q.limit + 1 }).catch(() => null);
  const [local, remote] = await Promise.all([localHistory(storeId, q, until, from, to), external]);
  const candidates = [...local.map(describeLocal), ...await describePosthog(remote ?? [], storeId)].sort((a, b) => compare(a.action, b.action));
  const scanned = candidates.slice(0, q.limit);
  const canonical = [...scanned, ...await counterparts(storeId, scanned)];
  const last = scanned.at(-1)?.action;
  const nextCursor = candidates.length > q.limit && last ? Buffer.from(JSON.stringify({ at: last.at, id: last.id, until: until.toISOString(), posthog: remote !== null })).toString('base64url') : null;
  return { actions: deduplicateActions(scanned, canonical), nextCursor, warning: remote === null ? HISTORY_WARNING : null };
}

export async function latestStoreActions(storeIds: string[], now: Date) {
  if (!storeIds.length) return { actions: new Map<string, { text: string; at: string }>(), warning: null };
  const [local, remote] = await Promise.all([
    prisma.$queryRaw<LocalRow[]>(Prisma.sql`
      SELECT r.* FROM unnest(ARRAY[${Prisma.join(storeIds)}]::text[]) AS s(id) CROSS JOIN LATERAL (
        SELECT * FROM (
          (${auditSelect} WHERE a."storeId" = s.id AND a."createdAt" <= (${now}::timestamptz AT TIME ZONE 'UTC') ORDER BY a."createdAt" DESC, a.id DESC LIMIT 1)
          UNION ALL
          (${productSelect} WHERE e."storeId" = s.id AND e.name IN (${inList(productNames())}) AND e."createdAt" <= (${now}::timestamptz AT TIME ZONE 'UTC') ORDER BY e."createdAt" DESC, e.id DESC LIMIT 1)
        ) latest ORDER BY at DESC, id DESC LIMIT 1
      ) r`),
    latestPosthogActions(storeIds, now).catch(() => null),
  ]);
  const actions = new Map<string, { text: string; at: string }>();
  for (const row of local) { const { text, at } = describeLocal(row).action; actions.set(row.storeId, { text, at }); }
  for (const row of remote ?? []) {
    if (!storeIds.includes(row.storeId)) continue;
    const at = row.at.toISOString();
    if (!actions.has(row.storeId) || at > actions.get(row.storeId)!.at) actions.set(row.storeId, { text: eventDescription(row.name, row.props, 'posthog')!.text, at });
  }
  return { actions, warning: remote === null ? HISTORY_WARNING : null };
}
