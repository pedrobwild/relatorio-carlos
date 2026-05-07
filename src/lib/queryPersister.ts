/**
 * Query Cache Persistence Configuration
 *
 * Handles localStorage persistence for TanStack Query cache with:
 * - Version-based cache busting
 * - Graceful handling of SSR/missing window
 * - Size limits to prevent quota issues
 */
/* eslint-disable no-console */

import type {
  Persister,
  PersistedClient,
} from "@tanstack/react-query-persist-client";

// Increment this version to invalidate all cached data after deploy
export const QUERY_CACHE_VERSION = 4;
const STORAGE_KEY = `bwild-query-cache-v${QUERY_CACHE_VERSION}`;
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Check if we're in a browser environment with localStorage available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Custom storage wrapper with size checking and error handling
 */
const safeStorage = {
  getItem: (key: string): string | null => {
    if (!isStorageAvailable()) return null;

    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("[QueryPersist] Failed to read from localStorage:", error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    if (!isStorageAvailable()) return;

    try {
      // Check size before writing
      if (value.length > MAX_STORAGE_SIZE) {
        console.warn("[QueryPersist] Cache too large, skipping persistence");
        return;
      }

      window.localStorage.setItem(key, value);
    } catch (error) {
      // Handle quota exceeded
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.warn(
          "[QueryPersist] Storage quota exceeded, clearing old cache",
        );
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Ignore cleanup errors
        }
      } else {
        console.warn("[QueryPersist] Failed to write to localStorage:", error);
      }
    }
  },

  removeItem: (key: string): void => {
    if (!isStorageAvailable()) return;

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn("[QueryPersist] Failed to remove from localStorage:", error);
    }
  },
};

/**
 * Remove cache entries from previous versions
 */
function cleanupOldCacheVersions(): void {
  if (!isStorageAvailable()) return;

  try {
    const keys = Object.keys(window.localStorage);
    const oldCacheKeys = keys.filter(
      (key) => key.startsWith("bwild-query-cache-v") && key !== STORAGE_KEY,
    );

    oldCacheKeys.forEach((key) => {
      window.localStorage.removeItem(key);
      console.info(`[QueryPersist] Removed old cache: ${key}`);
    });
  } catch (error) {
    console.warn("[QueryPersist] Failed to cleanup old cache versions:", error);
  }
}

/**
 * Creates a localStorage persister for TanStack Query
 * Returns null if storage is not available (SSR, private browsing, etc.)
 */
export function createQueryPersister(): Persister | null {
  if (!isStorageAvailable()) {
    console.info(
      "[QueryPersist] Storage not available, cache will not persist",
    );
    return null;
  }

  // Clean up old cache versions
  cleanupOldCacheVersions();

  return {
    persistClient: async (client: PersistedClient) => {
      try {
        // Strip queries opted out via `meta: { persist: false }`.
        // Used for queries holding short-lived data (signed URLs, tokens)
        // where restoring from localStorage would resurrect expired values.
        const filteredClient: PersistedClient = {
          ...client,
          clientState: {
            ...client.clientState,
            queries: client.clientState.queries.filter(
              (q) =>
                (q.meta as { persist?: boolean } | undefined)?.persist !==
                false,
            ),
          },
        };
        const serialized = JSON.stringify(filteredClient);
        safeStorage.setItem(STORAGE_KEY, serialized);
      } catch (error) {
        console.warn("[QueryPersist] Failed to persist client:", error);
      }
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const data = safeStorage.getItem(STORAGE_KEY);
        if (!data) return undefined;

        let parsed: PersistedClient;
        try {
          parsed = JSON.parse(data) as PersistedClient;
        } catch {
          console.warn("[QueryPersist] Failed to parse cached data, clearing");
          safeStorage.removeItem(STORAGE_KEY);
          return undefined;
        }

        // Validate basic structure to prevent corrupted cache from crashing the app
        if (!parsed || typeof parsed !== "object") {
          console.warn("[QueryPersist] Invalid cache structure, clearing");
          safeStorage.removeItem(STORAGE_KEY);
          return undefined;
        }

        // Validate required fields exist
        if (!parsed.clientState || !parsed.timestamp) {
          console.warn(
            "[QueryPersist] Missing required cache fields, clearing",
          );
          safeStorage.removeItem(STORAGE_KEY);
          return undefined;
        }

        // Check if cache is too old (more than 24 hours)
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > maxAge) {
          console.info("[QueryPersist] Cache expired, clearing");
          safeStorage.removeItem(STORAGE_KEY);
          return undefined;
        }

        return parsed;
      } catch (error) {
        console.warn(
          "[QueryPersist] Failed to restore client, clearing corrupted cache:",
          error,
        );
        // Clear corrupted cache to prevent future errors
        safeStorage.removeItem(STORAGE_KEY);
        return undefined;
      }
    },

    removeClient: async () => {
      safeStorage.removeItem(STORAGE_KEY);
    },
  };
}

/**
 * Manually clear the query cache from storage
 */
export function clearPersistedCache(): void {
  safeStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if persisted cache exists
 */
export function hasPersistedCache(): boolean {
  return safeStorage.getItem(STORAGE_KEY) !== null;
}
