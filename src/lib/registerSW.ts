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
