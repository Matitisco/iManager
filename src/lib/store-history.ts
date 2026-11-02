export type HistoryType = 'create' | 'delete' | 'update' | 'connection';
export type HistoryAction = { id: string; at: string; type: HistoryType; text: string; actor: { name: string; role: string | null }; source: 'database' | 'posthog' };
export type HistoryResponse = { actions: HistoryAction[]; nextCursor: string | null; warning: string | null };
export type HistoryFilters = { type?: HistoryType; from?: string; to?: string; cursor?: string };
export const HISTORY_LABELS: Record<HistoryType, string> = { create: 'Cargas', delete: 'Bajas', update: 'Modificaciones', connection: 'Conexiones' };
