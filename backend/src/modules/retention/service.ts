import { Prisma, PrismaClient } from '@prisma/client';
import { retentionConfig } from './config.js';

// Separate namespace from billing/report locks. Session stays pinned to one connection.
export const RETENTION_LOCK = [1_845_101_001, 1] as const;
const DAY_MS = 86_400_000;
type Log = { info(message: string): void };
type Counts = { security: number; telemetry: number; notifications: number };
type Policy = { key: keyof Counts; table: Prisma.Sql; predicate: Prisma.Sql; cutoff: Date };

function policies(config: ReturnType<typeof retentionConfig>, now: Date): Policy[] {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const notificationCutoff = before(config.notificationDays);
  return [
    {
      key: 'security', table: Prisma.sql`"AuditEvent"`, cutoff: before(config.securityDays),
      // Financial, admin/import, inventory and unknown actions NEVER match this allowlist.
      predicate: Prisma.sql`(
        (t."entityType" = 'member' AND t.action IN ('member.invited', 'member.joined', 'member.removed', 'member.role', 'member.permissions'))
        OR (t."entityType" = 'invitation' AND t.action = 'invitation.cancelled')
      )`,
    },
    {
      key: 'telemetry', table: Prisma.sql`"ProductEvent"`, cutoff: before(config.telemetryDays),
      // Milestones, connections, invitations and dedupe keys remain durable.
      predicate: Prisma.sql`t."dedupeKey" IS NULL AND t.name IN (
        'onboarding_name_viewed', 'onboarding_stock_viewed', 'stock_method_chosen',
        'stock_import_finished', 'stock_import_abandoned', 'first_steps_opened',
        'first_steps_step_clicked', 'invite_shared'
      )`,
    },
    {
      key: 'notifications', table: Prisma.sql`"StoreNotification"`, cutoff: notificationCutoff,
      // Conservatively require every active member, regardless of section permissions.
      // A read by one user must never remove another user's unread notification.
      predicate: Prisma.sql`EXISTS (SELECT 1 FROM "NotificationRead" r WHERE r."notificationId" = t.id)
        AND NOT EXISTS (SELECT 1 FROM "NotificationRead" r WHERE r."notificationId" = t.id
          AND r."readAt" >= (${notificationCutoff}::timestamptz AT TIME ZONE 'UTC'))
        AND NOT EXISTS (SELECT 1 FROM "StoreMember" m WHERE m."storeId" = t."storeId" AND m."removedAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "NotificationRead" r WHERE r."notificationId" = t.id AND r."userId" = m."userId"))`,
    },
  ];
}

/** Each invocation is bounded; each batch commits independently. No business table is deleted. */
export async function runLogRetention(options: {
  environment?: Record<string, string | undefined>;
  now?: Date;
  log?: Log;
  // Only test code may opt into running the core against its isolated test database.
  allowTestExecution?: boolean;
} = {}) {
  const environment = options.environment ?? process.env;
  const config = retentionConfig(environment);
  const log = options.log ?? console;
  const counts: Counts = { security: 0, telemetry: 0, notifications: 0 };
  const finish = (status: 'disabled' | 'test' | 'locked' | 'completed') => {
    const result = { status, dryRun: config.dryRun, counts };
    log.info(`Retención: ${JSON.stringify(result)}`);
    return result;
  };
  if (!config.enabled) return finish('disabled');
  if (config.testEnvironment && !options.allowTestExecution) return finish('test');
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('Fecha de retención inválida.');
  if (!environment.DATABASE_URL) throw new Error('Falta la conexión de retención.');
  const url = new URL(environment.DATABASE_URL);
  url.searchParams.set('connection_limit', '1');
  const client = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const [lock] = await client.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${RETENTION_LOCK[0]}::int, ${RETENTION_LOCK[1]}::int) AS locked`;
    if (!lock?.locked) return finish('locked');
    try {
      for (const policy of policies(config, now)) {
        let cursor: string | null = null;
        let batches = 0;
        let capped = false;
        for (; batches < config.maxBatches; batches++) {
          const eligible = Prisma.sql`t."createdAt" < (${policy.cutoff}::timestamptz AT TIME ZONE 'UTC') AND ${policy.predicate}`;
          const result = await client.$transaction(async tx => {
            await tx.$queryRaw`SELECT set_config('lock_timeout', '1000', true), set_config('statement_timeout', '5000', true)`;
            // If the pool had to reconnect, the old session lock is gone. Stop rather
            // than continuing concurrently with a worker that acquired it meanwhile.
            const [owner] = await tx.$queryRaw<{ held: boolean }[]>`SELECT EXISTS (
              SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()
                AND classid = ${RETENTION_LOCK[0]}::oid AND objid = ${RETENTION_LOCK[1]}::oid
                AND objsubid = 2 AND granted
            ) AS held`;
            if (!owner?.held) throw new Error('Se perdió el lock de retención.');
            if (config.dryRun) {
              const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
                SELECT t.id FROM ${policy.table} t WHERE ${eligible}
                ${cursor === null ? Prisma.empty : Prisma.sql`AND t.id > ${cursor}`}
                ORDER BY t.id LIMIT ${config.batchSize}`);
              return { count: rows.length, cursor: rows.at(-1)?.id ?? null };
            }
            const count = await tx.$executeRaw(Prisma.sql`
              WITH candidates AS (
                SELECT t.id FROM ${policy.table} t WHERE ${eligible}
                ORDER BY t.id LIMIT ${config.batchSize} FOR UPDATE OF t SKIP LOCKED
              ) DELETE FROM ${policy.table} d USING candidates c WHERE d.id = c.id`);
            return { count, cursor: null };
          }, { maxWait: 2_000, timeout: 8_000 });
          counts[policy.key] += result.count;
          cursor = result.cursor;
          capped = result.count === config.batchSize;
          // Log after commit so a later failure cannot hide already committed deletion counts.
          log.info(`Retención lote: ${JSON.stringify({ category: policy.key, dryRun: config.dryRun, count: result.count, batch: batches + 1 })}`);
          if (!capped) break;
        }
        log.info(`Retención categoría: ${JSON.stringify({ category: policy.key, dryRun: config.dryRun,
          count: counts[policy.key], cutoff: policy.cutoff.toISOString(), capped })}`);
      }
      return finish('completed');
    } finally {
      await client.$queryRaw`SELECT pg_advisory_unlock(${RETENTION_LOCK[0]}::int, ${RETENTION_LOCK[1]}::int)`;
    }
  } finally {
    await client.$disconnect();
  }
}
