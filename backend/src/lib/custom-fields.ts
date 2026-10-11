import type { Prisma } from "@prisma/client";

export function normalizeCustomFields(customFields?: Record<string, unknown> | null): Prisma.InputJsonValue {
  return (customFields && Object.keys(customFields).length > 0 ? customFields : {}) as Prisma.InputJsonValue;
}
