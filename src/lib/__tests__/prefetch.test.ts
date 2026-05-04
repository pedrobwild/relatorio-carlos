import { describe, it, expect, vi, beforeEach } from "vitest";
import { prefetchForTab, clearPrefetchCache } from "../prefetch";

// Mock queryClient
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    prefetchQuery: vi.fn().mockResolvedValue(undefined),
  },
  QUERY_TIMING: {
    default: { staleTime: 5000, gcTime: 10000 },
  },
}));

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock perf
vi.mock("@/lib/perf", () => ({
  perf: {
    mark: vi.fn(),
    measure: vi.fn(),
  },
}));

describe("prefetchForTab", () => {
  beforeEach(() => {
    clearPrefetchCache();
  });

  it("does nothing without projectId", () => {
    expect(() => prefetchForTab("financeiro", undefined)).not.toThrow();
  });

  it("handles all known tab names without error", () => {
    const tabs = [
      "curvaS",
      "gantt",
      "relatorio",
      "documentos",
      "pendencias",
      "financeiro",
      "compras",
      "formalizacoes",
    ];
    for (const tab of tabs) {
      expect(() => prefetchForTab(tab, "test-project")).not.toThrow();
    }
  });

  it("handles unknown tab names gracefully", () => {
    expect(() => prefetchForTab("unknown-tab", "test-project")).not.toThrow();
  });
});
