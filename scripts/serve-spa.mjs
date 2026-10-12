import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist'));
const firebaseConfig = JSON.parse(await readFile(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

export function createSpaHandler({ root = defaultRoot, fetchImpl = fetch, authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() } = {}) {
  return async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    // Same-origin Firebase helpers allow iOS redirect auth without third-party storage.
    // These endpoints must NEVER fall through to the SPA or static cache.
    if (url.pathname.startsWith('/__/auth/') || url.pathname === '/__/firebase/init.json') {
      if (!['GET', 'POST', 'HEAD'].includes(request.method)) {
        response.writeHead(405); response.end(); return;
      }
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 65536) { response.writeHead(413); response.end(); return; }
          chunks.push(chunk);
        }
        const headers = {};
        for (const name of ['content-type', 'accept', 'user-agent']) {
          if (request.headers[name]) headers[name] = request.headers[name];
        }
        const upstream = await fetchImpl(`https://${firebaseConfig.authDomain}${url.pathname}${url.search}`, {
          method: request.method, headers,
          ...(request.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
          redirect: 'manual', signal: AbortSignal.timeout(15000),
        });
        const outputHeaders = { 'cache-control': 'no-store' };
        for (const name of ['content-type', 'location']) {
          const value = upstream.headers.get(name);
          if (value) {
            // Keep Firebase's internal redirects on the configured helper origin.
            if (name === 'location' && authDomain) {
              const target = new URL(value, `https://${firebaseConfig.authDomain}`);
              outputHeaders[name] = target.hostname === firebaseConfig.authDomain && target.pathname.startsWith('/__/')
                ? target.pathname + target.search + target.hash : value;
            } else outputHeaders[name] = value;
          }
        }
        response.writeHead(upstream.status, outputHeaders);
        response.end(request.method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()));
      } catch {
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        response.end('No se pudo conectar con Firebase. Volvé a intentar.');
      }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    let requested;
    try { requested = decodeURIComponent(url.pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (requested.startsWith('/api/') || requested.startsWith('/__/')) {
      response.writeHead(404, { 'cache-control': 'no-store' }); response.end(); return;
    }
    let filePath = normalize(join(root, requested));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
      const body = await readFile(filePath);
      const cacheControl = requested === '/sw.js' || requested === '/version.json'
        ? 'no-store'
        : requested.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
      response.writeHead(200, {
        'content-type': types[extname(filePath)] || 'application/octet-stream',
        'cache-control': cacheControl,
        ...(requested === '/sw.js' ? { 'service-worker-allowed': '/' } : {}),
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      // Missing assets/helpers are errors, never an HTML response with a successful status.
      if (extname(requested)) { response.writeHead(404, { 'cache-control': 'no-store' }); response.end(); return; }
      const body = await readFile(join(root, 'index.html'));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : body);
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer(createSpaHandler()).listen(Number(process.env.PORT || 4173), '0.0.0.0');
}
