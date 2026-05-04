import { vi } from "vitest";
import type { User, Session } from "@supabase/supabase-js";

export const mockUser: User = {
  id: "test-user-id",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: { display_name: "Test User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

export const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: mockUser,
};

export const createMockSupabaseClient = () => {
  const authStateListeners: Array<
    (event: string, session: Session | null) => void
  > = [];

  return {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn((callback) => {
        authStateListeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
      // Helper to trigger auth state changes in tests
      _triggerAuthChange: (event: string, session: Session | null) => {
        authStateListeners.forEach((listener) => listener(event, session));
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
};

export const mockSupabaseClient = createMockSupabaseClient();
