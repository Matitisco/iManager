import type { Product, Sale } from '../types';
import type { TeamMember } from '../services/members-api';
import type { ReportsOverview } from '../services/reports-api';
import type { DashboardPeriod } from './dashboard-period';

export type DashboardReport = {
  key: string;
  range: DashboardPeriod;
  data: ReportsOverview | null;
  sales: Sale[];
  inventory: Product[];
  failed?: boolean;
  networkFailure?: boolean;
};

export type DashboardCacheEntry = {
  scope: string;
  range: DashboardPeriod;
  report: DashboardReport | null;
  members: TeamMember[];
  initialResolved: boolean;
};

const entries = new Map<string, DashboardCacheEntry>();
let version = 0;

export function dashboardCacheVersion() { return version; }

export function clearDashboardCache() {
  version += 1;
  entries.clear();
}

export function readDashboardCache(key: string) {
  return entries.get(key);
}

export function readLatestDashboardCache(scope: string) {
  return Array.from(entries.values()).reverse().find(entry => entry.scope === scope);
}

export function writeDashboardCache(key: string, entry: DashboardCacheEntry, ticket: number) {
  if (ticket !== version) return;
  entries.delete(key);
  entries.set(key, entry);
  if (entries.size > 8) entries.delete(entries.keys().next().value!);
}
