import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

// Mock Supabase client
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      getSession: () => mockGetSession(),
      signOut: () => mockSignOut(),
    },
  },
}));

// Mock debug utilities
vi.mock("@/lib/debugAuth", () => ({
  debugAuth: vi.fn(),
  logAuthState: vi.fn(),
}));

// Mock useUserRole to avoid circular dependency
vi.mock("@/hooks/useUserRole", () => ({
  clearRoleCache: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe.mockClear();
    mockOnAuthStateChange.mockImplementation(() => {
      return {
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      };
    });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("should start with loading state", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should set up auth state listener on mount", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderHook(() => useAuth());

    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it("should unsubscribe on unmount", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { unmount } = renderHook(() => useAuth());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("should update state when session exists", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token" };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementation((callback) => {
      // Simulate auth state change
      setTimeout(() => callback("SIGNED_IN", mockSession), 0);
      return {
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      };
    });

    const { result, rerender } = renderHook(() => useAuth());

    // Wait for async updates
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    rerender();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
  });

  it("should call signOut when requested", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((callback) => {
      setTimeout(() => callback("SIGNED_OUT", null), 0);
      return {
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      };
    });

    const { result } = renderHook(() => useAuth());

    // Wait for loading to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("should handle null session (logged out)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockImplementation((callback) => {
      setTimeout(() => callback("SIGNED_OUT", null), 0);
      return {
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      };
    });

    const { result, rerender } = renderHook(() => useAuth());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    rerender();

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
  });
});
