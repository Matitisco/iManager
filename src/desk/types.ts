export type DeskTab =
  | 'dashboard'
  | 'inventory'
  | 'sales'
  | 'tradeins'
  | 'clients'
  | 'reports'
  | 'notifications'
  | 'settings';

export type Overlay =
  | { type: 'new-acc' }
  | { type: 'edit-acc'; id: string }
  | { type: 'new-eq' }
  | { type: 'eq'; id: string }
  | { type: 'edit-eq'; id: string }
  | { type: 'new-sale'; clientName?: string; clientId?: string; productId?: string; source?: 'inventory' | 'sales' | 'tradeins' | 'clients'; tradeInId?: string }
  | { type: 'sale'; id: string }
  | { type: 'edit-sale'; id: string }
  | { type: 'new-cj' }
  | { type: 'cj'; id: string; source?: 'inventory' | 'sales' | 'tradeins' | 'clients'; kind?: string }
  | { type: 'edit-cj'; id: string; source?: 'sales' | 'tradeins' | 'inventory' | 'clients' }
  | { type: 'new-cl' }
  | { type: 'cl'; id: string }
  | { type: 'edit-cl'; id: string }
  | { type: 'del'; kind: 'eq' | 'sale' | 'cj' | 'cl' | 'acc'; id: string; label: string }
  | { type: 'ctx'; kind: 'eq' | 'sale' | 'cj' | 'cl' | 'acc'; id: string; label: string; x: number; y: number }
  | { type: 'import'; kind: 'inv' | 'sale' | 'cl' | 'cj' }
  | { type: 'store' }
  | { type: 'contact' }
  | { type: 'profile' }
  | { type: 'password' }
  | { type: 'invite'; url?: string; role?: string }
  | { type: 'invites' }
  | { type: 'logout' };
