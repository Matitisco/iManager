import type { FirebaseAuthContext } from "../../types/auth.js";
import { prisma } from "../../plugins/prisma.js";

export async function findOrCreateUserFromFirebase(auth: FirebaseAuthContext) {
  const existing = await prisma.user.findUnique({
    where: { firebaseUid: auth.firebaseUid },
  });

  if (existing) {
    const nextDisplayName = auth.name?.trim();
    const nextAvatarUrl = auth.picture?.trim();
    const nextEmail = auth.email?.trim();
    const shouldRefresh =
      (!existing.displayName && nextDisplayName) ||
      (!existing.avatarUrl && nextAvatarUrl) ||
      (!existing.email && nextEmail);

    if (shouldRefresh) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: existing.displayName ?? nextDisplayName ?? undefined,
          avatarUrl: existing.avatarUrl ?? nextAvatarUrl ?? undefined,
          email: existing.email ?? nextEmail ?? undefined,
        },
      });
    }

    return existing;
  }

  return prisma.user.create({
    data: {
      firebaseUid: auth.firebaseUid,
      email: auth.email,
      displayName: auth.name,
      avatarUrl: auth.picture,
    },
  });
}

export async function updateUserProfile(userId: string, data: { displayName?: string | null }) {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
