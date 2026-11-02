export type HistoryType = 'inventory' | 'sales' | 'team' | 'session' | 'navigation' | 'other';
export type HistoryAction = { id: string; at: string; type: HistoryType; text: string; actor: { name: string; role: string | null }; source: 'database' | 'posthog' };
export type HistoryResponse = { actions: HistoryAction[]; nextCursor: string | null; warning: string | null };
export type HistoryFilters = { type?: HistoryType; from?: string; to?: string; cursor?: string };
export const HISTORY_LABELS: Record<HistoryType, string> = { inventory: 'Equipos y cargas', sales: 'Ventas', team: 'Equipo de trabajo', session: 'Entradas y cuentas', navigation: 'Pantallas visitadas', other: 'Otras acciones' };
