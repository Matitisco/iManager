import { prisma } from "../../plugins/prisma.js";

export async function getDefaultMembershipForUser(userId: string) {
  return prisma.storeMember.findFirst({
    where: { userId },
    include: { store: true },
    orderBy: { isDefault: "desc" },
  });
}
