const loaders = [
  () => import('./screens/DashboardScreen'),
  () => import('./screens/InventoryScreen'),
  () => import('./screens/SalesScreen'),
  () => import('./screens/ClientsScreen'),
  () => import('./screens/TradeInsScreen'),
];

let pending: Promise<void> | null = null;

export function prefetchMainRoutes() {
  pending ??= Promise.all(loaders.map((load) => load().then(() => undefined))).then(() => undefined);
  return pending;
}
