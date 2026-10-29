import type { ScanDraft } from './scan/draft';
import type { MenuAnchor } from './menu-position';

export type DeskTab =
  | 'billing'
  | 'cash'
  | 'dashboard'
  | 'inventory'
  | 'publicCatalog'
  | 'sales'
  | 'tradeins'
  | 'clients'
  | 'service'
  | 'followups'
  | 'stockCount'
  | 'commissions'
  | 'suppliers'
  | 'returns'
  | 'patterns'
  | 'expenses'
  | 'reports'
  | 'periodicSummary'
  | 'history'
  | 'notifications'
  | 'settings'
  | 'more'
  | 'help';

export type SaleResume = {
  clientName?: string;
  clientId?: string;
  amount?: string;
  source?: 'inventory' | 'sales' | 'tradeins' | 'clients';
};

export type Overlay =
  | { type: 'onboarding-stock' }
  | { type: 'new-eq'; supplierId?: string }
  | { type: 'eq'; id: string }
  | { type: 'edit-eq'; id: string }
  | { type: 'new-sale'; clientName?: string; clientId?: string; productId?: string; source?: 'inventory' | 'sales' | 'tradeins' | 'clients'; tradeInId?: string; resumeAmount?: string }
  | { type: 'scan-review'; draft: ScanDraft; resume?: SaleResume }
  | { type: 'batch-eq' }
  | { type: 'sale'; id: string }
  | { type: 'edit-sale'; id: string }
  | { type: 'restore-sale'; id: string; label: string }
  | { type: 'new-cj' }
  | { type: 'cj'; id: string; source?: 'inventory' | 'sales' | 'tradeins' | 'clients'; kind?: string }
  | { type: 'edit-cj'; id: string; source?: 'sales' | 'tradeins' | 'inventory' | 'clients' }
  | { type: 'new-ot' }
  | { type: 'ot'; id: string }
  | { type: 'edit-ot'; id: string }
  | { type: 'new-deposit'; id: string }
  | { type: 'repair-deposit'; id: string }
  | { type: 'new-cl' }
  | { type: 'cl'; id: string }
  | { type: 'edit-cl'; id: string }
  | { type: 'del'; kind: 'eq' | 'sale' | 'cj' | 'cl' | 'ot' | 'return'; id: string; label: string }
  | ({ type: 'ctx'; kind: 'eq' | 'sale' | 'cj' | 'cl' | 'ot' | 'return'; id: string; label: string; onSelect?: () => void } & MenuAnchor)
  | { type: 'import'; kind: 'inv' | 'sale' | 'cl'; supplierId?: string; supplierName?: string }
  | { type: 'supplier'; id: string }
  | { type: 'new-supplier' }
  | { type: 'edit-supplier'; id: string }
  | { type: 'new-expense' }
  | { type: 'edit-expense'; id: string }
  | { type: 'new-return'; saleId?: string }
  | { type: 'return'; id: string }
  | { type: 'edit-return'; id: string }
  | { type: 'store'; focus?: 'phone' }
  | { type: 'warranty' }
  | { type: 'periodic-report' }
  | { type: 'contact' }
  | { type: 'profile' }
  | { type: 'password' }
  | { type: 'invite'; url?: string; role?: string }
  | { type: 'invites' }
  | { type: 'logout' };
