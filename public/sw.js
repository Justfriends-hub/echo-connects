// ─── Chirp Service Worker ───────────────────────────────────────────────────
// Bump CACHE_VERSION on each deploy to bust stale caches.
const CACHE_VERSION = 'chirp-v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// App shell files to precache on install.
// These are the bare minimum needed to render the offline fallback.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// ─── Install: precache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  // Activate immediately without waiting for existing clients to close.
  self.skipWaiting();
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open clients immediately.
  self.clients.claim();
});

// ─── Fetch strategies ───────────────────────────────────────────────────────

/**
 * Decide which caching strategy to use based on the request.
 *
 * 1. Non-GET requests        → network-only (never cache POSTs, PUTs, etc.)
 * 2. Supabase API / auth     → network-only (no caching of API data or tokens)
 * 3. Navigation requests     → network-first with offline fallback to cached shell
 * 4. Hashed static assets    → stale-while-revalidate (serve from cache, update in bg)
 * 5. Other static assets     → cache-first
 * 6. Everything else         → network-first
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache non-GET requests (messages, auth, mutations)
  if (request.method !== 'GET') {
    return; // Let the browser handle it normally
  }

  // 2. Never cache Supabase API calls or any external API
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/realtime/')
  ) {
    return; // Network-only — don't intercept
  }

  // 3. Navigation requests → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 4. Hashed static assets (Vite outputs like /assets/index-abc123.js)
  //    → stale-while-revalidate so they're in the SW cache
  if (isHashedAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 5. Other static assets (images, fonts, icons)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 6. Everything else → network-first
  event.respondWith(networkFirst(request));
});

// ─── Strategy implementations ───────────────────────────────────────────────

/**
 * Network-first for navigation with offline fallback to the cached shell.
 * This ensures the SPA always gets the latest HTML, but loads offline too.
 */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Cache the successful navigation response for offline fallback
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline — serve cached shell (SPA will handle routing client-side)
    const cached = await caches.match('/index.html');
    if (cached) return cached;
    // Last resort — try matching the exact request
    const exactCached = await caches.match(request);
    if (exactCached) return exactCached;
    // Nothing cached at all
    return new Response('Offline — please check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Stale-while-revalidate: Serve from cache immediately, then fetch a fresh
 * copy in the background and update the cache. This keeps hashed Vite assets
 * in the SW cache (survives storage pressure on the HTTP cache) while still
 * staying fresh.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  // Fetch in the background regardless of cache hit
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached); // If network fails, fall back to cached

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

/**
 * Cache-first: Check cache first, fall back to network.
 * Good for static assets that rarely change (icons, fonts).
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 408 });
  }
}

/**
 * Network-first: Try network, fall back to cache.
 * For resources that should be fresh but can fall back.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('', { status: 408 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect Vite hashed assets: /assets/filename-[hash].js|css|woff2
 * These have content-hash in the filename so they're immutable per version.
 */
function isHashedAsset(url) {
  return /\/assets\/.*-[a-zA-Z0-9]{8,}\.(js|css|woff2?)$/i.test(url.pathname);
}

/**
 * Detect static assets by file extension.
 */
function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(url.pathname);
}
