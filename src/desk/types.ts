export type DeskTab =
  | 'dashboard'
  | 'inventory'
  | 'publicCatalog'
  | 'sales'
  | 'tradeins'
  | 'clients'
  | 'service'
  | 'commissions'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'more'
  | 'help';

export type Overlay =
  | { type: 'onboarding-stock' }
  | { type: 'new-eq' }
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
  | { type: 'import'; kind: 'inv' | 'sale' | 'cl' }
  | { type: 'store'; focus?: 'phone' }
  | { type: 'warranty' }
  | { type: 'contact' }
  | { type: 'profile' }
  | { type: 'password' }
  | { type: 'invite'; url?: string; role?: string }
  | { type: 'invites' }
  | { type: 'logout' };
