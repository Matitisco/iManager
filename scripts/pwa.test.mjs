import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServiceWorker, pwaPlugin } from './pwa.mjs';
import { createSpaHandler } from './serve-spa.mjs';

function worker(version = 'test') {
  const events = {};
  const stores = new Map();
  const fetched = [];
  let claimed = false;
  let forced = false;
  const caches = {
    open: async (key) => {
      if (!stores.has(key)) stores.set(key, new Map());
      const store = stores.get(key);
      return {
        addAll: async (assets) => assets.forEach((asset) => store.set(asset, `cached:${asset}`)),
        match: async (key) => store.get(key),
        put: async (key, value) => store.set(key, value),
      };
    },
    keys: async () => [...stores.keys()], delete: async (key) => stores.delete(key),
  };
  vm.runInNewContext(createServiceWorker(version, ['/', '/assets/app-hash.js'], ['/icons/icon-192.png']), {
    self: {
      location: { origin: 'https://app.test' }, addEventListener: (name, cb) => { events[name] = cb; },
      clients: { claim: async () => { claimed = true; } }, skipWaiting: () => { forced = true; },
    }, caches, URL, Set,
    fetch: async (request) => {
      fetched.push(request.url);
      return { ok: true, type: 'basic', headers: new Headers(), clone: () => 'network-static' };
    },
  });
  const lifecycle = async (name) => {
    let wait;
    events[name]({ waitUntil: (promise) => { wait = promise; } }); await wait;
  };
  const fetchEvent = (path, overrides = {}) => {
    let result;
    events.fetch({ request: { url: new URL(path, 'https://app.test').href, method: 'GET', headers: new Headers(), mode: 'cors', ...overrides },
      respondWith: (promise) => { result = promise; } });
    return result;
  };
  return { stores, fetched, lifecycle, fetchEvent, claimed: () => claimed, forced: () => forced };
}

test('worker precaches the atomic shell and never forces a running client to update', async () => {
  const sw = worker(); await sw.lifecycle('install');
  assert.deepEqual([...sw.stores.get('imanager-static-test').keys()], ['/', '/assets/app-hash.js']);
  assert.equal(sw.forced(), false);
  assert.equal(await sw.fetchEvent('/', { mode: 'navigate' }), 'cached:/');
  assert.equal(await sw.fetchEvent('/assets/app-hash.js'), 'cached:/assets/app-hash.js');
  assert.deepEqual(sw.fetched, []);
});
test('worker excludes API, session/auth, invite/action queries, cross-origin, POST and authenticated resources', async () => {
  const sw = worker(); await sw.lifecycle('install');
  for (const path of ['/api/me', '/api/inventory', '/__/auth/handler', '/__/auth/iframe', '/__/firebase/init.json', '/invite/secret', '/?mode=resetPassword&oobCode=secret', '/icons/icon-192.png?token=secret', 'https://firebase.test/token']) {
    assert.equal(sw.fetchEvent(path), undefined, path);
  }
  assert.equal(sw.fetchEvent('/assets/app-hash.js', { method: 'POST' }), undefined);
  assert.equal(sw.fetchEvent('/assets/app-hash.js', { headers: new Headers({ authorization: 'Bearer private' }) }), undefined);
  assert.deepEqual(sw.fetched, []);
});
test('worker caches only allowlisted public static assets on demand', async () => {
  const sw = worker(); await sw.lifecycle('install');
  await sw.fetchEvent('/icons/icon-192.png');
  assert.equal(await sw.fetchEvent('/icons/icon-192.png'), 'network-static');
  assert.equal(sw.fetched.length, 1);
  assert.equal(sw.fetchEvent('/unknown.png'), undefined);
});
test('activation clears only previous iManager static releases', async () => {
  const sw = worker();
  sw.stores.set('other-app-cache', new Map());
  sw.stores.set('imanager-static-old', new Map());
  await sw.lifecycle('install'); await sw.lifecycle('activate');
  assert.deepEqual([...sw.stores.keys()], ['other-app-cache', 'imanager-static-test']);
  assert.equal(sw.claimed(), true);
});
test('build plugin revisions include bundle contents and omit sourcemaps', () => {
  const emit = (code) => {
    let output;
    pwaPlugin().generateBundle.call({ emitFile: (file) => { output = file.source; } }, {}, {
      'index.html': { type: 'asset', source: '<html>shell</html>' },
      'assets/app.js': { type: 'chunk', code }, 'assets/app.js.map': { type: 'asset', source: '{}' },
    });
    return output;
  };
  assert.notEqual(emit('first'), emit('second'));
  assert.match(emit('first'), /"\/assets\/app.js"/);
  assert.doesNotMatch(emit('first'), /"\/assets\/app.js.map"/);
});

async function serve(path, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'imanager-pwa-test-'));
  try {
    await writeFile(join(root, 'index.html'), '<html>shell</html>');
    await writeFile(join(root, 'sw.js'), 'worker');
    await writeFile(join(root, 'manifest.webmanifest'), '{}');
    await mkdir(join(root, 'assets')); await writeFile(join(root, 'assets', 'app-hash.js'), 'bundle');
    let status; let headers; let body;
    const request = {
      url: path, method: options.method || 'GET', headers: options.headers || {},
      async *[Symbol.asyncIterator]() { if (options.body) yield Buffer.from(options.body); },
    };
    await createSpaHandler({ root, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) })(request, {
      writeHead: (s, h) => { status = s; headers = h; }, end: (b) => { body = b?.toString(); },
    });
    return { status, headers, body };
  } finally { await rm(root, { recursive: true }); }
}
test('server serves worker and manifest with correct types and update-safe headers', async () => {
  const sw = await serve('/sw.js');
  assert.equal(sw.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(sw.headers['cache-control'], 'no-store');
  assert.equal(sw.headers['service-worker-allowed'], '/');
  assert.equal((await serve('/manifest.webmanifest')).headers['content-type'], 'application/manifest+json; charset=utf-8');
  assert.equal((await serve('/assets/app-hash.js')).headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal((await serve('/')).headers['cache-control'], 'no-cache');
});
test('missing worker/assets/API/helper paths fail without a successful SPA fallback', async () => {
  for (const path of ['/missing.js', '/api/me', '/__/missing', '/assets/missing.js']) assert.equal((await serve(path)).status, 404);
  assert.equal((await serve('/invite/token')).body, '<html>shell</html>');
});
test('Firebase helper proxy preserves query, POST body and redirects without forwarding session secrets', async () => {
  const result = await serve('/__/auth/handler?providerId=google.com&eventId=123', {
    method: 'POST', body: 'state=return', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'app-session=private', authorization: 'private' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://gen-lang-client-0137016082.firebaseapp.com/__/auth/handler?providerId=google.com&eventId=123');
      assert.equal(options.method, 'POST'); assert.equal(options.body.toString(), 'state=return');
      assert.equal(options.headers.cookie, undefined); assert.equal(options.headers.authorization, undefined);
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/auth' } });
    },
  });
  assert.equal(result.status, 302); assert.equal(result.headers['location'], 'https://accounts.google.com/auth');
  assert.equal(result.headers['cache-control'], 'no-store');
});
test('Firebase helper failure is visible and never returns the SPA', async () => {
  const result = await serve('/__/auth/iframe', { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.status, 502); assert.match(result.body, /Firebase/);
});
test('manifest and Apple metadata point to existing images of the declared dimensions', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.id, '/');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'any' && icon.sizes === '512x512'));
  for (const icon of manifest.icons) {
    const png = await readFile(join('public', icon.src));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /viewport-fit=cover/); assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  const launches = [...html.matchAll(/href="(\/splash\/splash-(\d+)x(\d+)\.png)"/g)];
  assert.equal(launches.length, 26);
  for (const [, path, w, h] of launches) {
    const png = await readFile(join('public', path));
    assert.equal(png.readUInt32BE(16), Number(w)); assert.equal(png.readUInt32BE(20), Number(h));
  }
});
