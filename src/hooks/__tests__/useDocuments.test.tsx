/**
 * Tests for useDocuments hook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDocuments, DOCUMENT_CATEGORIES } from "../useDocuments";
import type { ReactNode } from "react";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: () =>
          Promise.resolve({ data: { signedUrl: "https://test.url" } }),
      }),
    },
  },
}));

// Mock useAuth
vi.mock("../useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty documents array when projectId is undefined", () => {
    const { result } = renderHook(() => useDocuments(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.documents).toEqual([]);
  });

  it("should return loading state initially when projectId is provided", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
  });

  it("should provide getDocumentsByCategory helper", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.getDocumentsByCategory).toBe("function");
    const contracts = result.current.getDocumentsByCategory("contrato");
    expect(contracts).toEqual([]);
  });

  it("should provide getLatestByCategory helper", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.getLatestByCategory).toBe("function");
    const latest = result.current.getLatestByCategory("contrato");
    expect(latest).toEqual([]);
  });

  it("should provide getVersionHistory helper", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.getVersionHistory).toBe("function");
    const history = result.current.getVersionHistory("doc-id");
    expect(history).toEqual([]);
  });

  it("should provide approveDocument mutation function", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.approveDocument).toBe("function");
  });

  it("should provide refetch function", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.refetch).toBe("function");
  });

  it("should expose isApproving state", () => {
    const { result } = renderHook(() => useDocuments("test-project-id"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isApproving).toBe(false);
  });
});

describe("DOCUMENT_CATEGORIES", () => {
  it("should have all expected categories", () => {
    const expectedCategories = [
      "contrato",
      "aditivo",
      "projeto_3d",
      "executivo",
      "art_rrt",
      "plano_reforma",
      "nota_fiscal",
      "garantia",
      "as_built",
      "termo_entrega",
    ];

    expect(Object.keys(DOCUMENT_CATEGORIES)).toEqual(expectedCategories);
  });

  it("should have label and icon for each category", () => {
    Object.values(DOCUMENT_CATEGORIES).forEach((category) => {
      expect(category).toHaveProperty("label");
      expect(category).toHaveProperty("icon");
      expect(typeof category.label).toBe("string");
      expect(typeof category.icon).toBe("string");
    });
  });
});
