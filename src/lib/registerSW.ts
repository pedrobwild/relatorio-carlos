/**
 * Register the offline cache service worker.
 * Guarded against iframes and preview hosts.
 */
/* eslint-disable no-console */
export function registerOfflineCacheSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Never register in iframes
  try {
    if (window.self !== window.top) return;
  } catch {
    return; // cross-origin iframe
  }

  // Never register on Lovable preview hosts
  const host = window.location.hostname;
  if (host.includes("id-preview--") || host.includes("lovableproject.com"))
    return;

  navigator.serviceWorker
    .register("/sw-cache.js", { scope: "/" })
    .then((reg) => {
      console.info("[SW] Offline cache registered", reg.scope);
      // Os arquivos de build desta carga vieram ANTES de o SW controlar a
      // página. Sem isto, a primeira visita não deixaria o app abrível sem
      // sinal (o SW guarda só os que ainda não tem).
      return navigator.serviceWorker.ready.then((ready) => {
        ready.active?.postMessage({ type: "bwild-cache-assets", urls: loadedBuildAssets() });
      });
    })
    .catch((err) => {
      console.warn("[SW] Registration failed:", err);
    });
}

/**
 * Apaga o cache offline da API.
 *
 * Chamado no logout: sem isto, os dados da conta anterior continuam legíveis
 * offline no aparelho — um problema real em celular compartilhado na obra.
 */
export function clearOfflineApiCache(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: "bwild-clear-api-cache" });
      })
      .catch(() => {
        /* SW indisponível — nada a limpar */
      });
  } catch {
    /* ignore */
  }
}

/** Arquivos de build (/assets/) já carregados nesta página. */
export function loadedBuildAssets(): string[] {
  if (typeof window === "undefined" || typeof performance === "undefined") return [];
  try {
    const origin = window.location.origin;
    const urls = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.startsWith(`${origin}/assets/`));
    return [...new Set(urls)];
  } catch {
    return [];
  }
}
