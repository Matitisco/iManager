import { test } from 'node:test';
import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpaHandler, createBasicAuthGuard } from './serve-spa.mjs';

async function request(basicAuth, authorization, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'basic-auth-'));
  await writeFile(join(root, 'index.html'), '<html><body>app</body></html>');
  const result = {};
  const response = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = body; } };
  try {
    const incoming = Readable.from(options.chunks || (options.body === undefined ? [] : [Buffer.from(options.body)]));
    Object.assign(incoming, { url: options.url || '/', method: options.method || 'GET', headers: { ...(authorization ? { authorization } : {}), ...options.headers }, socket: { remoteAddress: options.ip || '192.0.2.1' } });
    await createSpaHandler({ root, basicAuth, cspReportOnly: false, fetchImpl: async () => { assert.fail('unauthorized request reached upstream'); } })(incoming, response);
    return result;
  } finally { await rm(root, { recursive: true, force: true }); }
}
const encode = (value) => `Basic ${Buffer.from(value).toString('base64')}`;

test('without BASIC_AUTH variables the app is served openly', async () => {
  const result = await request(createBasicAuthGuard({ user: '', pass: '' }));
  assert.equal(result.status, 200);
});
test('with credentials configured, requests without or with wrong credentials get 401', async () => {
  const guard = createBasicAuthGuard({ user: 'qa', pass: 'secret:with:colons' });
  const missing = await request(guard);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers['www-authenticate'], undefined);
  assert.equal(missing.body, 'Acceso restringido');
  assert.equal((await request(guard, encode('qa:nope'))).status, 401);
  assert.equal((await request(guard, encode('other:secret:with:colons'))).status, 401);
  assert.equal((await request(guard, 'Bearer abc')).status, 401);
});
test('with credentials configured, correct credentials serve the app', async () => {
  const guard = createBasicAuthGuard({ user: 'qa', pass: 'secret:with:colons' });
  assert.equal((await request(guard, encode('qa:secret:with:colons'))).status, 200);
});

test('partial Basic Auth configuration fails closed', () => {
  assert.throws(() => createBasicAuthGuard({ user: 'qa', pass: '' }), /BASIC_AUTH/);
  assert.throws(() => createBasicAuthGuard({ user: '', pass: 'fixture-only' }), /BASIC_AUTH/);
});

test('throttles failed Basic Auth guesses by socket IP while valid users behind the same NAT still enter', () => {
  let now = 0;
  const guard = createBasicAuthGuard({ user: 'qa', pass: 'fixture-only', now: () => now });
  const attempt = (authorization, ip = '192.0.2.1', forwarded = '198.51.100.1') => {
    const result = {};
    guard({ headers: { authorization, 'x-forwarded-for': forwarded }, socket: { remoteAddress: ip } }, {
      writeHead(status, headers) { result.status = status; result.headers = headers; }, end() {},
    });
    return result;
  };
  for (let n = 0; n < 30; n++) assert.equal(attempt(encode('qa:wrong'), undefined, `198.51.100.${n + 1}`).status, 401);
  assert.equal(attempt(encode('qa:wrong')).status, 429);
  assert.equal(attempt(encode('qa:wrong')).headers['retry-after'], '60');
  assert.equal(attempt(encode('qa:fixture-only')).status, undefined);
  assert.equal(attempt(encode('qa:wrong'), '192.0.2.2').status, 401);
  now = 60_000;
  assert.equal(attempt(encode('qa:wrong')).status, 401);
});

// All credentials here are synthetic fixtures, unrelated to deployed credentials.
const makeGuard = options => createBasicAuthGuard({ user: 'qa', pass: 'fixture-only', ...options });
const post = (guard, fields = {}, options = {}) => request(guard, undefined, {
  url: '/__login', method: 'POST', body: new URLSearchParams({ username: 'qa', password: 'fixture-only', next: '/inventory?tab=all', ...fields }).toString(),
  ...options, headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', ...options.headers },
});
const getCookie = result => result.headers['set-cookie'].split(';')[0];

test('HTML navigation gets a Spanish form with escaped next, no scripts or Basic challenge, and CSP', async () => {
  const result = await request(makeGuard(), undefined, { url: '/inventory?q="<tag>&x=1', headers: { accept: 'text/html,application/xhtml+xml' } });
  assert.equal(result.status, 401);
  assert.equal(result.headers['www-authenticate'], undefined);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.match(result.headers['content-type'], /^text\/html/);
  assert.match(result.body, /<html lang="es">/);
  assert.match(result.body, /<form method="post" action="\/__login">/);
  assert.match(result.body, /<input[^>]*name="username"/);
  assert.match(result.body, /<input[^>]*type="password"[^>]*name="password"/);
  assert.match(result.body, /name="next" value="\/inventory\?q=&quot;&lt;tag&gt;&amp;x=1"/);
  assert.match(result.body, />Ingresar<\/button>/);
  assert.doesNotMatch(result.body, /<script\b|<tag>/i);
  assert.match(result.headers['content-security-policy'], /style-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(result.headers['content-security-policy'].match(/script-src [^;]+/)[0], /'unsafe-inline'/);
});

test('explicit login is 200 without session and redirects authenticated sessions to root', async () => {
  const guard = makeGuard();
  const open = await request(guard, undefined, { url: '/__login?next=%2Finventory' });
  assert.equal(open.status, 200);
  assert.equal(open.headers['cache-control'], 'no-store');
  assert.match(open.body, /name="next" value="\/inventory"/);
  const cookie = getCookie(await post(guard));
  for (const headers of [{ cookie }, { authorization: encode('qa:fixture-only') }]) {
    const result = await request(guard, undefined, { url: '/__login', headers });
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, '/');
    assert.equal(result.headers['cache-control'], 'no-store');
  }
});

test('correct POST redirects and issues a secure 30-day cookie that serves the app', async () => {
  const guard = makeGuard();
  const result = await post(guard);
  assert.equal(result.status, 303);
  assert.equal(result.headers.location, '/inventory?tab=all');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.match(result.headers['set-cookie'], /^imanager_test_session=[\w-]+\.[\w-]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);
  const app = await request(guard, undefined, { headers: { cookie: `other=1; ${getCookie(result)}; another=2` } });
  assert.equal(app.status, 200);
  assert.match(app.body.toString(), />app</);
});

test('tampered, malformed, expired and other-key cookies cannot serve the app', async () => {
  let now = 1000;
  const guard = makeGuard({ now: () => now });
  const cookie = getCookie(await post(guard));
  const [name, token] = cookie.split('=');
  const [payload, signature] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ exp: 9999999999999 })).toString('base64url');
  const otherPass = getCookie(await post(makeGuard({ pass: 'other-fixture' }), { password: 'other-fixture' }));
  const otherUser = getCookie(await post(makeGuard({ user: 'other-user' }), { username: 'other-user' }));
  for (const invalid of [
    `${name}=${tamperedPayload}.${signature}`, `${name}=${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`,
    `${name}=bad`, `${name}=a.b.extra`, otherPass, otherUser,
  ]) {
    const result = await request(guard, undefined, { headers: { cookie: invalid, accept: 'text/html' } });
    assert.equal(result.status, 401);
    assert.match(result.body, /name="username"/);
  }
  now += 2592000 * 1000 - 1;
  assert.equal((await request(guard, undefined, { headers: { cookie } })).status, 200);
  now++;
  assert.equal((await request(guard, undefined, { headers: { cookie, accept: 'text/html' } })).status, 401);
});

test('wrong POST is 401, creates no cookie and never reflects submitted credentials', async () => {
  for (const fields of [{ password: '<invalid-password>' }, { username: '<invalid-user>' }, { username: '', password: '' }]) {
    const result = await post(makeGuard(), fields);
    assert.equal(result.status, 401);
    assert.match(result.body, /Usuario o contraseña incorrectos/);
    assert.doesNotMatch(result.body, /invalid-password|invalid-user|fixture-only/);
    assert.equal(result.headers['set-cookie'], undefined);
    assert.equal(result.headers['www-authenticate'], undefined);
    assert.equal(result.headers['cache-control'], 'no-store');
  }
});

test('next only redirects to internal paths, including after failed login', async () => {
  for (const next of ['//evil.com', 'https://evil.com', '/\\evil', '/%5cevil', '/%2fevil', '/\r\nevil', '/%0aevil', 'relative', '']) {
    const guard = makeGuard();
    const result = await post(guard, { next });
    assert.equal(result.headers.location, '/');
    const failed = await post(guard, { next, password: 'wrong' });
    assert.match(failed.body, /name="next" value="\/"/);
  }
});

test('all protected resources and non-navigation requests get plain 401, never SPA or proxy', async () => {
  const guard = makeGuard();
  for (const url of ['/api/', '/api/me', '/api', '/sw.js', '/version.json', '/assets/app.js', '/assets/no-extension', '/__/auth/handler', '/__/auth/iframe', '/__/firebase/init.json', '/__/other']) {
    const result = await request(guard, undefined, { url, headers: { accept: 'text/html' } });
    assert.equal(result.status, 401, url);
    assert.equal(result.body, 'Acceso restringido', url);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.match(result.headers['content-type'], /^text\/plain/);
    assert.equal(result.headers['www-authenticate'], undefined);
  }
  const catalog = await request(guard, undefined, { url: '/c/shop', headers: { accept: 'text/html' } });
  assert.equal(catalog.status, 401);
  assert.match(catalog.body, /name="username"/);
  for (const options of [
    {}, { method: 'HEAD', headers: { accept: 'text/html' } }, { method: 'POST', headers: { accept: 'text/html' } },
    { headers: { accept: 'text/html', 'sec-fetch-mode': 'cors' } },
    { headers: { accept: 'text/html', 'x-requested-with': 'XMLHttpRequest' } }, { headers: { accept: 'application/json' } },
  ]) {
    const result = await request(guard, undefined, options);
    assert.equal(result.status, 401);
    assert.equal(result.body, 'Acceso restringido');
  }
});

test('POST failures share socket-IP throttling with Basic and expire after a minute', async () => {
  let now = 0;
  const guard = makeGuard({ now: () => now });
  for (let n = 0; n < 30; n++) {
    assert.equal((await post(guard, { password: 'wrong' }, { headers: { 'x-forwarded-for': `198.51.100.${n + 1}` } })).status, 401);
  }
  const denied = await post(guard, { password: 'wrong' });
  assert.equal(denied.status, 429);
  assert.equal(denied.headers['retry-after'], '60');
  assert.equal(denied.headers['cache-control'], 'no-store');
  assert.equal((await request(guard, encode('qa:wrong'))).status, 429);
  assert.equal((await request(guard, encode('qa:fixture-only'))).status, 200);
  const cookie = getCookie(await post(guard));
  assert.equal((await request(guard, undefined, { headers: { cookie } })).status, 200);
  assert.equal((await post(guard, { password: 'wrong' }, { ip: '192.0.2.2' })).status, 401);
  now = 60000;
  assert.equal((await post(guard, { password: 'wrong' })).status, 401);
});

test('login rejects wrong media type and bodies over 8 KB, including chunked bodies', async () => {
  const guard = makeGuard();
  for (const [options, status] of [
    [{ headers: { 'content-type': 'application/json' } }, 415],
    [{ headers: { 'content-length': '8193' } }, 413],
    [{ chunks: [Buffer.alloc(4096), Buffer.alloc(4097)] }, 413],
  ]) {
    const result = await post(guard, {}, options);
    assert.equal(result.status, status);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['set-cookie'], undefined);
  }
  const form = new URLSearchParams({ username: 'qa', password: 'fixture-only' }).toString();
  assert.equal((await post(guard, {}, { body: form + '&pad=' + 'x'.repeat(8192 - form.length - 5) })).status, 303);
});

test('logout expires cookie and reserved routes never fall through to the SPA', async () => {
  const guard = makeGuard();
  const result = await request(guard, undefined, { url: '/__logout', headers: { cookie: getCookie(await post(guard)) } });
  assert.equal(result.status, 303);
  assert.equal(result.headers.location, '/__login');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['set-cookie'], 'imanager_test_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  for (const method of ['PUT', 'HEAD', 'DELETE']) {
    const invalid = await request(guard, undefined, { url: '/__login', method });
    assert.equal(invalid.status, 405);
    assert.equal(invalid.headers['cache-control'], 'no-store');
  }
  for (const url of ['/__login', '/__logout']) assert.equal((await request(createBasicAuthGuard({ user: '', pass: '' }), undefined, { url })).status, 404);
});

test('HTTP server awaits form handling before serving files, including oversized requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'login-http-'));
  await writeFile(join(root, 'index.html'), '<html><body>app</body></html>');
  const server = createServer(createSpaHandler({ root, basicAuth: makeGuard() }));
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/__login`, { method: 'POST', body: new URLSearchParams({ username: 'qa', password: 'fixture-only', next: '/inventory' }), redirect: 'manual' });
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/inventory');
    const app = await fetch(base, { headers: { cookie: login.headers.get('set-cookie').split(';')[0] } });
    assert.equal(app.status, 200);
    assert.match(await app.text(), />app</);
    const oversized = await fetch(`${base}/__login`, { method: 'POST', body: 'x'.repeat(8193), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(oversized.status, 413);
    await oversized.text();
    const chunked = await fetch(`${base}/__login`, {
      method: 'POST', body: Readable.from([Buffer.alloc(4096), Buffer.alloc(4097)]), duplex: 'half',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(chunked.status, 413);
    await chunked.text();
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
