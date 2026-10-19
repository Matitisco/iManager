import type { BillingSummary } from './billing';
export type BackendConnectionStatus = 'checking' | 'ready' | 'unconfigured' | 'offline' | 'error' | 'unauthorized';

export type AppMembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface AppUserSummary {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AppStoreSummary {
  ownerDisplayName?: string;
  onboardingStage?: string | null;
  onboardingStartedAt?: string | null;
  onboardingCompletedAt?: string | null;
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  currency: string;
  exchangeMode?: 'auto' | 'manual';
  exchangeSource?: 'blue' | 'oficial' | 'mep';
  manualBuy?: number | null;
  manualSell?: number | null;
  timezone: string;
  usedWarrantyDays?: number;
  sealedWarrantyDays?: number;
  repairWarrantyDays?: number;
}

export interface AppMembershipSummary {
  role: AppMembershipRole;
  isDefault: boolean;
  sections?: string[] | null;
  sensitiveAccess?: boolean | null;
}

export interface AppUserStore {
  id: string;
  name: string;
  role: AppMembershipRole;
  isDefault: boolean;
}

export interface AppSession {
  billing?: BillingSummary;
  user: AppUserSummary;
  store: AppStoreSummary | null;
  membership: AppMembershipSummary | null;
  stores?: AppUserStore[];
  onboardingRequired: boolean;
}

export interface AppSessionResponse extends AppSession {}
