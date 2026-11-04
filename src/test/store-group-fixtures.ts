import type { AppSession } from '../types/app-session';
import type { GroupBalance } from '../services/store-group-api';

export function groupSession(): AppSession {
  return {
    user: { id: 'u', firebaseUid: 'firebase-test', displayName: 'Ana ficticia', email: 'ana@example.test', avatarUrl: null },
    store: { id: 'wholesale', name: 'Central ficticia', legalName: null, taxId: null, phone: null, email: null, instagram: null, address: null, currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
    membership: { role: 'OWNER', isDefault: true, sections: null },
    stores: [
      { id: 'wholesale', name: 'Central ficticia', role: 'OWNER', isDefault: true, kind: 'WHOLESALE', groupId: 'g' },
      { id: 'retail', name: 'Local ficticio', role: 'OWNER', isDefault: false, kind: 'RETAIL', groupId: 'g' },
    ],
    onboardingRequired: false,
  };
}
export function groupBalance(): GroupBalance {
  const may = { month: '2026-05', revenue: 100, cost: 60, expenses: 10, netProfit: 30 };
  const june = { month: '2026-06', revenue: 200, cost: 100, expenses: 20, netProfit: 80 };
  return {
    currency: 'ARS', mixedCurrency: false, months: [may.month, june.month],
    stores: [
      { storeId: 'wholesale', name: 'Central ficticia', kind: 'WHOLESALE', totals: { revenue: 48200000, cost: 40000000, expenses: 1300000, grossProfit: 8200000, netProfit: 6900000 }, monthly: [may, june] },
      { storeId: 'retail', name: 'Local ficticio', kind: 'RETAIL', totals: { revenue: 12600000, cost: 9000000, expenses: 500000, grossProfit: 3600000, netProfit: 3100000 }, monthly: [may, june] },
    ],
    combined: { totals: { revenue: 60800000, cost: 49000000, expenses: 1800000, grossProfit: 11800000, netProfit: 10000000 }, monthly: [may, june] },
  };
}
