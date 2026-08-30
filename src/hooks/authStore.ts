import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { debugAuth, logAuthState } from "@/lib/debugAuth";
import { clearRoleCache } from "./useUserRole";
import { ensureCustomerProjectLink } from "./useLinkCustomerOnLogin";
import { queryClient } from "@/lib/queryClient";
import { clearPersistedCache } from "@/lib/queryPersister";

export interface AuthSnapshot {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

let state: AuthSnapshot = { user: null, session: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;
let lastSessionId: string | null = null;
let lastLinkedUserId: string | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: AuthSnapshot) {
  if (
    next.user === state.user &&
    next.session === state.session &&
    next.loading === state.loading
  ) {
    return;
  }
  state = next;
  emit();
}

function clearStaleAuthStorage() {
  try {
    const authStorageKey = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;
    localStorage.removeItem(authStorageKey);
    localStorage.removeItem(`${authStorageKey}-code-verifier`);
    localStorage.removeItem(`${authStorageKey}-user`);
  } catch {
    // Ignore storage errors
  }
}

async function handleLinkOnUserChange(user: User | null) {
  if (!user?.id) return;
  if (user.id === lastLinkedUserId) return;
  lastLinkedUserId = user.id;
  try {
    await ensureCustomerProjectLink(user);
  } catch {
    // ensureCustomerProjectLink já loga erros internamente.
  }
}

function handleGetSessionResult(initialSession: Session | null) {
  setState({
    user: initialSession?.user ?? null,
    session: initialSession,
    loading: false,
  });
  lastSessionId = initialSession?.access_token ?? null;

  logAuthState({
    isAuthenticated: !!initialSession,
    loading: false,
    userId: initialSession?.user?.id,
    event: "getSession",
  });

  void handleLinkOnUserChange(initialSession?.user ?? null);
}

function handleGetSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const isInvalidRefreshToken = message
    .toLowerCase()
    .includes("refresh token not found");

  debugAuth("getSession error", { message, isInvalidRefreshToken });

  if (isInvalidRefreshToken) {
    clearStaleAuthStorage();
    clearRoleCache();
  }

  setState({ user: null, session: null, loading: false });
  lastSessionId = null;

  logAuthState({
    isAuthenticated: false,
    loading: false,
    userId: undefined,
    event: "getSessionError",
  });
}

function handleAuthStateChange(event: AuthChangeEvent, newSession: Session | null) {
  debugAuth("onAuthStateChange", {
    event,
    hasSession: !!newSession,
    userId: newSession?.user?.id,
    isSameSession: newSession?.access_token === lastSessionId,
  });

  if (event === "TOKEN_REFRESHED") {
    if (newSession?.access_token === lastSessionId) {
      debugAuth("Ignoring TOKEN_REFRESHED for same access token");
      return;
    }
    lastSessionId = newSession?.access_token ?? null;
    debugAuth("TOKEN_REFRESHED with new access token, updated ref");
    return;
  }

  if (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED"
  ) {
    if (
      event === "SIGNED_IN" &&
      newSession?.access_token === lastSessionId
    ) {
      debugAuth("Ignoring duplicate SIGNED_IN for same session");
      return;
    }

    if (event === "SIGNED_OUT") {
      queryClient.cancelQueries().catch(() => {
        /* ignore */
      });
      queryClient.clear();
      clearPersistedCache();
      clearRoleCache();
    }

    setState({
      user: newSession?.user ?? null,
      session: newSession,
      loading: false,
    });
    lastSessionId = newSession?.access_token ?? null;

    logAuthState({
      isAuthenticated: !!newSession,
      loading: false,
      userId: newSession?.user?.id,
      event,
    });

    if (event === "SIGNED_IN" || event === "USER_UPDATED") {
      void handleLinkOnUserChange(newSession?.user ?? null);
    }

    if (event === "SIGNED_OUT") {
      lastLinkedUserId = null;
    }
  }

  if (event === "INITIAL_SESSION" && state.loading) {
    setState({
      user: newSession?.user ?? null,
      session: newSession,
      loading: false,
    });
    lastSessionId = newSession?.access_token ?? null;

    logAuthState({
      isAuthenticated: !!newSession,
      loading: false,
      userId: newSession?.user?.id,
      event: "INITIAL_SESSION",
    });

    void handleLinkOnUserChange(newSession?.user ?? null);
  }
}

function init() {
  if (initialized) return;
  initialized = true;

  debugAuth("authStore init");

  supabase.auth
    .getSession()
    .then(({ data: { session: initialSession } }) => {
      handleGetSessionResult(initialSession);
    })
    .catch((error) => {
      handleGetSessionError(error);
    });

  supabase.auth.onAuthStateChange(handleAuthStateChange);
}

export function getAuthSnapshot(): AuthSnapshot {
  return state;
}

export function subscribeAuthStore(listener: () => void): () => void {
  listeners.add(listener);
  init();
  return () => {
    listeners.delete(listener);
  };
}

export async function authSignOut(): Promise<void> {
  debugAuth("signOut called");
  clearRoleCache();

  try {
    await queryClient.cancelQueries();
  } catch {
    // ignore cancellation errors
  }
  queryClient.clear();
  clearPersistedCache();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      debugAuth("signOut error", { error: error.message });
    } else {
      debugAuth("signOut successful");
    }
  } catch (error) {
    debugAuth("signOut threw (will fallback to local cleanup)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  clearStaleAuthStorage();

  setState({ user: null, session: null, loading: false });
  lastSessionId = null;
  lastLinkedUserId = null;

  debugAuth("signOut cleanup complete, state cleared");
}

export function resetAuthStoreForTests(): void {
  state = { user: null, session: null, loading: true };
  listeners.clear();
  initialized = false;
  lastSessionId = null;
  lastLinkedUserId = null;
}
