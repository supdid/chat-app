const CACHE_NAME = 'valk-cache-v88';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/images/logo.png',
  '/images/background.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Images/fonts are cache-first for fast repeat loads. HTML/JS/CSS are network-first so active
// changes to the app show up immediately, falling back to cache only when offline — this app is
// being actively developed, so a stale cached stylesheet would be worse than no offline support
// at all (a mismatched HTML/CSS pair can break the page instead of just looking outdated).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  const isStaticAsset = /\.(png|jpg|jpeg|webp|woff2?)$/.test(new URL(request.url).pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// Real OS/browser push — fires even when no Valk tab is open, unlike the in-tab
// Notification API the page itself uses while it's running.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* non-JSON payload, ignore */ }
  const title = data.title || 'Valk';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      tag: data.roomCode || 'valk',
      data: { roomCode: data.roomCode || null },
    })
  );
});

// Focuses an already-open Valk tab instead of always opening a new one — most people
// clicking this already have the app open somewhere.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const roomCode = event.notification.data && event.notification.data.roomCode;
  const url = roomCode ? `/?room=${encodeURIComponent(roomCode)}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
