import { z } from 'zod';

export const settingsSchema = z.object({
  active: z.boolean().optional(),
  hideWithoutStock: z.boolean().optional(),
  hideReserved: z.boolean().optional(),
  minBattery: z.number().int().min(0).max(100).nullable().optional(),
  showPrice: z.boolean().optional(),
  priceCurrency: z.enum(['ARS', 'USD', 'ORIGINAL']).optional(),
  logoUrl: z.string().url().max(2000).refine(url => url.startsWith('https://'), 'Usá un logo con URL https').nullable().optional(),
  hours: z.string().trim().max(120).nullable().optional(),
}).strict();
export const visibilitySchema = z.object({
  ids: z.array(z.string().min(1).max(120)).min(1).max(500),
  visible: z.boolean(),
}).strict();
export const slugSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,160}$/) });
export type CatalogSettingsInput = z.infer<typeof settingsSchema>;
