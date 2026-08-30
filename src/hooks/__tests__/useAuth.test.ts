import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";
import { resetAuthStoreForTests } from "@/hooks/authStore";

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
vi.mock("@/hooks/useUserCustomerOnLogin", () => ({
  ensureCustomerProjectLink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useUserRole", () => ({
  clearRoleCache: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  },
}));

vi.mock("@/lib/queryPersister", () => ({
  clearPersistedCache: vi.fn(),
}));

describe("useAuth", () => {
  let stateChangeCallback: ((event: string, session: unknown) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStoreForTests();
    mockUnsubscribe.mockClear();
    mockOnAuthStateChange.mockImplementation((callback) => {
      stateChangeCallback = callback;
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

  it("should set up a single auth state listener across multiple mounts", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderHook(() => useAuth());
    renderHook(() => useAuth());
    renderHook(() => useAuth());

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("should unsubscribe only when the last listener leaves", () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const first = renderHook(() => useAuth());
    const second = renderHook(() => useAuth());

    first.unmount();
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    second.unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("should share the same snapshot across multiple hooks", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token" };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const first = renderHook(() => useAuth());
    const second = renderHook(() => useAuth());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(first.result.current.isAuthenticated).toBe(true);
    expect(second.result.current.isAuthenticated).toBe(true);
    expect(first.result.current.user).toBe(second.result.current.user);
    expect(first.result.current.session).toBe(second.result.current.session);
  });

  it("should update state when session exists", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token" };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
  });

  it("should call signOut when requested", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());

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

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
  });

  it("should handle SIGNED_OUT event and clear caches", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token" };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      if (stateChangeCallback) {
        stateChangeCallback("SIGNED_OUT", null);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
  });
});
