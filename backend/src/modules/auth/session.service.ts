import type { FirebaseAuthContext } from "../../types/auth.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { getDefaultMembershipForUser } from "../stores/stores.service.js";

export interface AppSessionResponse {
  user: {
    id: string;
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    twoFactorEnabled: boolean;
  };
  store: {
    id: string;
    name: string;
    legalName: string | null;
    taxId: string | null;
    phone: string | null;
    address: string | null;
    currency: string;
    timezone: string;
  } | null;
  membership: {
    role: "OWNER" | "ADMIN" | "SELLER";
    isDefault: boolean;
  } | null;
  onboardingRequired: boolean;
}

function serializeSessionUser(user: Awaited<ReturnType<typeof findOrCreateUserFromFirebase>>) {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

export async function buildAppSessionForUser(auth: FirebaseAuthContext): Promise<AppSessionResponse> {
  const user = await findOrCreateUserFromFirebase(auth);
  const membership = await getDefaultMembershipForUser(user.id);

  if (!membership) {
    return {
      user: serializeSessionUser(user),
      store: null,
      membership: null,
      onboardingRequired: true,
    };
  }

  return {
    user: serializeSessionUser(user),
    store: {
      id: membership.store.id,
      name: membership.store.name,
      legalName: membership.store.legalName,
      taxId: membership.store.taxId,
      phone: membership.store.phone,
      address: membership.store.address,
      currency: membership.store.currency,
      timezone: membership.store.timezone,
    },
    membership: {
      role: membership.role,
      isDefault: membership.isDefault,
    },
    onboardingRequired: false,
  };
}
