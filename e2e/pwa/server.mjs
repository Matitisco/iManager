import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createSpaHandler } from '../../scripts/serve-spa.mjs';

// Test-only API fixtures. WebKit does not route requests that go through a
// service worker, so the PWA suite serves them from this local server too.
const me = {
  user: { id: 'pwa-user', firebaseUid: 'test-pwa-owner-imanager-test', displayName: 'Ana', email: 'pwa.owner@imanager.test', avatarUrl: null },
  store: { id: 'pwa-store', name: 'Tienda PWA', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', exchangeMode: 'manual', manualBuy: 1200, manualSell: 1250 },
  membership: { role: 'OWNER', isDefault: true }, stores: [], onboardingRequired: false,
};
const empty = { inventory: [], sales: [], clients: [], tradeIns: [], notifications: [], repairs: [], categories: [], catalogs: {}, members: [] };

const spa = createSpaHandler({ root: fileURLToPath(new URL('../../.pwa-test-dist', import.meta.url)) });
createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (path.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(path === '/api/me' ? me : empty));
    return;
  }
  return spa(req, res);
}).listen(4192, '127.0.0.1');
