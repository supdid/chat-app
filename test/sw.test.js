// Regression coverage for public/sw.js's fetch-handler caching scope — found by a service-worker
// cache security audit: the fetch handler used to write EVERY same-origin GET response into
// Cache Storage with no scoping, including personalized/authenticated JSON API responses
// (/friends, /admin/*, /account/*, /auth/me), keyed only by URL (Authorization headers aren't
// part of the Cache Storage key). Fixed with an allowlist of actual static app-shell file types.
//
// There's no browser/ServiceWorkerGlobalScope in this test environment, and this app's whole
// test suite (server.test.js) is otherwise 100% server-focused — this is the one piece of
// genuinely client-only logic this session judged worth real executable coverage for, given the
// severity of what it protects. Rather than re-typing the caching decision as a duplicate,
// simpler copy (which could silently drift from the real file), this loads and evaluates the
// REAL public/sw.js source in a minimal mocked ServiceWorkerGlobalScope (self/caches/fetch) via
// Node's vm module, then drives its actual registered 'fetch' listener with real Request objects
// (Node 18+ provides Request/Response/URL as real globals, not mocked) and observes whether the
// mocked cache's put() was called.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadServiceWorkerFetchListener(fetchImpl) {
  const listeners = {};
  const cachePutUrls = [];
  const cacheStore = {
    put: async (request) => { cachePutUrls.push(typeof request === 'string' ? request : request.url); },
    match: async () => undefined,
  };
  const sandbox = {
    self: {
      location: { origin: 'https://valk.example' },
      addEventListener: (type, handler) => { listeners[type] = handler; },
      clients: { claim: () => {} },
      registration: {},
    },
    caches: {
      open: async () => cacheStore,
      match: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    },
    fetch: fetchImpl,
    URL,
    console,
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  vm.runInContext(code, sandbox);
  return { fetchListener: listeners.fetch, cachePutUrls };
}

// A minimal FetchEvent stand-in — real Request objects (Node 18+ global), but respondWith/
// waitUntil just collect promises the way the real event does, so the test can await them.
function makeFetchEvent(url, method = 'GET') {
  const waitUntilPromises = [];
  let respondWithPromise = null;
  return {
    request: new Request(url, { method }),
    respondWith(p) { respondWithPromise = p; },
    waitUntil(p) { waitUntilPromises.push(p); },
    async settle() {
      const result = await respondWithPromise;
      await Promise.all(waitUntilPromises);
      return result;
    },
  };
}

describe('service worker fetch handler caching scope', () => {
  test('a personalized/authenticated API response is never written to Cache Storage', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ friends: ['secret'] }), { status: 200 });
    const { fetchListener, cachePutUrls } = loadServiceWorkerFetchListener(fetchImpl);

    for (const url of [
      'https://valk.example/friends',
      'https://valk.example/friends/presence',
      'https://valk.example/admin/errors',
      'https://valk.example/admin/reports',
      'https://valk.example/account/recent-rooms',
      'https://valk.example/auth/me',
      'https://valk.example/api/scorpture/subscriptions/feed',
    ]) {
      const event = makeFetchEvent(url);
      fetchListener(event);
      await event.settle();
    }

    assert.deepEqual(cachePutUrls, [], 'no personalized/API endpoint should ever be written to Cache Storage');
  });

  test('actual static app-shell files are still cached (the fix must not break offline support)', async () => {
    const fetchImpl = async () => new Response('body', { status: 200 });
    const { fetchListener, cachePutUrls } = loadServiceWorkerFetchListener(fetchImpl);

    for (const url of [
      'https://valk.example/',
      'https://valk.example/app.js',
      'https://valk.example/style.css',
      'https://valk.example/manifest.json',
      'https://valk.example/images/icon-192.png',
    ]) {
      const event = makeFetchEvent(url);
      fetchListener(event);
      await event.settle();
    }

    assert.equal(cachePutUrls.length, 5, 'every static app-shell file must still be cached, same as before the fix');
  });

  test('an error response is never cached, personalized or not', async () => {
    const fetchImpl = async () => new Response('server error', { status: 500 });
    const { fetchListener, cachePutUrls } = loadServiceWorkerFetchListener(fetchImpl);

    const event = makeFetchEvent('https://valk.example/app.js');
    fetchListener(event);
    await event.settle();

    assert.deepEqual(cachePutUrls, [], 'a non-OK response must never be cached as if it were valid');
  });

  test('non-GET requests are never intercepted (mutation calls must reach the network untouched)', async () => {
    let fetchCalled = false;
    const fetchImpl = async () => { fetchCalled = true; return new Response('{}', { status: 200 }); };
    const { fetchListener, cachePutUrls } = loadServiceWorkerFetchListener(fetchImpl);

    const event = makeFetchEvent('https://valk.example/account/password', 'POST');
    const result = fetchListener(event);
    // The real handler returns undefined (falls through, no respondWith call) for non-GET —
    // confirm nothing was intercepted at all, not just that nothing was cached.
    assert.equal(result, undefined);
    assert.equal(fetchCalled, false, 'the mocked fetch must never be invoked by the SW itself for a non-GET request');
    assert.deepEqual(cachePutUrls, []);
  });
});
