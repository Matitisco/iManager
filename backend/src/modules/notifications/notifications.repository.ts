import { prisma } from "../../plugins/prisma.js";

export const notificationsRepository = {
  list(storeId: string, userId: string, allowedSections: string[]) {
    return prisma.storeNotification.findMany({
      where: { storeId, section: { in: allowedSections } },
      include: { reads: { where: { userId }, select: { readAt: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
  },

  findVisible(storeId: string, notificationId: string, allowedSections: string[]) {
    return prisma.storeNotification.findFirst({
      where: { id: notificationId, storeId, section: { in: allowedSections } },
      select: { id: true },
    });
  },

  markRead(notificationId: string, userId: string, readAt: Date) {
    return prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId, readAt },
      update: { readAt },
    });
  },

  listUnread(storeId: string, userId: string, allowedSections: string[]) {
    return prisma.storeNotification.findMany({
      where: {
        storeId,
        section: { in: allowedSections },
        reads: { none: { userId } },
      },
      select: { id: true },
    });
  },

  markManyRead(userId: string, notificationIds: string[]) {
    return prisma.notificationRead.createMany({
      data: notificationIds.map((notificationId) => ({ notificationId, userId })),
      skipDuplicates: true,
    });
  },
};
