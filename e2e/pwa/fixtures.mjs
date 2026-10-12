// Public fictitious data for install screenshots and the isolated PWA suite.
export const me = {
  user: { id: 'pwa-user', firebaseUid: 'test-pwa-owner-imanager-test', displayName: 'Ana', email: 'pwa.owner@imanager.test', avatarUrl: null },
  store: { id: 'pwa-store', name: 'Tienda PWA', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', exchangeMode: 'auto', exchangeSource: 'blue', manualBuy: null, manualSell: null },
  membership: { role: 'OWNER', isDefault: true }, stores: [], onboardingRequired: false,
};
const products = [
  ['iPhone 16 Pro', '256 GB', 'Titanio natural', 'NUEVO', '100%', 1490000],
  ['iPhone 15', '128 GB', 'Azul', 'USADO', '92%', 950000],
  ['iPhone 14 Pro', '256 GB', 'Negro', 'USADO', '88%', 890000],
  ['Samsung Galaxy S24', '256 GB', 'Gris', 'NUEVO', '100%', 1100000],
  ['iPhone 13', '128 GB', 'Blanco', 'USADO', '85%', 640000],
];
export const data = {
  inventory: products.map(([model, capacity, color, condition, batteryHealth, price], index) => ({ id: `pwa-product-${index}`, imei: `35987654321000${index}`, model, capacity, color, condition, batteryHealth, price, cost: price * .75, currency: 'ARS', grade: 'A', status: 'DISPONIBLE', createdAt: '2026-10-12T12:00:00Z' })),
  clients: [{ id: 'pwa-client', dni: '34567890', name: 'Lucía Martínez', email: 'lucia@example.test', phone: '1144445555', totalSpent: 950000, pendingBalance: 0, lastPurchaseDate: '2026-10-12' }],
  sales: [], tradeIns: [], notifications: [], repairs: [], categories: [], catalogs: {}, members: [],
};
