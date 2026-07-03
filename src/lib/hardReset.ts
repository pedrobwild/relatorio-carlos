/**
 * Hard reset: recover from a wedged app state (stale bundle, corrupted cache,
 * broken service worker). Only invoked from error paths — never on happy path.
 *
 * Steps:
 * 1. Unregister every service worker registration.
 * 2. Delete every CacheStorage cache.
 * 3. Clear TanStack Query localStorage cache (bwild-query-cache-*).
 * 4. Reload with a cache-busting query param so the browser refetches index.html.
 */
/* eslint-disable no-console */

export async function hardReset(): Promise<void> {
  // 1. Unregister service workers
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch (e) {
    console.warn("[hardReset] SW unregister failed", e);
  }

  // 2. Delete all caches
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch (e) {
    console.warn("[hardReset] cache delete failed", e);
  }

  // 3. Clear TanStack Query localStorage cache
  try {
    if (typeof localStorage !== "undefined") {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("bwild-query-cache-")) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn("[hardReset] localStorage clear failed", e);
  }

  // 4. Reload with cache-busting param
  try {
    const url = `${window.location.pathname}${window.location.search ? window.location.search + "&" : "?"}v=${Date.now()}${window.location.hash}`;
    window.location.replace(url);
  } catch {
    window.location.reload();
  }
}
