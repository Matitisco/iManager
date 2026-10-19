import type { DeskTab } from './types';

export const ROUTE: Record<DeskTab, string> = {
  billing: 'plan', cash: 'cajas', publicCatalog: 'catalogo', dashboard: 'dash', inventory: 'inv', sales: 'ven', tradeins: 'canjes',
  clients: 'clientes', service: 'servicio', reports: 'rep', history: 'historial', notifications: 'notif', settings: 'config',
  help: 'ayuda', more: 'mas', commissions: 'comisiones',
};

/** Hash routes may carry a query (`#/plan?preapproval_id=`). Only the path selects the screen. */
export function tabFromHash(hash: string): DeskTab {
  const name = hash.replace(/^#\/?/, '').split('?')[0]?.split('/')[0] ?? '';
  return (Object.keys(ROUTE) as DeskTab[]).find((key) => ROUTE[key] === name) ?? 'dashboard';
}
