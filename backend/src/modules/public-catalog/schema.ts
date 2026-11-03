import { z } from 'zod';
import { moneyInput } from '../../lib/money-input.js';

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

export const catalogEditSchema = settingsSchema.extend({
  name: z.string().trim().min(1).max(100).optional(),
  priceRuleMode: z.enum(['LIST_PERCENT', 'COST_PERCENT', 'MANUAL']).optional(),
  priceAdjustPercent: z.number().finite().min(-100).max(10000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'Usá hasta dos decimales').optional(),
  manualPrices: z.array(z.object({
    inventoryItemId: z.string().min(1).max(120),
    price: moneyInput().nullable(),
    currency: z.enum(['ARS', 'USD']),
  }).strict()).max(500).optional(),
}).strict();
export const catalogIdSchema = z.object({ id: z.string().min(1).max(160) });
export const catalogPreviewSchema = catalogEditSchema.extend({ catalogId: z.string().min(1).max(160).optional() });
export type CatalogEditInput = z.infer<typeof catalogEditSchema>;
