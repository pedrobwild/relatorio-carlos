/**
 * Auto-recovery for stale dynamic-import chunks after a deploy.
 *
 * When a user has an old index.html cached and navigates to a lazy route whose
 * chunk hash no longer exists, the dynamic import fails. Symptoms:
 *   - "Failed to fetch dynamically imported module"
 *   - "error loading dynamically imported module"
 *   - "Importing a module script failed"
 *   - ChunkLoadError
 *
 * Strategy: on ONE detected occurrence, reload with a cache-busting param.
 * Guard: sessionStorage timestamp — never auto-reload twice within 60s. If we
 * already reloaded recently, do nothing (let ErrorBoundary show its UI with
 * the manual "Limpar e recarregar" button) so we never loop.
 */
/* eslint-disable no-console */

const GUARD_KEY = "bw_chunk_reload_at";
const GUARD_WINDOW_MS = 60_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /ChunkLoadError/i,
  /Loading chunk [\d]+ failed/i,
  /Loading CSS chunk/i,
];

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? `${err.name}: ${err.message}`
        : String((err as { message?: unknown })?.message ?? "");
  if (!msg) return false;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(msg));
}

function recentlyReloaded(): boolean {
  try {
    const raw = sessionStorage.getItem(GUARD_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Attempts one cache-busting reload. Returns true if a reload was scheduled,
 * false if suppressed by the anti-loop guard.
 */
export function tryReloadForStaleChunk(): boolean {
  if (recentlyReloaded()) {
    console.warn(
      "[chunkReload] stale chunk detected again within 60s — suppressing reload to avoid loop",
    );
    return false;
  }
  markReloaded();
  try {
    const url = `${window.location.pathname}${
      window.location.search
        ? window.location.search + "&"
        : "?"
    }v=${Date.now()}${window.location.hash}`;
    window.location.replace(url);
  } catch {
    window.location.reload();
  }
  return true;
}

/**
 * Install global listeners for chunk-load failures. Idempotent.
 */
let installed = false;
export function installChunkReloadHandler(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
      tryReloadForStaleChunk();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      tryReloadForStaleChunk();
    }
  });
}
