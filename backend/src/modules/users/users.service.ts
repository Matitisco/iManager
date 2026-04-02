import type { FirebaseAuthContext } from "../../types/auth.js";
import { prisma } from "../../plugins/prisma.js";

export async function findOrCreateUserFromFirebase(auth: FirebaseAuthContext) {
  const existing = await prisma.user.findUnique({
    where: { firebaseUid: auth.firebaseUid },
  });

  if (existing) {
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
