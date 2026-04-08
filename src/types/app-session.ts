export type BackendConnectionStatus = 'checking' | 'ready' | 'unconfigured' | 'offline' | 'error';

export type AppMembershipRole = 'OWNER' | 'ADMIN' | 'SELLER';

export interface AppUserSummary {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AppStoreSummary {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
}

export interface AppMembershipSummary {
  role: AppMembershipRole;
  isDefault: boolean;
}

export interface AppSession {
  user: AppUserSummary;
  store: AppStoreSummary | null;
  membership: AppMembershipSummary | null;
  onboardingRequired: boolean;
}

export interface AppSessionResponse extends AppSession {}
