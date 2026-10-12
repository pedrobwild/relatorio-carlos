/**
 * Offline-first data caching via Service Worker.
 *
 * Caches critical API responses (projects, inspections, NCs, operação do dia)
 * for offline use. Uses a network-first strategy for read operations.
 *
 * CASCA DO APP (para abrir sem sinal depois de recarregar / reabrir o app)
 * -----------------------------------------------------------------------
 * - Navegação (index.html): REDE PRIMEIRO, sempre. A cópia guardada só é
 *   servida quando a rede falha ou estoura o teto — nunca quando ela
 *   responde. Assim um deploy do Lovable chega na hora para quem tem sinal.
 * - Arquivos com hash em /assets/: cache primeiro (o nome muda a cada build,
 *   então a cópia nunca fica "velha"). Guardamos os que a página usa, com
 *   teto de quantidade para não crescer sem limite entre deploys.
 * A casca não é dado de usuário: não precisa de isolamento por conta e não é
 * apagada no logout (o cache da API, sim).
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
// v4: passa a guardar também as leituras da operação (tela Hoje).
const CACHE_NAME = 'bwild-api-cache-v4';
const SHELL_CACHE = 'bwild-shell-v1';
const ASSET_CACHE = 'bwild-assets-v1';
const CURRENT_CACHES = [CACHE_NAME, SHELL_CACHE, ASSET_CACHE];

/** Chave única da casca: toda rota do SPA devolve o mesmo index.html. */
const SHELL_KEY = '/index.html';

/** Navegação: espera a rede um pouco menos que a API — é a tela em branco. */
const NAVIGATION_TIMEOUT_MS = 6000;

/** Teto de arquivos de build guardados (vários deploys cabem folgado). */
const MAX_ASSET_ENTRIES = 250;

/**
 * Teto para a ida à rede.
 *
 * Sem isto, `event.respondWith(fetch(...))` fica pendurado enquanto o fetch
 * não resolver — e uma rede DEGRADADA (não caída) prende a requisição para
 * sempre. Do lado do app isso vira uma tela presa no esqueleto de carregamento
 * que nunca sai, porque a query nunca resolve nem rejeita. Foi assim que o
 * Painel de Obras ficou travado. Estourado o tempo, servimos cache ou uma
 * resposta de erro — as duas coisas o app sabe tratar.
 */
const NETWORK_TIMEOUT_MS = 8000;
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
  // Operação (tela Hoje): o dia, as atividades e a prontidão de material.
  '/rest/v1/ops_assignments',
  '/rest/v1/ops_activities',
  '/rest/v1/v_ops_activities',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Guarda a casca já na instalação: a primeira carga da página aconteceu
  // antes de este SW controlá-la, então nada dela passou pelo `fetch` abaixo.
  // Sem rede aqui, tudo bem — a próxima navegação guarda.
  event.waitUntil(refreshShell().catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('bwild-') && !CURRENT_CACHES.includes(k))
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
  // Depois de registrar, a página manda os arquivos de build que já carregou
  // (inclusive os lazy, como a tela Hoje) — eles vieram antes do SW assumir.
  if (event.data && event.data.type === 'bwild-cache-assets' && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheAssets(event.data.urls).catch(() => undefined));
  }
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isBuildAsset(url) {
  try {
    const u = new URL(url);
    return u.origin === self.location.origin && u.pathname.startsWith('/assets/');
  } catch {
    return false;
  }
}

/** Arquivos de build referenciados por um index.html. */
function assetUrlsFromHtml(html) {
  const urls = [];
  const re = /(?:src|href)=["'](\/assets\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) urls.push(new URL(m[1], self.location.origin).href);
  return urls;
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ASSET_ENTRIES;
  // `keys()` vem na ordem de inserção: os mais antigos (deploys anteriores) saem.
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

/** Guarda os arquivos de build que ainda não estão no cache. */
async function cacheAssets(urls) {
  const cache = await caches.open(ASSET_CACHE);
  for (const url of urls) {
    if (!isBuildAsset(url)) continue;
    if (await cache.match(url)) continue;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.ok) await cache.put(url, res);
    } catch {
      /* sem rede: fica para a próxima */
    }
  }
  await trimAssets(cache);
}

/** Guarda uma resposta de navegação como a casca e aquece os assets dela. */
async function storeShell(response) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/html')) return;
  const html = await response.clone().text();
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(SHELL_KEY, response);
  await cacheAssets(assetUrlsFromHtml(html));
}

function refreshShell() {
  return fetch('/', { cache: 'reload', credentials: 'same-origin' }).then(storeShell);
}

const OFFLINE_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title></head><body style="font-family:system-ui,sans-serif;padding:24px;line-height:1.5"><h1 style="font-size:20px">Sem conexão</h1><p>O app ainda não foi aberto com sinal neste aparelho. Conecte-se uma vez e ele passa a abrir mesmo sem sinal.</p><button onclick="location.reload()" style="min-height:44px;padding:0 16px">Tentar de novo</button></body></html>`;

/**
 * Navegação: rede primeiro (deploy novo chega na hora); a casca guardada só
 * quando a rede falha ou não responde a tempo.
 */
function handleNavigation(event) {
  const { request } = event;
  return fetchComTeto(request, NAVIGATION_TIMEOUT_MS)
    .then(response => {
      if (response.ok) event.waitUntil(storeShell(response.clone()).catch(() => undefined));
      return response;
    })
    .catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      const shell = await cache.match(SHELL_KEY);
      if (shell) return shell;
      return new Response(OFFLINE_PAGE, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'x-bwild-offline': '1' },
      });
    });
}

/** Arquivo de build: cache primeiro; da rede, guarda para a próxima. */
async function handleAsset(event) {
  const { request } = event;
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    event.waitUntil(
      cache
        .put(request.url, response.clone())
        .then(() => trimAssets(cache))
        .catch(() => undefined)
    );
  }
  return response;
}

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

/**
 * `fetch` com teto de tempo. Rejeita em vez de pendurar, para que o caminho de
 * fallback (cache ou erro) sempre aconteça.
 */
function fetchComTeto(request, timeoutMs = NETWORK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('sw-network-timeout'));
    }, timeoutMs);

    fetch(request, { signal: controller.signal })
      .then(response => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (isGetRequest(request) && request.mode === 'navigate' && isSameOrigin(request.url)) {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isGetRequest(request) && isBuildAsset(request.url)) {
    event.respondWith(handleAsset(event));
    return;
  }

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
    fetchComTeto(request)
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

        // Sem cache: devolvemos um erro identificável.
        //
        // O `code` viaja no corpo e o postgrest-js o entrega como `error.code`,
        // então o app consegue distinguir ISTO (a requisição não saiu daqui) de
        // um 5xx real do servidor. Sem essa marca, o app anunciava "o sistema
        // está fora do ar" quando quem tinha caído era a conexão do usuário.
        return new Response(
          JSON.stringify({
            code: 'BWILD_OFFLINE',
            message: 'Sem conexão com o servidor. Dados não disponíveis offline.',
            details: '',
            hint: '',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'x-bwild-offline': '1',
            },
          }
        );
      })
  );
});
