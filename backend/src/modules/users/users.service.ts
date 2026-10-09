import type { User } from "@prisma/client";
import type { FirebaseAuthContext } from "../../types/auth.js";
import { isUniqueConstraintError } from "../../lib/unique-constraint.js";
import { prisma } from "../../plugins/prisma.js";

export async function findOrCreateUserFromFirebase(auth: FirebaseAuthContext) {
  const existing = await prisma.user.findUnique({
    where: { firebaseUid: auth.firebaseUid },
  });

  const user = existing ?? (await createUserOrLoadWinner(auth));
  return fillMissingProfile(user, auth);
}

async function createUserOrLoadWinner(auth: FirebaseAuthContext) {
  try {
    return await prisma.user.create({
      data: {
        firebaseUid: auth.firebaseUid,
        email: auth.email,
        displayName: auth.name,
        avatarUrl: auth.picture,
      },
    });
  } catch (error) {
    // Simultaneous first requests all miss the lookup and insert. One insert
    // wins; the others hit the unique firebaseUid index and must read that row.
    if (!isUniqueConstraintError(error)) throw error;

    const winner = await prisma.user.findUnique({
      where: { firebaseUid: auth.firebaseUid },
    });
    if (!winner) throw error;
    return winner;
  }
}

async function fillMissingProfile(user: User, auth: FirebaseAuthContext) {
  const nextDisplayName = auth.name?.trim();
  const nextAvatarUrl = auth.picture?.trim();
  const nextEmail = auth.email?.trim();
  const shouldRefresh =
    (!user.displayName && nextDisplayName) ||
    (!user.avatarUrl && nextAvatarUrl) ||
    (!user.email && nextEmail);

  if (!shouldRefresh) return user;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: user.displayName ?? nextDisplayName ?? undefined,
      avatarUrl: user.avatarUrl ?? nextAvatarUrl ?? undefined,
      email: user.email ?? nextEmail ?? undefined,
    },
  });
}

export async function updateUserProfile(userId: string, data: { displayName?: string | null }) {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
