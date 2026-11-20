/* Service Worker - SaaS Spend Track PWA
 * Minimal: cache the app shell, serve stale-while-revalidate for
 * the one index.html file (everything else is inlined into it).
 *
 * The app is already browser-only with localStorage persistence,
 * so this SW mostly exists to make the app installable and work
 * offline after the first load.
 *
 * Bumping CACHE_VERSION invalidates the old cache on next load.
 */

const CACHE_VERSION = 'sst-v1-2026-11-15';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't cache cross-origin (Google Fonts, Apps Script, Frankfurter, CDNs)
  // - let the browser handle them normally. Only cache same-origin.
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate for the app shell.
  event.respondWith(
    caches.open(CACHE_VERSION).then(async cache => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);  // fall back to cache if offline
      return cached || fetchPromise;
    })
  );
});
