import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpaHandler, createBasicAuthGuard } from './serve-spa.mjs';

async function request(basicAuth, authorization) {
  const root = await mkdtemp(join(tmpdir(), 'basic-auth-'));
  await writeFile(join(root, 'index.html'), '<html><body>app</body></html>');
  const result = {};
  const response = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = body; } };
  try {
    await createSpaHandler({ root, basicAuth })({ url: '/', method: 'GET', headers: authorization ? { authorization } : {}, socket: {} }, response);
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
  assert.match(missing.headers['www-authenticate'], /^Basic /);
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
