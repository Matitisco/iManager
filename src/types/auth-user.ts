export interface AuthProviderInfo {
  providerId: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface AuthUserLike {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  tenantId?: string | null;
  providerData?: AuthProviderInfo[];
  getIdToken: () => Promise<string>;
}
