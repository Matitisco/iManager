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
const fields = "uuid, properties.store_id, toUnixTimestamp64Milli(toDateTime64(timestamp, 3)), event, distinct_id, properties.role, properties.rows, properties.$current_url, properties.sale_id";
function decode(rows: unknown[][]): PosthogRow[] {
  return rows.map(r => {
    if (r.length !== 9 || !r.slice(0, 2).every(v => typeof v === 'string') || !Number.isFinite(Number(r[2])) || typeof r[3] !== 'string' || typeof r[4] !== 'string' || !Object.hasOwn(POSTHOG_ACTIONS, r[3])) throw new Error('Activity source unavailable');
    const at = new Date(Number(r[2]));
    if (!Number.isFinite(at.getTime())) throw new Error('Activity source unavailable');
    return { id: `p:${r[0]}`, storeId: r[1] as string, at, name: r[3], userId: r[4], role: typeof r[5] === 'string' ? r[5] : null,
      props: { rows: r[6], url: r[7] }, entityId: typeof r[8] === 'string' ? r[8] : null };
  });
}
export async function posthogHistory(storeId: string, options: { until: Date; from?: Date; to?: Date; type?: HistoryType; cursor?: HistoryPosition; limit: number }) {
  const names = namesFor(options.type);
  if (!names.length) return [];
  const conditions = [`properties.store_id = ${literal(storeId)}`, `event IN (${names.map(literal).join(',')})`, `timestamp <= toDateTime64(${literal(options.until.toISOString())}, 3)`];
  if (options.from) conditions.push(`timestamp >= toDateTime64(${literal(options.from.toISOString())}, 3)`);
  if (options.to) conditions.push(`timestamp < toDateTime64(${literal(options.to.toISOString())}, 3)`);
  if (options.cursor) conditions.push(`(toUnixTimestamp64Milli(toDateTime64(timestamp, 3)), concat('p:', toString(uuid))) < (${Date.parse(options.cursor.at)}, ${literal(options.cursor.id)})`);
  return decode(await queryPosthog(`SELECT ${fields} FROM events WHERE ${conditions.join(' AND ')} ORDER BY toUnixTimestamp64Milli(toDateTime64(timestamp, 3)) DESC, uuid DESC LIMIT ${options.limit}`)).filter(r => r.storeId === storeId);
}
export async function latestPosthogActions(ids: string[], until: Date) {
  if (!ids.length) return [];
  // One event per store, so a busy store cannot hide another store's latest action.
  return decode(await queryPosthog(`SELECT uuid, store_id, at, event, distinct_id, role, rows, url, sale_id FROM (SELECT uuid, properties.store_id AS store_id, toUnixTimestamp64Milli(toDateTime64(timestamp, 3)) AS at, event, distinct_id, properties.role AS role, properties.rows AS rows, properties.$current_url AS url, properties.sale_id AS sale_id, row_number() OVER (PARTITION BY properties.store_id ORDER BY timestamp DESC, uuid DESC) AS rank FROM events WHERE properties.store_id IN (${ids.map(literal).join(',')}) AND event IN (${namesFor().map(literal).join(',')}) AND timestamp <= toDateTime64(${literal(until.toISOString())}, 3)) WHERE rank = 1`));
}
