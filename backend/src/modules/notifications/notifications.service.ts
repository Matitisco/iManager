import type { StoreNotification } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export type NotificationView = Omit<StoreNotification, "createdAt"> & {
  createdAt: string;
  readAt: string | null;
};

export async function listNotifications(storeId: string, userId: string, allowedSections: string[]): Promise<NotificationView[]> {
  if (!allowedSections.length) return [];
  const rows = await prisma.storeNotification.findMany({
    where: { storeId, section: { in: allowedSections } },
    include: { reads: { where: { userId }, select: { readAt: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  return rows.map(({ reads, ...row }) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: reads[0]?.readAt.toISOString() ?? null,
  }));
}

export async function markNotificationRead(storeId: string, userId: string, notificationId: string, allowedSections: string[]) {
  if (!allowedSections.length) return null;
  const notification = await prisma.storeNotification.findFirst({
    where: { id: notificationId, storeId, section: { in: allowedSections } },
    select: { id: true },
  });
  if (!notification) return null;
  const readAt = new Date();
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId, readAt },
    update: { readAt },
  });
  return { id: notificationId, readAt: readAt.toISOString() };
}

export async function markAllNotificationsRead(storeId: string, userId: string, allowedSections: string[]) {
  if (!allowedSections.length) return { count: 0 };
  const unread = await prisma.storeNotification.findMany({
    where: { storeId, section: { in: allowedSections }, reads: { none: { userId } } },
    select: { id: true },
  });
  if (!unread.length) return { count: 0 };
  await prisma.notificationRead.createMany({
    data: unread.map(({ id }) => ({ notificationId: id, userId })),
    skipDuplicates: true,
  });
  return { count: unread.length };
}
