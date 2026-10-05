import type { FirebaseAuthContext } from "../../types/auth.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import {
  getDefaultMembershipForUser,
  getMembershipForUserAndStore,
  listStoresForUser,
  type UserStoreSummary,
} from "../stores/stores.service.js";

export interface AppSessionResponse {
  user: {
    id: string;
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
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
    role: "OWNER" | "MANAGER" | "STAFF";
    isDefault: boolean;
  } | null;
  stores: UserStoreSummary[];
  onboardingRequired: boolean;
}

function serializeSessionUser(user: Awaited<ReturnType<typeof findOrCreateUserFromFirebase>>) {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

export async function buildAppSessionForUser(
  auth: FirebaseAuthContext,
  preferredStoreId?: string
): Promise<AppSessionResponse> {
  const user = await findOrCreateUserFromFirebase(auth);
  const stores = await listStoresForUser(user.id);
  const membership =
    (preferredStoreId
      ? await getMembershipForUserAndStore(user.id, preferredStoreId)
      : null) ?? await getDefaultMembershipForUser(user.id);

  if (!membership) {
    return {
      user: serializeSessionUser(user),
      store: null,
      membership: null,
      stores,
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
    stores,
    onboardingRequired: false,
  };
}
