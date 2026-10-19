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
  | 'commissions'
  | 'suppliers'
  | 'expenses'
  | 'reports'
  | 'history'
  | 'notifications'
  | 'settings'
  | 'more'
  | 'help';

export type Overlay =
  | { type: 'onboarding-stock' }
  | { type: 'new-eq'; supplierId?: string }
  | { type: 'eq'; id: string }
  | { type: 'edit-eq'; id: string }
  | { type: 'new-sale'; clientName?: string; clientId?: string; productId?: string; source?: 'inventory' | 'sales' | 'tradeins' | 'clients'; tradeInId?: string }
  | { type: 'sale'; id: string }
  | { type: 'edit-sale'; id: string }
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
  | { type: 'del'; kind: 'eq' | 'sale' | 'cj' | 'cl' | 'ot'; id: string; label: string }
  | { type: 'ctx'; kind: 'eq' | 'sale' | 'cj' | 'cl' | 'ot'; id: string; label: string; x: number; y: number; onSelect?: () => void }
  | { type: 'import'; kind: 'inv' | 'sale' | 'cl'; supplierId?: string; supplierName?: string }
  | { type: 'supplier'; id: string }
  | { type: 'new-supplier' }
  | { type: 'edit-supplier'; id: string }
  | { type: 'new-expense' }
  | { type: 'edit-expense'; id: string }
  | { type: 'store'; focus?: 'phone' }
  | { type: 'warranty' }
  | { type: 'periodic-report' }
  | { type: 'contact' }
  | { type: 'profile' }
  | { type: 'password' }
  | { type: 'invite'; url?: string; role?: string }
  | { type: 'invites' }
  | { type: 'logout' };
