import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { maskEmail } from './access.js';
import { isTestStore } from './test-stores.js';
import { sanitizeProps, EVENT_NAMES, type EventName } from '../analytics/events.js';

export const FUNNEL_STEPS = [
  ['signup', 'Registro'], ['store_created', 'Puso el nombre de la tienda'], ['stock_viewed', 'Vio «Cargá tu stock»'],
  ['stock_method', 'Eligió cómo cargar'], ['real_stock', 'Cargó stock real'], ['onboarding_done', 'Terminó el onboarding'],
  ['first_sale', 'Primera venta'], ['team_invited', 'Invitó a alguien'], ['team_joined', 'Alguien aceptó la invitación'],
  ['installed', 'Instaló la app'], ['steps_done', 'Primeros pasos 5/5'], ['returned', 'Volvió otro día'],
] as const;
export type FunnelStepId = typeof FUNNEL_STEPS[number][0];
export type Milestones = Partial<Record<FunnelStepId, Date>>;
export function stuckAt(milestones: Milestones): FunnelStepId | null {
  return FUNNEL_STEPS.slice(1, 7).find(([id]) => !milestones[id])?.[0] ?? null;
}
export function funnelSteps(counts: Record<FunnelStepId, number>) {
  const start = counts.signup;
  return FUNNEL_STEPS.map(([id, label], i) => ({ id, label, count: counts[id], pctOfStart: start ? Math.round(counts[id] / start * 10000) / 100 : 0, dropFromPrev: i ? Math.max(0, counts[FUNNEL_STEPS[i - 1][0]] - counts[id]) : 0 }));
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
export function isOwnerSignup(user: { memberships: { role: string }[]; accepted: boolean; createdStore: boolean }) {
  return user.createdStore || (!user.accepted && !user.memberships.some(m => m.role !== 'OWNER'));
}

export async function analyticsSnapshot(ids?: string[], now = new Date()) {
  const stores = await prisma.store.findMany({ where: ids ? { id: { in: ids } } : {}, select: {
    id: true, name: true, createdAt: true, onboardingStartedAt: true, onboardingCompletedAt: true,
    memberships: { where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { userId: true, user: { select: { email: true, createdAt: true } } } },
  } });
  const storeIds = stores.map(s => s.id);
  const where = { storeId: { in: storeIds } };
  const [events, stock, sales, invitations, joined, installed, days] = await Promise.all([
    prisma.productEvent.groupBy({ by: ['storeId', 'name'], where, _min: { createdAt: true }, _count: { _all: true } }),
    prisma.inventoryItem.groupBy({ by: ['storeId'], where: { ...where, sampleBatchId: null }, _min: { createdAt: true } }),
    prisma.sale.groupBy({ by: ['storeId'], where, _min: { createdAt: true } }),
    prisma.storeInvitation.groupBy({ by: ['storeId', 'status'], where, _min: { createdAt: true } }),
    storeIds.length ? prisma.$queryRaw<Array<{ storeId: string; joinedAt: Date | null }>>(Prisma.sql`
      SELECT "storeId", (array_agg("createdAt" ORDER BY "createdAt", id))[2] AS "joinedAt"
      FROM "StoreMember" WHERE "storeId" IN (${Prisma.join(storeIds)}) GROUP BY "storeId"`) : [],
    prisma.storeMember.groupBy({ by: ['storeId'], where: { ...where, appInstalled: true }, _count: { _all: true } }),
    storeIds.length ? prisma.$queryRaw<Array<{ storeId: string; total: bigint; recent: bigint; nextDay: boolean; weekDays: bigint; returnedAt: Date | null }>>(Prisma.sql`
      WITH days AS (
        SELECT e."storeId", (e."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS day,
          min(e."createdAt") AS at, s."createdAt" AS started
        FROM "ProductEvent" e JOIN "Store" s ON s.id = e."storeId"
        WHERE e.name = 'active_day' AND e."createdAt" <= ${now} AND e."storeId" IN (${Prisma.join(storeIds)})
        GROUP BY e."storeId", day, s."createdAt"
      ) SELECT "storeId", count(*) AS total,
        count(*) FILTER (WHERE at >= ${new Date(now.getTime() - 30 * 86400000)}) AS recent,
        bool_or(day = (started AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 1) AS "nextDay",
        count(*) FILTER (WHERE day >= (started AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AND day < (started AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 7) AS "weekDays",
        (array_agg(at ORDER BY at))[2] AS "returnedAt"
      FROM days GROUP BY "storeId"`) : [],
  ]);
  const eventMap = new Map<string, Map<string, Date>>();
  for (const e of events) {
    if (!e.storeId || !e._min.createdAt) continue;
    if (!eventMap.has(e.storeId)) eventMap.set(e.storeId, new Map());
    eventMap.get(e.storeId)!.set(e.name, e._min.createdAt);
  }
  const stockMap = new Map(stock.map(s => [s.storeId, s._min.createdAt]));
  const salesMap = new Map(sales.map(s => [s.storeId, s._min.createdAt]));
  const joinedMap = new Map(joined.map(s => [s.storeId, s.joinedAt] as const));
  const installedSet = new Set(installed.map(s => s.storeId));
  const dayMap = new Map(days.map(d => [d.storeId, d] as const));
  const invites = new Map<string, Date>(); const accepted = new Map<string, Date>();
  for (const i of invitations) {
    const date = i._min.createdAt; if (!date) continue;
    if (!invites.has(i.storeId) || date < invites.get(i.storeId)!) invites.set(i.storeId, date);
    if (i.status === 'ACCEPTED') accepted.set(i.storeId, date);
  }
  return stores.map(store => {
    const event = eventMap.get(store.id) ?? new Map<string, Date>();
    const milestones: Milestones = {};
    const set = (id: FunnelStepId, at: Date | null | undefined) => { if (at) milestones[id] = at; };
    set('store_created', event.get('onboarding_name_completed') ?? store.createdAt);
    set('stock_viewed', event.get('onboarding_stock_viewed'));
    set('stock_method', event.get('stock_method_chosen'));
    set('real_stock', stockMap.get(store.id));
    set('onboarding_done', event.get('onboarding_completed') ?? store.onboardingCompletedAt);
    set('first_sale', event.get('first_sale') ?? salesMap.get(store.id));
    set('team_invited', event.get('invite_created') ?? invites.get(store.id));
    set('team_joined', event.get('invite_accepted') ?? joinedMap.get(store.id) ?? accepted.get(store.id));
    // appInstalled has no installation date: membership creation is not an installation timestamp.
    const installed = event.has('app_installed') || installedSet.has(store.id);
    set('installed', event.get('app_installed'));
    if (event.has('first_steps_finished')) set('steps_done', event.get('first_steps_finished'));
    else if (milestones.real_stock && milestones.first_sale && (milestones.team_invited || milestones.team_joined) && installed) {
      set('steps_done', new Date(Math.max(...Object.values(milestones).map(d => d!.getTime()))));
    }
    const active = dayMap.get(store.id);
    set('returned', active?.returnedAt);
    const derivedMilestones: Milestones = {
      store_created: store.createdAt,
      ...(store.onboardingCompletedAt ? { onboarding_done: store.onboardingCompletedAt } : {}),
      ...(stockMap.get(store.id) ? { real_stock: stockMap.get(store.id)! } : {}),
      ...(salesMap.get(store.id) ? { first_sale: salesMap.get(store.id)! } : {}),
      ...(invites.get(store.id) ? { team_invited: invites.get(store.id)! } : {}),
      ...(joinedMap.get(store.id) ? { team_joined: joinedMap.get(store.id)! } : accepted.get(store.id) ? { team_joined: accepted.get(store.id)! } : {}),
    };
    return { ...store, derivedMilestones, ownerEmail: store.memberships[0]?.user.email ?? null, milestones, installed,
      stuckAt: stuckAt(milestones), activeDays30: Number(active?.recent ?? 0), nextDay: active?.nextDay ?? false, week1Active: Number(active?.weekDays ?? 0) >= 2 };
  });
}

export async function getFunnel(range: '7d' | '30d' | 'all', tests: 'hide' | 'show', now = new Date()) {
  const start = range === 'all' ? undefined : new Date(now.getTime() - (range === '7d' ? 7 : 30) * 86400000);
  const snapshot = await analyticsSnapshot(undefined, now);
  const cohort = snapshot.filter(s => (!start || s.createdAt >= start) && (tests === 'show' || !isTestStore(s)));
  const users = await prisma.user.findMany({ where: { ...(start ? { createdAt: { gte: start } } : {}) }, select: { id: true, email: true, memberships: { select: { role: true, storeId: true } } } });
  const userEvents = await prisma.productEvent.groupBy({ by: ['userId', 'name'], where: { userId: { in: users.map(u => u.id) }, name: { in: ['invite_accepted', 'onboarding_name_completed'] } }, _count: { _all: true } });
  const accepted = new Set(userEvents.filter(e => e.name === 'invite_accepted').map(e => e.userId));
  const owners = new Set([...userEvents.filter(e => e.name === 'onboarding_name_completed').map(e => e.userId), ...snapshot.flatMap(s => s.memberships.map(m => m.userId))]);
  const testIds = new Set(snapshot.filter(isTestStore).map(s => s.id));
  const signups = users.filter(u => isOwnerSignup({ memberships: u.memberships, accepted: accepted.has(u.id), createdStore: owners.has(u.id) }) && (tests === 'show' || (!isTestStore({ name: '', ownerEmail: u.email }) && !u.memberships.some(m => testIds.has(m.storeId)))));
  const counts = Object.fromEntries(FUNNEL_STEPS.map(([id]) => [id, id === 'signup' ? signups.length : cohort.filter(s => id === 'installed' ? s.installed : Boolean(s.milestones[id])).length])) as Record<FunnelStepId, number>;
  const groups = await prisma.productEvent.groupBy({ by: ['name', 'props'], where: { storeId: { in: cohort.map(s => s.id) }, name: { in: ['stock_method_chosen', 'stock_import_finished', 'stock_import_abandoned'] } }, _count: { _all: true } });
  const stockMethods = ['excel', 'paste', 'manual', 'sample', 'skip', 'go_inventory'].map(method => {
    const matching = groups.filter(e => (e.props as Record<string, unknown> | null)?.method === method);
    return { method, chosen: matching.filter(e => e.name === 'stock_method_chosen').reduce((sum, e) => sum + e._count._all, 0), finishedOk: matching.filter(e => e.name === 'stock_import_finished' && (e.props as Record<string, unknown>)?.ok === true).reduce((sum, e) => sum + e._count._all, 0), abandoned: matching.filter(e => e.name === 'stock_import_abandoned').reduce((sum, e) => sum + e._count._all, 0) };
  });
  const durations = (id: 'real_stock' | 'first_sale') => cohort.flatMap(s => s.milestones[id] ? [Math.max(0, (s.milestones[id]!.getTime() - s.createdAt.getTime()) / 3600000)] : []);
  return { range, generatedAt: now.toISOString(), steps: funnelSteps(counts), stockMethods,
    retention: { nextDay: cohort.filter(s => s.nextDay).length, week1Active: cohort.filter(s => s.week1Active).length, cohort: cohort.length },
    medianHours: { signupToStore: median(cohort.flatMap(s => s.memberships[0] ? [Math.max(0, (s.createdAt.getTime() - s.memberships[0].user.createdAt.getTime()) / 3600000)] : [])), storeToRealStock: median(durations('real_stock')), storeToFirstSale: median(durations('first_sale')) } };
}

const EVENT_LABELS: Record<EventName, string> = {
  signup: 'Registro', onboarding_name_viewed: 'Vio el nombre de la tienda', onboarding_name_completed: 'Puso el nombre de la tienda', onboarding_stock_viewed: 'Vio «Cargá tu stock»', stock_method_chosen: 'Eligió cómo cargar', stock_import_finished: 'Terminó una carga', stock_import_abandoned: 'Abandonó una carga', sample_stock_loaded: 'Cargó ejemplos', sample_stock_deleted: 'Borró ejemplos', onboarding_completed: 'Terminó el onboarding', first_step_completed: 'Completó un primer paso', first_steps_opened: 'Abrió Primeros pasos', first_steps_step_clicked: 'Eligió un primer paso', first_steps_finished: 'Primeros pasos 5/5', first_sale: 'Primera venta', invite_created: 'Invitó a alguien', invite_shared: 'Compartió una invitación', invite_accepted: 'Aceptó una invitación', app_installed: 'Instaló la app', active_day: 'Entró',
};
export async function getTimeline(id: string) {
  const [store] = await analyticsSnapshot([id]);
  if (!store) return null;
  const rows = await prisma.productEvent.findMany({ where: { OR: [{ storeId: id }, { storeId: null, userId: { in: store.memberships.map(m => m.userId) }, name: { in: ['signup', 'onboarding_name_viewed'] } }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500 });
  const events: Array<{ at: string; name: string; label: string; props: Record<string, unknown>; source: 'server' | 'client' | 'derived' }> = rows.filter(e => EVENT_NAMES.includes(e.name as EventName)).map(e => ({ at: e.createdAt.toISOString(), name: e.name, label: EVENT_LABELS[e.name as EventName], props: sanitizeProps(e.name as EventName, e.props), source: e.source === 'client' ? 'client' : 'server' }));
  const eventForMilestone: Partial<Record<FunnelStepId, EventName>> = { store_created: 'onboarding_name_completed', onboarding_done: 'onboarding_completed', first_sale: 'first_sale', team_invited: 'invite_created', team_joined: 'invite_accepted' };
  for (const [name, at] of Object.entries(store.derivedMilestones)) {
    const exact = eventForMilestone[name as FunnelStepId];
    if (exact && rows.some(e => e.name === exact)) continue;
    events.push({ at: at!.toISOString(), name, label: FUNNEL_STEPS.find(([id]) => id === name)![1], props: {}, source: 'derived' });
  }
  return { store: { id: store.id, name: store.name, createdAt: store.createdAt.toISOString(), ownerEmail: maskEmail(store.ownerEmail), stuckAt: store.stuckAt, activeDays30: store.activeDays30 }, events: events.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 500) };
}
