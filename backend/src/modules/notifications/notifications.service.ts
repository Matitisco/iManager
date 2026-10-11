import type { StoreNotification } from "@prisma/client";
import { notificationsRepository } from "./notifications.repository.js";

export type NotificationView = Omit<StoreNotification, "createdAt"> & {
  createdAt: string;
  readAt: string | null;
};

export async function listNotifications(storeId: string, userId: string, allowedSections: string[]): Promise<NotificationView[]> {
  if (!allowedSections.length) return [];
  const rows = await notificationsRepository.list(storeId, userId, allowedSections);
  return rows.map(({ reads, ...row }) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: reads[0]?.readAt.toISOString() ?? null,
  }));
}

export async function markNotificationRead(storeId: string, userId: string, notificationId: string, allowedSections: string[]) {
  if (!allowedSections.length) return null;
  const notification = await notificationsRepository.findVisible(storeId, notificationId, allowedSections);
  if (!notification) return null;
  const readAt = new Date();
  await notificationsRepository.markRead(notificationId, userId, readAt);
  return { id: notificationId, readAt: readAt.toISOString() };
}

export async function markAllNotificationsRead(storeId: string, userId: string, allowedSections: string[]) {
  if (!allowedSections.length) return { count: 0 };
  const unread = await notificationsRepository.listUnread(storeId, userId, allowedSections);
  if (!unread.length) return { count: 0 };
  await notificationsRepository.markManyRead(userId, unread.map(({ id }) => id));
  return { count: unread.length };
}
