import { PrismaClient } from '@prisma/client';
import { repriceOpenSubscriptions, syncPlans } from './service.js';

const ART = 'America/Argentina/Buenos_Aires';
/** Fixed offset. Argentina does not observe daylight saving. */
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
/** Before the morning debit window, so the day's blue rate is already on the preapprovals. */
export const DAILY_REPRICE_HOUR = 6;
const DAILY_LOCK = 'billing:daily';

type SyncLog = { info: (message: string) => void; warn: (message: string) => void };

function artParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ART, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute'), second: read('second') };
}

/** Next 06:00 in Argentina, strictly after `now`. */
export function nextDailyReprice(now = new Date()) {
  const art = artParts(now);
  let slot = Date.UTC(art.year, art.month - 1, art.day, DAILY_REPRICE_HOUR, 0, 0) + ART_OFFSET_MS;
  if (slot <= now.getTime()) slot += 86_400_000;
  return new Date(slot);
}

export function dailyRepriceLine(plans: number, updated: number, failed: number) {
  const planLabel = plans === 1 ? '1 plan' : `${plans} planes`;
  const updatedLabel = updated === 1 ? '1 suscripción actualizada' : `${updated} suscripciones actualizadas`;
  const failedLabel = failed === 1 ? '1 error' : `${failed} errores`;
  return `Facturación diaria: ${planLabel}, ${updatedLabel}, ${failedLabel}.`;
}

function locked(value: unknown) {
  return value === true || value === 't';
}

/** Session lock on its own connection. A second instance skips instead of repeating the remote updates. */
async function withDailyLock<T>(run: () => Promise<T>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL');
  const pinned = new URL(url);
  pinned.searchParams.set('connection_limit', '1');
  const client = new PrismaClient({ datasourceUrl: pinned.toString() });
  try {
    const rows = await client.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(hashtext(${DAILY_LOCK}), 164) AS locked`;
    if (!locked(rows[0]?.locked)) return null;
    try {
      return await run();
    } finally {
      await client.$queryRaw`SELECT pg_advisory_unlock(hashtext(${DAILY_LOCK}), 164)`;
    }
  } finally {
    await client.$disconnect();
  }
}

/** Catalog plus every non-cancelled preapproval. Logs counts only. */
export async function runDailyReprice(log: SyncLog = console) {
  const quiet: SyncLog = { info() {}, warn() {} };
  try {
    const outcome = await withDailyLock(async () => {
      const plans = await syncPlans(log);
      const subs = await repriceOpenSubscriptions(quiet);
      return { plans: plans.length, updated: subs.updated, failed: subs.failed };
    });
    if (!outcome) return;
    log.info(dailyRepriceLine(outcome.plans, outcome.updated, outcome.failed));
  } catch {
    log.info(dailyRepriceLine(0, 0, 1));
  }
}

export function startDailyReprice(log: SyncLog, options?: { enabled?: boolean; run?: () => Promise<void> }) {
  const enabled = options?.enabled ?? process.env.NODE_ENV === 'production';
  if (!enabled) return () => undefined;
  const run = options?.run ?? (() => runDailyReprice(log));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const arm = () => {
    if (stopped) return;
    const delay = Math.max(0, nextDailyReprice().getTime() - Date.now());
    timer = setTimeout(() => {
      void run().finally(arm);
    }, delay);
    timer.unref?.();
  };
  log.info('Facturación diaria programada para las 06:00, hora de Argentina.');
  arm();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
