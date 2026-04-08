import { prisma } from "../../plugins/prisma.js";

export async function getDefaultMembershipForUser(userId: string) {
  return prisma.storeMember.findFirst({
    where: { userId },
    include: { store: true },
    orderBy: { isDefault: "desc" },
  });
}

export interface StoreUpdateInput {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  timezone?: string;
}

export async function updateStore(storeId: string, data: StoreUpdateInput) {
  return prisma.store.update({
    where: { id: storeId },
    data,
  });
}
