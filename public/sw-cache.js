/**
 * Offline-first data caching via Service Worker.
 *
 * Caches critical API responses (projects, inspections, NCs) for offline use.
 * Uses a cache-then-network strategy for read operations.
 *
 * Registration is guarded: never registers inside iframes or Lovable previews.
 */

const CACHE_NAME = 'bwild-api-cache-v1';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Patterns of API URLs to cache for offline use
const CACHEABLE_PATTERNS = [
  '/rest/v1/inspections',
  '/rest/v1/non_conformities',
  '/rest/v1/projects',
  '/rest/v1/inspection_items',
  '/rest/v1/project_activities',
  '/rest/v1/project_documents',
  '/rest/v1/obra_tasks',
];

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('bwild-api-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function shouldCache(url) {
  return CACHEABLE_PATTERNS.some(pattern => url.includes(pattern));
}

function isGetRequest(request) {
  return request.method === 'GET';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache GET requests to our API
  if (!isGetRequest(request) || !shouldCache(request.url)) {
    return;
  }

  // Network-first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        // Clone the response and cache it
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            // Store with timestamp header for expiry checking
            const headers = new Headers(responseClone.headers);
            headers.set('x-cached-at', Date.now().toString());
            const cachedResponse = new Response(responseClone.body, {
              status: responseClone.status,
              statusText: responseClone.statusText,
              headers,
            });
            cache.put(request, cachedResponse);
          });
        }
        return response;
      })
      .catch(async () => {
        // Offline: serve from cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
          const cachedAt = parseInt(cachedResponse.headers.get('x-cached-at') || '0');
          if (Date.now() - cachedAt < CACHE_EXPIRY_MS) {
            return cachedResponse;
          }
        }

        // No cache hit — return offline error
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sem conexão. Dados não disponíveis offline.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
  );
});
