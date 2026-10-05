export interface FocusTask {
  id: 'sales' | 'trade-ins' | 'inventory' | 'clients';
  title: string;
  description: string;
  count: number;
  tab: 'sales' | 'tradeins' | 'inventory' | 'clients';
}

interface FocusSource {
  sales: { status: string }[];
  tradeIns: { status: string }[];
  inventory: { status: string }[];
  clients: { pendingBalance: number }[];
}

const OPEN_TRADE_IN_STATUSES = new Set(['PENDIENTE', 'EN REVISIÓN', 'PERITAJE TÉC.']);

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildFocusTasks({ sales, tradeIns, inventory, clients }: FocusSource): FocusTask[] {
  const pendingSales = sales.filter((sale) => sale.status === 'PENDIENTE').length;
  const openTradeIns = tradeIns.filter((trade) => OPEN_TRADE_IN_STATUSES.has(trade.status)).length;
  const devicesInReview = inventory.filter((item) => item.status === 'EN_REVISION').length;
  const clientsWithBalance = clients.filter((client) => client.pendingBalance > 0).length;

  const tasks: FocusTask[] = [];

  if (pendingSales > 0) {
    tasks.push({
      id: 'sales',
      title: countLabel(pendingSales, 'venta pendiente', 'ventas pendientes'),
      description: 'Cerrá las ventas que siguen abiertas.',
      count: pendingSales,
      tab: 'sales',
    });
  }

  if (openTradeIns > 0) {
    tasks.push({
      id: 'trade-ins',
      title: countLabel(openTradeIns, 'canje en curso', 'canjes en curso'),
      description: 'Seguí los canjes que todavía no están listos.',
      count: openTradeIns,
      tab: 'tradeins',
    });
  }

  if (devicesInReview > 0) {
    tasks.push({
      id: 'inventory',
      title: countLabel(devicesInReview, 'equipo en revisión', 'equipos en revisión'),
      description: 'Definí el estado de los equipos que siguen en revisión.',
      count: devicesInReview,
      tab: 'inventory',
    });
  }

  if (clientsWithBalance > 0) {
    tasks.push({
      id: 'clients',
      title: countLabel(clientsWithBalance, 'cliente con saldo', 'clientes con saldo'),
      description: 'Revisá los saldos que todavía no se cobraron.',
      count: clientsWithBalance,
      tab: 'clients',
    });
  }

  return tasks;
}
