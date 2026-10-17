// Servidor estático para previews y producción (Railway).
// NOINDEX=1 agrega X-Robots-Tag: noindex. El dominio final no define esa variable,
// así que no manda el header. El HTML tampoco trae un meta robots noindex.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), 'dist'));
const port = Number(process.env.PORT) || 4180;
const noindex = process.env.NOINDEX === '1';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

async function resolveFile(pathname) {
  const target = normalize(join(root, decodeURIComponent(pathname)));
  if (target !== root && !target.startsWith(root + sep)) return null;
  try {
    const s = await stat(target);
    if (s.isFile()) return target;
    if (s.isDirectory()) return resolveFile(join(pathname, 'index.html'));
  } catch {}
  return null;
}

function headers(file, status, { serviceWorker = false } = {}) {
  const ext = extname(file);
  const hashed = !serviceWorker && /-[\w-]{8}\.(js|css|woff2)$/.test(file);
  return {
    status,
    headers: {
      'Content-Type': serviceWorker ? 'application/javascript; charset=utf-8' : (types[ext] || 'application/octet-stream'),
      'Cache-Control': serviceWorker ? 'no-cache' : hashed ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      ...(noindex ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  };
}

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const { pathname } = new URL(req.url || '/', 'http://localhost');
  const serviceWorker = pathname === '/sw.js';
  const file = await resolveFile(pathname);
  if (!file) {
    const missing = extname(pathname);
    if (missing && missing !== '.html') {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        ...(serviceWorker ? { 'Cache-Control': 'no-cache' } : {}),
        ...(noindex ? { 'X-Robots-Tag': 'noindex' } : {}),
      }).end(req.method === 'HEAD' ? undefined : 'Not found');
      return;
    }
    try {
      const body = await readFile(join(root, '404.html'));
      const h = headers(join(root, '404.html'), 404);
      res.writeHead(h.status, h.headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
    return;
  }
  try {
    const body = await readFile(file);
    const h = headers(file, 200, { serviceWorker });
    res.writeHead(h.status, h.headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`landing → http://localhost:${port} noindex=${noindex}`));
