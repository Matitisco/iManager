import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpaHandler } from './serve-spa.mjs';

test('actual SPA host sends security headers on shell, helpers and errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'headers-security-'));
  await writeFile(join(root, 'index.html'), '<html>shell</html>');
  const server = createServer(createSpaHandler({ root, basicAuth: () => true,
    fetchImpl: async () => new Response('<html>Firebase helper</html>', { headers: { 'content-type': 'text/html' } }) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/missing.js', '/api/me', '/__/auth/iframe', '/bad%escape']) {
      const response = await fetch(base + path);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors/);
      assert.match(response.headers.get('permissions-policy'), /camera=\(self\)/);
      assert.equal(response.headers.get('x-powered-by'), null);
      if (path.startsWith('/__/auth/')) {
        assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.equal(response.headers.get('cache-control'), 'no-store');
      } else assert.equal(response.headers.get('x-frame-options'), 'DENY');
    }
  } finally { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); }
});

// The landing deploy has its own Railway service root; test that executable too.
async function withLanding(run) {
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['landing/serve.mjs'], {
    env: { PATH: process.env.PATH, PORT: String(port), NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'ignore'],
  });
  try {
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Landing exited before listening'); })]);
    await run(`http://127.0.0.1:${port}`);
  } finally {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
  }
}

test('landing also protects 404/405 responses and HTTPS transport', () => withLanding(async base => {
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${base}/security-probe-missing.js`, { method });
    assert.equal(response.status, method === 'GET' ? 404 : 405);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('strict-transport-security'), /max-age=31536000/);
  }
}));

test('malformed percent encoding cannot terminate the landing process', () => withLanding(async base => {
  const malformed = await fetch(`${base}/bad%escape`);
  assert.equal(malformed.status, 404);
  assert.equal((await fetch(`${base}/security-probe-missing.js`)).status, 404);
}));
