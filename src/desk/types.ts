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
  | { type: 'new-eq' }
  | { type: 'eq'; id: string }
  | { type: 'edit-eq'; id: string }
  | { type: 'new-sale'; clientName?: string; productId?: string }
  | { type: 'sale'; id: string }
  | { type: 'edit-sale'; id: string }
  | { type: 'new-cj' }
  | { type: 'cj'; id: string }
  | { type: 'edit-cj'; id: string }
  | { type: 'new-cl' }
  | { type: 'cl'; id: string }
  | { type: 'edit-cl'; id: string }
  | { type: 'del'; kind: 'eq' | 'sale' | 'cj' | 'cl'; id: string; label: string }
  | { type: 'ctx'; kind: 'eq' | 'sale' | 'cj' | 'cl'; id: string; label: string; x: number; y: number }
  | { type: 'import'; kind: 'inv' | 'sale' | 'cl' | 'cj' }
  | { type: 'store' }
  | { type: 'profile' }
  | { type: 'password' }
  | { type: 'invite'; url?: string; role?: string }
  | { type: 'invites' }
  | { type: 'logout' };
