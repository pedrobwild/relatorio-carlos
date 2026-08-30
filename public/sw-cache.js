/**
 * Offline-first data caching via Service Worker.
 *
 * Caches critical API responses (projects, inspections, NCs) for offline use.
 * Uses a network-first strategy for read operations.
 *
 * Registration is guarded: never registers inside iframes or Lovable previews.
 *
 * ISOLAMENTO POR USUÁRIO (importante)
 * -----------------------------------
 * A Cache API indexa por URL. Como o que identifica o usuário nestes requests é
 * o header `Authorization`, guardar a resposta só pela URL fazia a entrada de um
 * usuário ser devolvida a QUALQUER outro que abrisse a mesma URL neste
 * dispositivo (troca de conta, celular compartilhado em obra). Por isso a chave
 * de cache carrega o `sub` do JWT, e nada é cacheado quando não há token.
 */

// v2: a v1 guardava entradas sem isolamento por usuário e é descartada no activate.
const CACHE_NAME = 'bwild-api-cache-v2';
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

self.addEventListener('install', () => {
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

// O app manda esta mensagem no logout para não deixar dados da conta anterior
// acessíveis offline no dispositivo.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'bwild-clear-api-cache') {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});

function shouldCache(url) {
  return CACHEABLE_PATTERNS.some(pattern => url.includes(pattern));
}

function isGetRequest(request) {
  return request.method === 'GET';
}

/** Lê o `sub` do JWT enviado no header Authorization. Null se não houver. */
function getUserFingerprint(request) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    // `sub` só existe no token de um usuário logado; a chave anônima não tem.
    return payload && payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

/** Chave de cache = URL + dono do token. */
function buildCacheKey(request, fingerprint) {
  const separator = request.url.includes('?') ? '&' : '?';
  return new Request(
    `${request.url}${separator}__sw_user=${encodeURIComponent(fingerprint)}`,
    { method: 'GET' }
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache GET requests to our API
  if (!isGetRequest(request) || !shouldCache(request.url)) {
    return;
  }

  const fingerprint = getUserFingerprint(request);

  // Sem identidade no request não há como isolar o cache — deixa o browser
  // tratar normalmente em vez de arriscar servir dado de outra conta.
  if (!fingerprint) {
    return;
  }

  const cacheKey = buildCacheKey(request, fingerprint);

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
            cache.put(cacheKey, cachedResponse);
          });
        }
        return response;
      })
      .catch(async () => {
        // Offline: serve from cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(cacheKey);

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
