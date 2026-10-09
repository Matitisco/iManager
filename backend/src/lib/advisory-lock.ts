import type { Prisma } from "@prisma/client";

/**
 * Holds a transaction-scoped lock so concurrent requests with the same key
 * run this critical section one at a time. The lock disappears with the
 * transaction, including when it rolls back.
 *
 * The two-integer form stays out of the bigint locks used for document numbers.
 * Callers that take more than one key must always acquire the user membership
 * key before the invitation key.
 */
export async function lockTransactionKey(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}), 164)`;
}

export function userMembershipLockKey(userId: string) {
  return `user-membership:${userId}`;
}
