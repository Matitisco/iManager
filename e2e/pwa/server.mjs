import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createSpaHandler } from '../../scripts/serve-spa.mjs';

// Test-only API fixtures. WebKit does not route requests that go through a
// service worker, so the PWA suite serves them from this local server too.
import { readFile } from 'node:fs/promises';
import { me, data } from './fixtures.mjs';

const originalWorker = await readFile(new URL('../../.pwa-test-dist/sw.js', import.meta.url), 'utf8');
let release = 0;
const spa = createSpaHandler({ root: fileURLToPath(new URL('../../.pwa-test-dist', import.meta.url)) });
createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  // Deployment simulation exists only in this isolated test server.
  if (path === '/__test__/deploy' && req.method === 'POST') {
    release += 1; res.writeHead(200, { 'cache-control': 'no-store' }); res.end(String(release)); return;
  }
  if (path === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store', 'service-worker-allowed': '/' });
    res.end(originalWorker.replace(/const CACHE = [^;]+;/, `const CACHE = 'imanager-static-e2e-${release}';`)); return;
  }
  if (path.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(path === '/api/me' ? me : data));
    return;
  }
  return spa(req, res);
}).listen(4192, '127.0.0.1');
