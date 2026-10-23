import { z } from "zod";

export const purchaseNameFields = {
  purchaseName: z.string().trim().max(120).nullable().optional(),
  name: z.string().trim().max(120).nullable().optional(),
};

/** purchaseName takes precedence over its compatibility alias, including explicit null. */
export function readPurchaseName(input: { purchaseName?: string | null; name?: string | null }): string | null {
  const value = input.purchaseName !== undefined ? input.purchaseName : input.name;
  return purchaseNameFields.name.parse(value)?.trim() || null;
}
