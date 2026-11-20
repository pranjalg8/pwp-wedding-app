// The build replaces __BUILD_ID__ (see swVersion in vite.config.ts), so every deploy gets a fresh cache.
const VERSION = '__BUILD_ID__';
const CACHE = `pwp-shell-${VERSION}`;
const PREFIX = 'pwp-shell-';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png'];

// Resolved against the service worker's own folder (the app's base path).
const scopePath = new URL('./', self.location.href).pathname;
const assetsPath = `${scopePath}assets/`;
const shellPaths = new Set(SHELL.map((p) => new URL(p, self.location.href).pathname));

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so the new version never stores a stale index.html
  // (which would point at the previous build's files) as its offline shell.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))));
  self.skipWaiting();
});

// Clear caches from older versions, then take over open tabs (the app then offers a reload).
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./')));
    return;
  }

  // Built files have a content hash in their name, so a cached copy is always right: cache first.
  // The shell files (manifest, icon) are cached the same way and refreshed with each new version.
  if (url.pathname.startsWith(assetsPath) || shellPaths.has(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
  }
  // Everything else (large photos under cards/, honeymoon/ and the like) goes to the network and the
  // browser's normal HTTP cache, so it does not fill up the app's storage.
});
