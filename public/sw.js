// Bump this on every deploy. Changing it is what makes the browser see sw.js as a new file, which
// is what puts a worker into the "waiting" state and raises the update screen (see update-prompt.js).
const CACHE_NAME = 'valk-cache-v224';
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
  // Deliberately NOT calling skipWaiting() here. A new worker has to sit in the "waiting" state so
  // update-prompt.js can detect it and offer the update screen — skipping straight to active would
  // apply updates silently mid-session and leave the button nothing to do.
});

// Sent by the green Update button. This is the only thing that promotes a waiting worker; the page
// then reloads on controllerchange, and the activate handler below clears the old caches.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  const pathname = new URL(request.url).pathname;
  const isStaticAsset = /\.(png|jpg|jpeg|webp|woff2?)$/.test(pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (!res.ok) return res; // don't let a transient error response get cached as if valid
        const copy = res.clone();
        // event.waitUntil keeps the worker alive until this settles — without it, the cache
        // write was fire-and-forget (respondWith's promise resolves with `res` immediately,
        // not waiting on the write), so the worker could terminate mid-write and silently drop
        // it, especially on a fast navigation right after the fetch. Correctness of what's
        // *served* was never affected, only whether the asset actually ends up cached for next
        // time / offline use.
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        return res;
      }))
    );
    return;
  }

  // Found by a service-worker cache security audit: this branch used to catch every OTHER
  // same-origin GET request with no further scoping — including personalized/authenticated JSON
  // API responses (/friends [social graph, including who's blocked], /admin/* [error stack
  // traces, moderation reports], /account/*, /auth/me). Cache Storage's match key is just the
  // request URL — the Authorization header isn't part of it — so those were written to
  // disk-backed cache unconditionally on every successful fetch, readable via DevTools/profile
  // filesystem access indefinitely, and (via the offline .catch fallback) servable back to a
  // LATER, possibly different, user of the same device with no check that it's even the same
  // account. Scoped to an ALLOWLIST of actual static app-shell file types (by extension, plus the
  // root path) rather than a denylist of "known personalized" path prefixes — a denylist needs
  // updating every time a new personalized route is added (exactly the "one route missed" bug
  // shape this app has hit repeatedly elsewhere), while an extension allowlist makes a brand-new
  // API route safe from caching by default, with nothing to remember.
  const isAppShellFile = pathname === '/' || /\.(html|js|css|json)$/.test(pathname);
  if (!isAppShellFile) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (!res.ok) return res;
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
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
        if ('focus' in client) {
          // Found by a push-notification correctness follow-up: this used to just focus() an
          // already-open tab and stop there — url (the actual room this notification is for) was
          // only ever used in the openWindow() fallback below, when NO tab was already open. The
          // much more common case — the app already open somewhere, in a different room or still
          // on the room-select screen — silently just brought that unrelated view to the front
          // with no navigation at all, the exact "roomCode is computed but never actually used"
          // bug. navigate() (a real WindowClient method, safe here since matchAll was scoped to
          // type:'window') triggers the same fresh page load app.js's own rejoinRoom URL-param
          // handling already reacts to on a normal navigation, so this reuses that existing
          // auto-rejoin path rather than needing any new client-side logic.
          if ('navigate' in client) return client.navigate(url).then((c) => c && c.focus());
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
