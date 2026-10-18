import { z } from 'zod';

export const CLIENT_EVENT_NAMES = ['onboarding_name_viewed', 'onboarding_stock_viewed', 'stock_method_chosen', 'stock_import_finished', 'stock_import_abandoned', 'first_steps_opened', 'first_steps_step_clicked', 'invite_shared'] as const;
export const SERVER_EVENT_NAMES = ['signup', 'onboarding_name_completed', 'sample_stock_loaded', 'sample_stock_deleted', 'onboarding_completed', 'first_step_completed', 'first_steps_finished', 'first_sale', 'invite_created', 'invite_accepted', 'app_installed', 'active_day'] as const;
export const EVENT_NAMES = [...SERVER_EVENT_NAMES, ...CLIENT_EVENT_NAMES] as const;
export type EventName = typeof EVENT_NAMES[number];
const method = z.enum(['excel', 'paste', 'manual', 'sample', 'skip', 'go_inventory']);
const importMethod = z.enum(['excel', 'paste', 'manual']);
const inviteRole = z.enum(['MANAGER', 'STAFF']);
const step = z.enum(['store', 'stock', 'sale', 'team', 'install']);
const role = z.enum(['OWNER', 'MANAGER', 'STAFF']);
const number = z.number().finite().nonnegative();
const shapes: Record<EventName, z.ZodRawShape> = {
  signup: { via: z.enum(['direct', 'invite']), provider: z.enum(['google', 'password']) },
  onboarding_name_viewed: {}, onboarding_stock_viewed: {},
  onboarding_name_completed: { currency: z.enum(['ARS', 'USD']), exchangeMode: z.enum(['auto', 'manual']), currencyPanelOpened: z.boolean() },
  stock_method_chosen: { method },
  stock_import_finished: { method: importMethod, ok: z.boolean(), rows: z.enum(['1', '2-10', '11-50', '51+']), errors: number },
  stock_import_abandoned: { method: importMethod, at: z.enum(['file', 'mapping', 'review', 'analyze']) },
  sample_stock_loaded: {}, sample_stock_deleted: {},
  onboarding_completed: { via: z.enum(['import', 'skip', 'sample']) },
  first_step_completed: { step, index: number.int().min(1).max(5) },
  first_steps_opened: { done: number.int().max(5) }, first_steps_step_clicked: { step },
  first_steps_finished: { days: number }, first_sale: { source: z.enum(['form', 'import']) },
  invite_created: { role: inviteRole, profile: z.enum(['seller', 'tech', 'all', 'custom']), nth: number.int() },
  invite_shared: { channel: z.enum(['copy', 'whatsapp']) },
  invite_accepted: { role: inviteRole, hoursToAccept: number },
  app_installed: { how: z.enum(['prompt', 'manual']) },
  active_day: { role, device: z.enum(['phone', 'desktop']), pwa: z.boolean() },
};

/** Validate each allowlisted property independently; never persist arbitrary strings. */
export function sanitizeProps(name: EventName, props: unknown): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  if (!props || typeof props !== 'object' || Array.isArray(props)) return result;
  for (const [key, schema] of Object.entries(shapes[name] ?? {})) {
    const value = (props as Record<string, unknown>)[key];
    const parsed = schema.safeParse(value);
    if (parsed.success && (typeof parsed.data !== 'string' || parsed.data.length <= 24)) result[key] = parsed.data;
  }
  return result;
}
