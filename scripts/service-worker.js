/* Built by scripts/pwa.mjs. Cache only release assets; never API/auth/session. */
const CACHE = 'imanager-static-' + __CACHE_VERSION__;
const PRECACHE = __PRECACHE__;
const STATIC_ASSETS = __STATIC_ASSETS__;
const ALLOWED = new Set([...PRECACHE, ...STATIC_ASSETS]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('imanager-static-') && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/') || url.pathname === '/version.json' || url.search) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !ALLOWED.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = navigation ? '/' : url.pathname;
    if (navigation) {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic' && !response.headers.has('set-cookie')) {
          await cache.put(key, response.clone());
          return response;
        }
        const fallback = await cache.match(key);
        return fallback || response;
      } catch (error) {
        const fallback = await cache.match(key);
        if (fallback) return fallback;
        throw error;
      }
    }
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && !response.headers.has('set-cookie')) {
      await cache.put(key, response.clone());
    }
    return response;
  })());
});
