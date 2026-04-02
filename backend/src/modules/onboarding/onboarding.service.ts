import { prisma } from "../../plugins/prisma.js";
import type { FirebaseAuthContext } from "../../types/auth.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { buildAppSessionForUser, type AppSessionResponse } from "../auth/session.service.js";

export interface CompleteOnboardingInput {
  storeName: string;
}

export async function completeOnboarding(
  auth: FirebaseAuthContext,
  input: CompleteOnboardingInput
): Promise<AppSessionResponse> {
  const user = await findOrCreateUserFromFirebase(auth);
  const trimmedStoreName = input.storeName.trim();

  if (!trimmedStoreName) {
    throw new Error("Store name is required");
  }

  const existingMembership = await prisma.storeMember.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true },
  });

  if (!existingMembership) {
    await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: trimmedStoreName,
        },
      });

      await tx.storeMember.create({
        data: {
          storeId: store.id,
          userId: user.id,
          role: "OWNER",
          isDefault: true,
        },
      });
    });
  }

  return buildAppSessionForUser(auth);
}
