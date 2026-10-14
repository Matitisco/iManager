// Servidor estático mínimo para previews (Railway): sirve dist/ con caché larga para assets con hash.
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

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const { pathname } = new URL(req.url || '/', 'http://localhost');
  const file = (await resolveFile(pathname)) || join(root, 'index.html');
  try {
    const body = await readFile(file);
    const ext = extname(file);
    const hashed = /-[\w-]{8}\.(js|css|woff2)$/.test(file);
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      ...(noindex ? { 'X-Robots-Tag': 'noindex' } : {}),
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`landing → http://localhost:${port}`));
