import { prisma } from "../../plugins/prisma.js";
import type { FirebaseAuthContext } from "../../types/auth.js";
import { lockTransactionKey, userMembershipLockKey } from "../../lib/advisory-lock.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { buildAppSessionForUser, type AppSessionResponse } from "../auth/session.service.js";
import { asCurrency, asExchangeMode, asExchangeSource, positiveRate } from "../../lib/money-currency.js";

export interface CompleteOnboardingInput {
  storeName: string;
  currency?: string;
  exchangeMode?: string;
  exchangeSource?: string;
  manualBuy?: number | null;
  manualSell?: number | null;
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
      // Two first onboardings can both observe "no membership" and each create
      // a store. The lock makes the second request see the row the first wrote.
      await lockTransactionKey(tx, userMembershipLockKey(user.id));

      const membershipNow = await tx.storeMember.findFirst({
        where: { userId: user.id, isDefault: true },
        select: { id: true },
      });
      if (membershipNow) return;

      const store = await tx.store.create({
        data: {
          name: trimmedStoreName,
          currency: asCurrency(input.currency),
          exchangeMode: asExchangeMode(input.exchangeMode),
          exchangeSource: asExchangeSource(input.exchangeSource),
          manualBuy: positiveRate(input.manualBuy),
          manualSell: positiveRate(input.manualSell),
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
