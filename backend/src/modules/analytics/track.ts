import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { EVENT_NAMES, sanitizeProps, type EventName } from './events.js';
import { FIRST_STEP_IDS, type FirstStepFlags } from '../onboarding/first-steps.js';
export { EVENT_NAMES, sanitizeProps, type EventName } from './events.js';

export type TrackInput = { name: EventName; storeId?: string | null; userId?: string | null; props?: Record<string, string | number | boolean>; dedupeKey?: string; source?: 'server' | 'client'; clientAt?: Date };
export const log = { warn: () => console.warn('Product analytics write failed') };
export async function trackMany(events: TrackInput[]): Promise<void> {
  try {
    if (process.env.ANALYTICS_DISABLED === '1' || !events.length) return;
    await prisma.productEvent.createMany({
      skipDuplicates: true,
      data: events.filter(e => EVENT_NAMES.includes(e.name)).map(e => ({
        name: e.name, storeId: e.storeId ?? null, userId: e.userId ?? null,
        source: e.source ?? 'server', props: sanitizeProps(e.name, e.props) as Prisma.InputJsonObject,
        dedupeKey: e.dedupeKey, clientAt: e.clientAt,
      })),
    });
  } catch { try { log.warn(); } catch { /* Tracking must never affect business operations. */ } }
}
export async function track(event: TrackInput): Promise<void> { await trackMany([event]); }

export async function markFirstSteps(storeId: string, userId: string, steps: FirstStepFlags, createdAt: Date): Promise<void> {
  try {
    const done = FIRST_STEP_IDS.filter(step => steps[step]);
    const events: TrackInput[] = done.map((step) => ({ name: 'first_step_completed', storeId, userId, props: { step, index: done.length }, dedupeKey: `step:${storeId}:${step}` }));
    if (done.length === 5) events.push({ name: 'first_steps_finished', storeId, userId, props: { days: Math.max(0, (Date.now() - createdAt.getTime()) / 86400000) }, dedupeKey: `steps_done:${storeId}` });
    await trackMany(events);
  } catch { try { log.warn(); } catch { /* best effort */ } }
}
