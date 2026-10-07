export type BackendConnectionStatus = 'checking' | 'ready' | 'unconfigured' | 'offline' | 'error';

export type AppMembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';

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
  email: string | null;
  instagram: string | null;
  address: string | null;
  currency: string;
  timezone: string;
}

export interface AppMembershipSummary {
  role: AppMembershipRole;
  isDefault: boolean;
  sections?: string[] | null;
}

export interface AppUserStore {
  id: string;
  name: string;
  role: AppMembershipRole;
  isDefault: boolean;
}

export interface AppSession {
  user: AppUserSummary;
  store: AppStoreSummary | null;
  membership: AppMembershipSummary | null;
  stores?: AppUserStore[];
  onboardingRequired: boolean;
}

export interface AppSessionResponse extends AppSession {}
