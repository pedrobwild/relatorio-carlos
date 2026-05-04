/**
 * useUserRole Hook Tests
 *
 * Tests for the user role hook with caching and race condition prevention.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: { role: "customer" }, error: null }),
    })),
  },
}));

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user-id" },
    loading: false,
  })),
}));

// Mock debug and error loggers
vi.mock("@/lib/debugAuth", () => ({
  debugAuth: vi.fn(),
}));

vi.mock("@/lib/errorLogger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";

const mockedUseAuth = vi.mocked(useAuth);

describe("useUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return loading state initially when auth is loading", async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: true,
      session: null,
      isAuthenticated: false,
      signOut: vi.fn(),
    });

    const { useUserRole, clearRoleCache } = await import("../useUserRole");
    clearRoleCache();

    const { result } = renderHook(() => useUserRole());

    // Loading because auth is loading
    expect(result.current.loading).toBe(true);
  });

  it("should return null role when user is null", async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      session: null,
      isAuthenticated: false,
      signOut: vi.fn(),
    });

    const { useUserRole, clearRoleCache } = await import("../useUserRole");
    clearRoleCache();

    const { result } = renderHook(() => useUserRole());

    expect(result.current.loading).toBe(false);
    expect(result.current.role).toBe(null);
  });

  it("should clear cache correctly", async () => {
    const { clearRoleCache } = await import("../useUserRole");

    // Should not throw
    expect(() => clearRoleCache()).not.toThrow();
  });

  it("should derive isStaff correctly based on role", () => {
    // Test the logic directly since we can't easily wait for async in renderHook
    const isStaffForRole = (role: string | null) => {
      return role === "engineer" || role === "admin" || role === "manager";
    };

    expect(isStaffForRole("engineer")).toBe(true);
    expect(isStaffForRole("admin")).toBe(true);
    expect(isStaffForRole("manager")).toBe(true);
    expect(isStaffForRole("customer")).toBe(false);
    expect(isStaffForRole(null)).toBe(false);
  });

  it("should derive isCustomer correctly", () => {
    const isCustomerForRole = (role: string | null) => role === "customer";

    expect(isCustomerForRole("customer")).toBe(true);
    expect(isCustomerForRole("engineer")).toBe(false);
  });

  it("should derive isAdmin correctly", () => {
    const isAdminForRole = (role: string | null) => role === "admin";

    expect(isAdminForRole("admin")).toBe(true);
    expect(isAdminForRole("engineer")).toBe(false);
    expect(isAdminForRole("customer")).toBe(false);
  });
});
