import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createQueryPersister,
  isStorageAvailable,
  clearPersistedCache,
  hasPersistedCache,
  QUERY_CACHE_VERSION,
} from "@/lib/queryPersister";

describe("queryPersister", () => {
  describe("isStorageAvailable", () => {
    it("returns true when localStorage is available", () => {
      expect(isStorageAvailable()).toBe(true);
    });

    it("returns false when localStorage throws", () => {
      const mockSetItem = vi.spyOn(Storage.prototype, "setItem");
      mockSetItem.mockImplementation(() => {
        throw new Error("Storage unavailable");
      });

      expect(isStorageAvailable()).toBe(false);

      mockSetItem.mockRestore();
    });
  });

  describe("createQueryPersister", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it("returns a persister object with required methods", () => {
      const persister = createQueryPersister();

      expect(persister).not.toBeNull();
      expect(persister).toHaveProperty("persistClient");
      expect(persister).toHaveProperty("restoreClient");
      expect(persister).toHaveProperty("removeClient");
    });

    it("persists and restores client state", async () => {
      const persister = createQueryPersister();
      expect(persister).not.toBeNull();

      // Use a minimal mock that satisfies the interface
      const mockClient = {
        timestamp: Date.now(),
        buster: "1",
        clientState: {
          mutations: [],
          queries: [],
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await persister!.persistClient(mockClient as any);
      const restored = await persister!.restoreClient();

      expect(restored).toEqual(mockClient);
    });

    it("removes client from storage", async () => {
      const persister = createQueryPersister();
      expect(persister).not.toBeNull();

      const mockClient = {
        timestamp: Date.now(),
        buster: "1",
        clientState: { mutations: [], queries: [] },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await persister!.persistClient(mockClient as any);
      expect(hasPersistedCache()).toBe(true);

      await persister!.removeClient();
      expect(hasPersistedCache()).toBe(false);
    });
  });

  describe("clearPersistedCache", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("removes cache from localStorage", async () => {
      const persister = createQueryPersister();

      const mockClient = {
        timestamp: Date.now(),
        buster: "1",
        clientState: { mutations: [], queries: [] },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await persister!.persistClient(mockClient as any);

      expect(hasPersistedCache()).toBe(true);
      clearPersistedCache();
      expect(hasPersistedCache()).toBe(false);
    });
  });

  describe("QUERY_CACHE_VERSION", () => {
    it("exports a version number", () => {
      expect(typeof QUERY_CACHE_VERSION).toBe("number");
      expect(QUERY_CACHE_VERSION).toBeGreaterThan(0);
    });
  });
});
