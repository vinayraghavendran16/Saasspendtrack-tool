/* SaaS Spend Track: authenticated application must never serve cached data. */
const CACHE_VERSION = 'sst-static-v2-2026-11-26';
const STATIC_PATHS = new Set(['/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png']);

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('sst-') && key !== CACHE_VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || req.method !== 'GET') return;
  // Never intercept or cache application data, auth callbacks, or navigation.
  if (req.mode === 'navigate' || url.search || !STATIC_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req);
    if (cached) return cached;
    const response = await fetch(req);
    if (response.ok && !response.redirected && response.type === 'basic' &&
        /^(image\/|application\/(manifest\+json|json))/.test(response.headers.get('content-type') || '')) {
      await cache.put(req, response.clone());
    }
    return response;
  })());
});
