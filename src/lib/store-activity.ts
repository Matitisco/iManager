export type StoreActivityRange = '7d' | '30d' | 'all';
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
  stuckAt?: string | null;
  activeDays30?: number;
};

export type StoreActivityResponse = {
  range: StoreActivityRange;
  generatedAt: string;
  stores: StoreActivityRow[];
};

export { isTestStore } from '../../backend/src/modules/admin/test-stores';

export function isStoreActivityPath(pathname: string) {
  return /^\/admin\/actividad(?:\/embudo|\/tienda\/[^/]+)?\/?$/.test(pathname);
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
  if (!stage) return 'Nombre';
  return ({ name: 'Nombre', invite: 'Nombre', stock: 'Stock', video: 'Completo', complete: 'Completo', completed: 'Completo' } as Record<string, string>)[stage] ?? 'Nombre';
}
