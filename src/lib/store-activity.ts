export type StoreActivityRange = '30d' | 'all';
export type ActivitySort = 'createdAt' | 'lastActivityAt';

export type StoreActivityCounts = {
  storeMembers: number;
  inventoryItems: number;
  sales: number;
  clients: number;
  repairOrders: number;
};

export type StoreActivityRow = {
  id: string;
  name: string;
  ownerEmail: string | null;
  billingPlan: string;
  billingStatus: string;
  trialEndsAt: string | null;
  createdAt: string;
  onboardingStage: string | null;
  counts: StoreActivityCounts;
  lastActivityAt: string | null;
};

export type StoreActivityResponse = {
  range: StoreActivityRange;
  generatedAt: string;
  stores: StoreActivityRow[];
};

const TEST_NAME = /qa-|demo|test|smoke/i;

export function isStoreActivityPath(pathname: string) {
  return pathname === '/admin/actividad' || pathname === '/admin/actividad/';
}

export function isTestStore(store: Pick<StoreActivityRow, 'name' | 'ownerEmail'>) {
  if (TEST_NAME.test(store.name)) return true;
  const at = store.ownerEmail?.lastIndexOf('@') ?? -1;
  if (at < 0 || !store.ownerEmail) return false;
  return store.ownerEmail.slice(at + 1).toLowerCase() === 'example.com';
}

function timeOf(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function sortStoreActivity(stores: StoreActivityRow[], sort: ActivitySort) {
  return [...stores].sort((a, b) => {
    const left = timeOf(sort === 'createdAt' ? a.createdAt : a.lastActivityAt);
    const right = timeOf(sort === 'createdAt' ? b.createdAt : b.lastActivityAt);
    if (right !== left) return right - left;
    return timeOf(b.createdAt) - timeOf(a.createdAt);
  });
}

export function planLabel(plan: string) {
  return ({ INTERNAL: 'Interno', TRIAL: 'Prueba', BASIC: 'Básico', BUSINESS: 'Negocio' } as Record<string, string>)[plan] ?? plan;
}

export function statusLabel(status: string) {
  return ({ ACTIVE: 'Activo', TRIAL: 'Prueba', EXPIRED: 'Vencido', CANCELLED: 'Cancelada' } as Record<string, string>)[status] ?? status;
}

export function stageLabel(stage: string | null) {
  if (!stage) return '—';
  return ({ invite: 'Equipo', stock: 'Stock', video: 'Video' } as Record<string, string>)[stage] ?? stage;
}
