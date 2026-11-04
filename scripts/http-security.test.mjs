import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpaHandler } from './serve-spa.mjs';
import { cspBuildConfig, cspPlugin, contentSecurityPolicy, inlineScriptHashes, securityHeaders } from './security-headers.mjs';

const directives = policy => Object.fromEntries(policy.split(';').map(part => {
  const [name, ...sources] = part.trim().split(/\s+/); return [name, sources];
}));

test('build emits public origins without copying keys or credentials', () => {
  let asset;
  cspPlugin({ VITE_API_BASE_URL: 'https://api.example/api', VITE_POSTHOG_HOST: 'https://metrics.example', VITE_POSTHOG_KEY: 'fixture-project', PRIVATE_KEY: 'fixture-private' }).generateBundle.call({ emitFile(value) { asset = value; } });
  assert.equal(asset.fileName, 'csp-config.json');
  assert.deepEqual(JSON.parse(asset.source), { apiOrigin: 'https://api.example', posthogOrigin: 'https://metrics.example' });
  assert.ok(!asset.source.includes('fixture-'));
});

test('CSP protects scripts while allowing Firebase, Google, PostHog, styles and PWA', () => {
  const d = directives(contentSecurityPolicy());
  assert.deepEqual(d['default-src'], ["'self'"]);
  assert.deepEqual(d['script-src-attr'], ["'none'"]);
  assert.ok(!d['script-src'].includes("'unsafe-inline'"));
  assert.ok(!d['script-src'].includes("'unsafe-eval'"));
  for (const source of ['https://apis.google.com', 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://accounts.google.com', 'https://us-assets.i.posthog.com', 'https://eu-assets.i.posthog.com']) assert.ok(d['script-src'].includes(source), source);
  for (const source of ['https://*.googleapis.com', 'https://us.i.posthog.com', 'https://eu.i.posthog.com', 'wss://*.firebaseio.com']) assert.ok(d['connect-src'].includes(source), source);
  assert.ok(d['frame-src'].includes('https://*.firebaseapp.com'));
  assert.ok(d['frame-src'].includes('https://accounts.google.com'));
  assert.deepEqual(d['worker-src'], ["'self'", 'blob:']);
  assert.deepEqual(d['manifest-src'], ["'self'"]);
  assert.ok(d['style-src'].includes("'unsafe-inline'"));
  assert.ok(d['style-src'].includes('https://fonts.googleapis.com'));
  assert.ok(d['font-src'].includes('https://fonts.gstatic.com'));
  for (const source of ['data:', 'blob:']) assert.ok(d['img-src'].includes(source));
});

test('CSP derives exact configured API, PostHog proxy and Firebase origins for each deployment', () => {
  for (const api of ['https://api-prod.example', 'https://api-test.example', 'http://127.0.0.1:37549']) {
    const config = cspBuildConfig({ VITE_API_BASE_URL: `${api}/`, VITE_POSTHOG_HOST: 'https://analytics.example/ingest', VITE_FIREBASE_AUTH_DOMAIN: 'login.example' });
    const d = directives(contentSecurityPolicy({ config }));
    assert.ok(d['connect-src'].includes(api));
    assert.ok(d['script-src'].includes('https://analytics.example'));
    assert.ok(d['connect-src'].includes('https://analytics.example'));
    assert.ok(d['frame-src'].includes('https://login.example'));
    assert.ok(!Object.values(d).flat().includes('*'));
  }
  for (const value of ['https://user:pass@api.example', 'data:bad', 'https://api.example; script-src *']) assert.throws(() => cspBuildConfig({ VITE_API_BASE_URL: value }));
});

test('rollback env moves the complete policy to report-only while preserving base restrictions', () => {
  const previous = process.env.CSP_REPORT_ONLY;
  try {
    delete process.env.CSP_REPORT_ONLY;
    assert.ok(securityHeaders()['content-security-policy'].includes("default-src 'self'"));
    assert.equal(securityHeaders()['content-security-policy-report-only'], undefined);
    process.env.CSP_REPORT_ONLY = 'true';
    assert.equal(securityHeaders()['content-security-policy'], "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
    assert.ok(securityHeaders()['content-security-policy-report-only'].includes("default-src 'self'"));
    assert.equal(securityHeaders({ firebaseHelper: true })['content-security-policy-report-only'], undefined);
    assert.equal(securityHeaders({ firebaseHelper: true })['content-security-policy'], "base-uri 'self'; object-src 'none'; frame-ancestors 'self'");
  } finally {
    if (previous === undefined) delete process.env.CSP_REPORT_ONLY; else process.env.CSP_REPORT_ONLY = previous;
  }
});

test('real SPA host hashes trusted bootstrap and uses build-time origins even without runtime VITE variables', async () => {
  const root = await mkdtemp(join(tmpdir(), 'csp-release-'));
  const html = '<html><script>window.booted = true;</script><script src="/app.js"></script></html>';
  await writeFile(join(root, 'index.html'), html);
  await writeFile(join(root, 'csp-config.json'), JSON.stringify(cspBuildConfig({ VITE_API_BASE_URL: 'https://test-api.example', VITE_POSTHOG_HOST: 'https://test-analytics.example' })));
  const server = createServer(createSpaHandler({ root, basicAuth: () => true, cspReportOnly: false }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const path of ['/', '/deep/link', '/missing.js', '/c/catalog-qa']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
      const d = directives(response.headers.get('content-security-policy'));
      assert.ok(d['connect-src'].includes('https://test-api.example'));
      assert.ok(d['script-src'].includes('https://test-analytics.example'));
      assert.equal(inlineScriptHashes(html).length, 1);
      assert.ok(d['script-src'].includes(inlineScriptHashes(html)[0]));
      assert.equal(response.headers.get('content-security-policy-report-only'), null);
    }
  } finally { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); }
});

test('normalized helper traversal cannot remove the shell enforcing CSP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'csp-helper-'));
  await writeFile(join(root, 'index.html'), '<html>shell</html>');
  try {
    for (const url of ['/__/auth/../../', '/__/auth/%2e%2e/%2e%2e/']) {
      const response = { writeHead(_status, headers) { this.headers = headers; }, end() {} };
      await createSpaHandler({ root, basicAuth: () => true, cspReportOnly: false })({ url, method: 'GET', headers: {} }, response);
      assert.ok(response.headers['content-security-policy'].includes("default-src 'self'"));
      assert.equal(response.headers['x-frame-options'], 'DENY');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

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

async function rawStatus(base, path) {
  const { request } = await import('node:http');
  return new Promise((resolve, reject) => {
    const req = request(base, { path }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
}

test('invalid raw URL targets cannot reject the SPA handler', async () => {
  const response = { writeHead(status) { this.status = status; }, end() {} };
  await createSpaHandler({ basicAuth: () => true })({ url: '//[bad', method: 'GET', headers: {} }, response);
  assert.equal(response.status, 400);
});

test('invalid raw URL targets cannot terminate the landing process', () => withLanding(async base => {
  assert.equal(await rawStatus(base, '//[bad'), 400);
  assert.equal(await rawStatus(base, '/security-probe-missing.js'), 404);
}));
