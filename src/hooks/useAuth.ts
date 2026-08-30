import { useSyncExternalStore, useCallback } from "react";
import {
  subscribeAuthStore,
  getAuthSnapshot,
  authSignOut,
} from "./authStore";

export function useAuth() {
  const { user, session, loading } = useSyncExternalStore(
    subscribeAuthStore,
    getAuthSnapshot,
    getAuthSnapshot,
  );

  const signOut = useCallback(() => authSignOut(), []);

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!session,
  };
}
