import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createSpaHandler } from '../../scripts/serve-spa.mjs';

// Test-only API fixtures. WebKit does not route requests that go through a
// service worker, so the PWA suite serves them from this local server too.
import { readFile } from 'node:fs/promises';
import { me, data } from './fixtures.mjs';

const originalWorker = await readFile(new URL('../../.pwa-test-dist/sw.js', import.meta.url), 'utf8');
const embeddedBuildId = JSON.parse(await readFile(new URL('../../.pwa-test-dist/version.json', import.meta.url), 'utf8')).buildId;
let swRelease = 0;
let versionRelease = 0;
const spa = createSpaHandler({ root: fileURLToPath(new URL('../../.pwa-test-dist', import.meta.url)) });
createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  // Deployment simulation exists only in this isolated test server.
  // mode=version changes only version.json (the production miss: the worker
  // claims without the open page noticing). A later document navigation
  // stands in for the reloaded bundle, whose id matches version.json again.
  if (path === '/__test__/deploy' && req.method === 'POST') {
    const mode = url.searchParams.get('mode') || 'all';
    if (mode !== 'version') swRelease += 1;
    if (mode !== 'sw') versionRelease += 1;
    res.writeHead(200, { 'cache-control': 'no-store' }); res.end(String(versionRelease || swRelease)); return;
  }
  if (path === '/version.json') {
    const buildId = versionRelease > 0 ? `${embeddedBuildId}-r${versionRelease}` : embeddedBuildId;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ buildId })); return;
  }
  if ((path === '/' || path === '/index.html') && versionRelease > 0) {
    const mode = req.headers['sec-fetch-mode'];
    const accept = req.headers.accept || '';
    // A document navigation stands in for the reloaded bundle. The worker
    // forwards it with dest "empty"; precache is a cors addAll and must not
    // clear the pending version before the open page sees it.
    if (mode === 'navigate' && accept.includes('text/html')) versionRelease = 0;
  }
  if (path === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store', 'service-worker-allowed': '/' });
    res.end(originalWorker.replace(/const CACHE = [^;]+;/, `const CACHE = 'imanager-static-e2e-${swRelease}';`)); return;
  }
  if (path.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(path === '/api/me' ? me : data));
    return;
  }
  return spa(req, res);
}).listen(4192, '127.0.0.1');
