/**
 * Register the offline cache service worker.
 * Guarded against iframes and preview hosts.
 */
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
