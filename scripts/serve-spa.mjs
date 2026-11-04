import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cspBuildConfig, inlineScriptHashes, securityHeaders } from './security-headers.mjs';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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

function sameSecret(received, expected) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const sessionCookie = 'imanager_test_session';
const sessionSeconds = 30 * 24 * 60 * 60;
const loginBodyLimit = 8192;
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function safeNext(value) {
  if (typeof value !== 'string') return '/';
  try {
    // Also reject encoded slashes/backslashes/control characters before redirecting.
    for (const candidate of [value, decodeURIComponent(value)]) {
      if (!candidate.startsWith('/') || candidate.startsWith('//') || /[\\\x00-\x20\x7f]/.test(candidate)) return '/';
    }
    return value;
  } catch { return '/'; }
}

function loginPage(response, status, next, message = '') {
  response.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ingresar · iManager test</title>
<style>body{font-family:system-ui,sans-serif;background:#f3f4f6;color:#172033;margin:0;padding:24px}main{max-width:360px;margin:10vh auto;background:white;padding:28px;border-radius:12px}h1{font-size:24px}label{display:block;margin-top:16px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:6px;border:1px solid #9ca3af;border-radius:6px}button{margin-top:24px;background:#1d4ed8;color:white;cursor:pointer}.error{color:#b91c1c}</style></head>
<body><main><h1>Ingresar a iManager test</h1><p>Acceso restringido al entorno de pruebas.</p>${message ? `<p class="error" role="alert">${escapeHtml(message)}</p>` : ''}
<form method="post" action="/__login"><label for="username">Usuario</label><input id="username" name="username" autocomplete="username" required><label for="password">Contraseña</label><input id="password" type="password" name="password" autocomplete="current-password" required><input type="hidden" name="next" value="${escapeHtml(safeNext(next))}"><button type="submit">Ingresar</button></form></main></body></html>`);
}

function gateRedirect(response, location, cookie) {
  response.writeHead(303, { location, 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) });
  response.end();
}

// Optional test gate: both absent disables it; partial configuration fails closed.
// Non-POST requests retain the synchronous boolean API used by existing callers.
export function createBasicAuthGuard({ user = process.env.BASIC_AUTH_USER, pass = process.env.BASIC_AUTH_PASS, now = Date.now } = {}) {
  if (!!user !== !!pass) throw new Error('BASIC_AUTH_USER and BASIC_AUTH_PASS must both be configured');
  if (!user && !pass) return () => true;
  const key = createHash('sha256').update(`imanager-test-gate:${user}\0${pass}`).digest();
  const sign = payload => createHmac('sha256', key).update(payload).digest('base64url');
  const cookieHeader = (token, maxAge) => `${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const validCookie = header => {
    const token = (header || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
    if (!token || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
    const [payload, signature] = token.split('.');
    if (!sameSecret(signature, sign(payload))) return false;
    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return Number.isSafeInteger(exp) && exp > now();
    } catch { return false; }
  };
  const credentialsMatch = (username, password) => {
    const userMatches = sameSecret(username, user);
    const passMatches = sameSecret(password, pass);
    return userMatches && passMatches;
  };
  const failures = new Map();
  let nextSweep = 0;
  // Only denied requests consume quota; valid users behind the same NAT still enter.
  // Forwarding headers are not trusted by this standalone HTTP server.
  const recordFailure = (request, response) => {
    const time = now();
    if (time >= nextSweep) {
      for (const [key, entry] of failures) if (entry.expires <= time) failures.delete(key);
      nextSweep = time + 60000;
    }
    const ip = request.socket?.remoteAddress || 'unknown';
    let entry = failures.get(ip);
    if (entry?.expires <= time) { failures.delete(ip); entry = undefined; }
    if ((!entry && failures.size >= 10000) || (entry && entry.count >= 30)) {
      response.writeHead(429, { 'retry-after': String(Math.max(1, Math.ceil(((entry?.expires ?? time + 60000) - time) / 1000))), 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Demasiados intentos. Volvé a intentar en un minuto.');
      return false;
    }
    if (!entry) { entry = { count: 0, expires: time + 60000 }; failures.set(ip, entry); }
    entry.count++;
    return true;
  };
  const postLogin = async (request, response) => {
    const reject = (status, message) => {
      if (recordFailure(request, response)) {
        response.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
        response.end(message);
      }
      return false;
    };
    if ((request.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') return reject(415, 'Formato no admitido');
    if (Number(request.headers['content-length']) > loginBodyLimit) return reject(413, 'Formulario demasiado grande');
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > loginBodyLimit) return reject(413, 'Formulario demasiado grande');
        chunks.push(bytes);
      }
    } catch { return reject(400, 'Formulario inválido'); }
    const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const next = safeNext(form.get('next'));
    if (credentialsMatch(form.get('username') || '', form.get('password') || '')) {
      const payload = Buffer.from(JSON.stringify({ exp: now() + sessionSeconds * 1000 })).toString('base64url');
      gateRedirect(response, next, cookieHeader(`${payload}.${sign(payload)}`, sessionSeconds));
    } else if (recordFailure(request, response)) {
      loginPage(response, 401, next, 'Usuario o contraseña incorrectos');
    }
    return false;
  };
  return (request, response) => {
    let url;
    try { url = new URL(request.url || '/', 'http://localhost'); }
    catch {
      response.writeHead(400, { 'cache-control': 'no-store' }); response.end(); return false;
    }
    if (url.pathname === '/__logout' && request.method === 'GET') {
      gateRedirect(response, '/__login', cookieHeader('', 0));
      return false;
    }
    if (url.pathname === '/__login' && request.method === 'POST') return postLogin(request, response);
    const header = request.headers.authorization || '';
    const decoded = header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64').toString('utf8') : '';
    const separator = decoded.indexOf(':');
    const authorized = validCookie(request.headers.cookie) || (separator >= 0 && credentialsMatch(decoded.slice(0, separator), decoded.slice(separator + 1)));
    if (url.pathname === '/__login' || url.pathname === '/__logout') {
      if (request.method !== 'GET') {
        response.writeHead(405, { 'cache-control': 'no-store' }); response.end();
      } else if (authorized) gateRedirect(response, '/');
      else if (recordFailure(request, response)) loginPage(response, 200, url.searchParams.get('next'));
      return false;
    }
    if (authorized) return true;
    if (!recordFailure(request, response)) return false;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { pathname = url.pathname; }
    const acceptsHtml = (request.headers.accept || '').split(',').some(type => /^text\/html(?:;|$)/i.test(type.trim()) && !/;\s*q=0(?:\.0*)?(?:;|$)/i.test(type));
    const navigation = request.method === 'GET' && acceptsHtml && (!request.headers['sec-fetch-mode'] || request.headers['sec-fetch-mode'] === 'navigate') && !request.headers['x-requested-with'];
    const resource = pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/__') || pathname.startsWith('/assets/') || !!extname(pathname);
    if (navigation && !resource) loginPage(response, 401, request.url);
    else {
      response.writeHead(401, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Acceso restringido');
    }
    return false;
  };
}

export function createSpaHandler({ root = defaultRoot, fetchImpl = fetch, authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(), catalogApiBase = process.env.VITE_API_BASE_URL?.trim(), basicAuth = createBasicAuthGuard(), cspReportOnly = process.env.CSP_REPORT_ONLY === 'true' } = {}) {
  // Read release config once. Build origins win over runtime VITE_* values: the
  // browser bundle already contains them. Legacy builds retain runtime support.
  const csp = Promise.all([
    readFile(join(root, 'index.html'), 'utf8').catch(() => ''),
    readFile(join(root, 'csp-config.json'), 'utf8').then(JSON.parse).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return {};
    }),
  ]).then(([html, built]) => ({ config: { ...cspBuildConfig(process.env), ...built }, scriptHashes: inlineScriptHashes(html) }));
  return async (request, response) => {
    const policy = await csp;
    let firebaseHelper = false;
    // Merge at writeHead so headers cover errors, the basic-auth gate and proxies.
    const writeHead = response.writeHead.bind(response);
    response.writeHead = (status, headers = {}) => writeHead(status, { ...securityHeaders({ ...policy, reportOnly: cspReportOnly, firebaseHelper }), ...headers });
    if (!await basicAuth(request, response)) return;
    let url;
    try { url = new URL(request.url || '/', 'http://localhost'); }
    catch { response.writeHead(400, { 'cache-control': 'no-store' }); response.end(); return; }
    // Reserved gate routes never fall through, even when the gate is disabled.
    if (url.pathname === '/__login' || url.pathname === '/__logout') {
      response.writeHead(404, { 'cache-control': 'no-store' }); response.end(); return;
    }
    // Use the same normalized path as routing. A raw /__/auth/../../ must
    // never grant the helper's CSP exception to the application shell.
    firebaseHelper = url.pathname.startsWith('/__/auth/');
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
    const catalogMatch = requested.match(/^\/c\/([a-z0-9-]{1,160})\/?$/);
    if (catalogMatch) {
      let apiBase = catalogApiBase;
      if (!apiBase) {
        try { apiBase = JSON.parse(await readFile(join(root, 'catalog-config.json'), 'utf8')).apiBase; } catch { /* runtime config may be supplied instead */ }
      }
      let catalog = null;
      let status = 200;
      if (apiBase) {
        try {
          const upstream = await fetchImpl(`${apiBase.replace(/\/$/, '')}/api/public/catalog/${catalogMatch[1]}`, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' }, cache: 'no-store' });
          if (upstream.ok) catalog = await upstream.json();
          else status = upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 503;
        } catch { status = 503; }
      }
      const title = catalog ? `${catalog.store.name} · Lista de precios` : 'Catálogo no disponible · iManager';
      const description = catalog?.active ? `${catalog.items.length} equipos nuevos y usados, con condición y batería. Consultá por WhatsApp.` : 'Esta lista de precios no está disponible. Consultá con la tienda.';
      const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      // Host is only used as escaped metadata; never as a fetch destination.
      const forwardedProto = request.headers['x-forwarded-proto'];
      const protocol = forwardedProto === 'https' ? 'https' : request.socket.encrypted ? 'https' : 'http';
      const canonical = `${protocol}://${request.headers.host}${requested}`;
      const imageUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/api/public/catalog/${catalogMatch[1]}/preview.png` : '';
      const head = `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(imageUrl)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">${!catalog?.active ? '<meta name="robots" content="noindex">' : ''}`;
      const html = (await readFile(join(root, 'index.html'), 'utf8')).replace(/<title>[^<]*<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace('</head>', `${head}</head>`);
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : html);
      return;
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
