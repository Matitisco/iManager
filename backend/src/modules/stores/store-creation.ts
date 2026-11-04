import type { Prisma } from '@prisma/client';

/** Shared by onboarding, standalone stores and multitienda. Cash registers,
 * catalogs/categories and receipt counters are initialized lazily on first use. */
export async function createStoreWithOwner(
  tx: Prisma.TransactionClient,
  userId: string,
  data: Prisma.StoreUncheckedCreateInput,
  isDefault: boolean,
) {
  const store = await tx.store.create({ data });
  const membership = await tx.storeMember.create({
    data: { storeId: store.id, userId, role: 'OWNER', isDefault },
  });
  return { store, membership };
}
