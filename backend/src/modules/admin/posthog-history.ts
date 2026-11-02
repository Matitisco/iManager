import { POSTHOG_ACTIONS, type HistoryType } from './activity-events.js';

export type HistoryPosition = { at: string; id: string };
export type PosthogRow = { id: string; storeId: string; at: Date; name: string; userId: string; role: string | null; props: Record<string, unknown>; entityId: string | null };
// Escape SQL literals rather than interpolating caller-controlled SQL. IDs, event names and dates only.
const literal = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const namesFor = (type?: HistoryType) => Object.keys(POSTHOG_ACTIONS).filter(n => !type || POSTHOG_ACTIONS[n].type === type);
export async function queryPosthog(query: string): Promise<unknown[][]> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key?.trim()) throw new Error('Activity source unavailable');
  const project = process.env.POSTHOG_PROJECT_ID ?? '689030';
  if (!/^\d+$/.test(project)) throw new Error('Activity source unavailable');
  // Fixed trusted origins prevent credential forwarding to arbitrary hosts.
  const host = process.env.POSTHOG_REGION === 'eu' ? 'https://eu.posthog.com' : 'https://us.posthog.com';
  const response = await fetch(`${host}/api/projects/${project}/query/`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' }),
    signal: AbortSignal.timeout(4500), redirect: 'error',
  });
  if (!response.ok) throw new Error('Activity source unavailable');
  const body = await response.json() as { results?: unknown; error?: unknown };
  if (!Array.isArray(body.results) || !body.results.every(Array.isArray) || body.error) throw new Error('Activity source unavailable');
  return body.results;
}
// No URLs or free-form properties are read. Keep a stable, explicit projection.
const fields = "uuid, properties.store_id AS store_id, toUnixTimestamp64Milli(toDateTime64(timestamp, 3)) AS at, event, distinct_id, properties.role AS role, properties.rows AS rows, NULL AS url, properties.sale_id AS sale_id";
const resultFields = 'uuid, store_id, at, event, distinct_id, role, rows, url, sale_id';
const arDay = "toDate(toTimeZone(timestamp, 'America/Argentina/Buenos_Aires'))";
export type IdentityAlias = { alias: string; userId: string };
export type ConnectionExclusion = { storeId: string; userId: string; day: string };
function decode(rows: unknown[][]): PosthogRow[] {
  return rows.map(r => {
    if (r.length !== 9 || !r.slice(0, 2).every(v => typeof v === 'string') || !Number.isFinite(Number(r[2])) || typeof r[3] !== 'string' || typeof r[4] !== 'string' || !Object.hasOwn(POSTHOG_ACTIONS, r[3])) throw new Error('Activity source unavailable');
    const at = new Date(Number(r[2]));
    if (!Number.isFinite(at.getTime())) throw new Error('Activity source unavailable');
    return { id: `p:${r[0]}`, storeId: r[1] as string, at, name: r[3], userId: r[4], role: typeof r[5] === 'string' ? r[5] : null,
      props: { rows: r[6] }, entityId: typeof r[8] === 'string' ? r[8] : null };
  });
}
/** Rank connections over the full day, before cursor/limit or per-store latest selection. */
function dailyEvents(conditions: string[], aliases: IdentityAlias[] = []) {
  const identity = aliases.length ? `multiIf(${aliases.map(a => `distinct_id = ${literal(a.alias)}, ${literal(a.userId)}`).join(', ')}, distinct_id)` : 'distinct_id';
  return `SELECT ${fields}, row_number() OVER (PARTITION BY properties.store_id, ${identity}, ${arDay}, event ORDER BY timestamp ASC, uuid ASC) AS daily_rank FROM events WHERE ${conditions.join(' AND ')} AND (event != 'user_logged_in' OR distinct_id != '') AND (event != 'excel_import_succeeded' OR properties.rows IS NULL OR properties.rows != 0)`;
}
export async function posthogHistory(storeId: string, options: { until: Date; from?: Date; to?: Date; type?: HistoryType; cursor?: HistoryPosition; limit: number; aliases?: IdentityAlias[] }) {
  const names = namesFor(options.type);
  if (!names.length) return [];
  const conditions = [`properties.store_id = ${literal(storeId)}`, `event IN (${names.map(literal).join(',')})`, `timestamp <= toDateTime64(${literal(options.until.toISOString())}, 3)`];
  if (options.from) conditions.push(`timestamp >= toDateTime64(${literal(options.from.toISOString())}, 3)`);
  if (options.to) conditions.push(`timestamp < toDateTime64(${literal(options.to.toISOString())}, 3)`);
  const outer = ["(event != 'user_logged_in' OR daily_rank = 1)"];
  if (options.cursor) outer.push(`(at, concat('p:', toString(uuid))) < (${Date.parse(options.cursor.at)}, ${literal(options.cursor.id)})`);
  return decode(await queryPosthog(`SELECT ${resultFields} FROM (${dailyEvents(conditions, options.aliases)}) WHERE ${outer.join(' AND ')} ORDER BY at DESC, uuid DESC LIMIT ${options.limit}`)).filter(r => r.storeId === storeId);
}
export async function latestPosthogActions(ids: string[], until: Date, excluded: ConnectionExclusion[] = [], aliases: IdentityAlias[] = []) {
  if (!ids.length) return [];
  const conditions = [`properties.store_id IN (${ids.map(literal).join(',')})`, `event IN (${namesFor().map(literal).join(',')})`, `timestamp <= toDateTime64(${literal(until.toISOString())}, 3)`];
  // A local daily connection is authoritative, even if a later login could hide a business action.
  if (excluded.length) conditions.push(`(event != 'user_logged_in' OR (properties.store_id, distinct_id, toString(${arDay})) NOT IN (${excluded.map(e => `(${literal(e.storeId)}, ${literal(e.userId)}, ${literal(e.day)})`).join(',')}))`);
  return decode(await queryPosthog(`SELECT ${resultFields} FROM (SELECT ${resultFields}, row_number() OVER (PARTITION BY store_id ORDER BY at DESC, uuid DESC) AS rank FROM (${dailyEvents(conditions, aliases)}) WHERE event != 'user_logged_in' OR daily_rank = 1) WHERE rank = 1`));
}
