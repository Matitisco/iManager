import { z } from 'zod';

export const enableSchema = z
  .object({
    currentKind: z.enum(['WHOLESALE', 'RETAIL']),
    otherStoreName: z.string().trim().min(1).max(120),
    otherAddress: z.string().trim().max(255).optional(),
    otherInstagram: z.string().trim().max(300).optional(),
  })
  .strict();
export const balanceQuery = z
  .object({
    months: z.coerce
      .number()
      .pipe(z.union([z.literal(3), z.literal(6), z.literal(12)]))
      .default(6),
  })
  .strict();
export const transfersQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();
export const transferSchema = z
  .object({
    toStoreId: z.string().min(1).max(120),
    items: z
      .array(
        z
          .object({
            inventoryItemId: z.string().min(1).max(120),
            quantity: z.number().int().min(1).max(2147483647).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (items) =>
          new Set(items.map((item) => item.inventoryItemId)).size ===
          items.length,
        'No repitas equipos en la transferencia',
      ),
    requestKey: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type EnableInput = z.infer<typeof enableSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
