import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { debugAuth, logAuthState } from '@/lib/debugAuth';
import { clearRoleCache } from './useUserRole';
import { useLinkCustomerOnLogin } from './useLinkCustomerOnLogin';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track if initial session has been set to avoid unnecessary state updates
  const initialSessionSet = useRef(false);
  // Track session ID to prevent duplicate updates for same session
  const lastSessionId = useRef<string | null>(null);

  // Auto-link customer to projects on login based on email
  useLinkCustomerOnLogin(user);

  useEffect(() => {
    let isMounted = true;

    debugAuth('useAuth mount');

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      
      debugAuth('getSession result', { 
        hasSession: !!initialSession,
        userId: initialSession?.user?.id 
      });
      
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      initialSessionSet.current = true;
      lastSessionId.current = initialSession?.access_token ?? null;
      
      logAuthState({
        isAuthenticated: !!initialSession,
        loading: false,
        userId: initialSession?.user?.id,
        event: 'getSession',
      });
    });

    // Set up auth state listener - only handle meaningful events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        
        debugAuth('onAuthStateChange', { 
          event, 
          hasSession: !!newSession,
          userId: newSession?.user?.id,
          isSameSession: newSession?.access_token === lastSessionId.current,
        });
        
        // CRITICAL: Ignore TOKEN_REFRESHED to prevent re-renders on tab switch
        // This event fires when the browser refreshes the JWT token in the background
        if (event === 'TOKEN_REFRESHED') {
          debugAuth('Ignoring TOKEN_REFRESHED event');
          return;
        }
        
        // Only update state for meaningful auth events
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          // Prevent duplicate updates for same session
          if (event === 'SIGNED_IN' && newSession?.access_token === lastSessionId.current) {
            debugAuth('Ignoring duplicate SIGNED_IN for same session');
            return;
          }
          
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          lastSessionId.current = newSession?.access_token ?? null;
          
          logAuthState({
            isAuthenticated: !!newSession,
            loading: false,
            userId: newSession?.user?.id,
            event,
          });
        }
        
        // For INITIAL_SESSION, only set if we haven't set initial session yet
        if (event === 'INITIAL_SESSION' && !initialSessionSet.current) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          initialSessionSet.current = true;
          lastSessionId.current = newSession?.access_token ?? null;
          
          logAuthState({
            isAuthenticated: !!newSession,
            loading: false,
            userId: newSession?.user?.id,
            event: 'INITIAL_SESSION',
          });
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      debugAuth('useAuth unmount');
    };
  }, []);

  const signOut = useCallback(async () => {
    debugAuth('signOut called');
    clearRoleCache(); // Clear role cache on logout

    // CRITICAL: We do NOT set loading=true here because:
    // 1. It would trigger ProtectedRoute to show a spinner
    // 2. The navigate() call in AppHeader would race with ProtectedRoute's redirect
    // Instead, we clear state synchronously after the network call

    // Attempt server-side sign out first so the SDK can broadcast SIGNED_OUT to all listeners.
    // If this fails, we still perform a guaranteed local cleanup.
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        debugAuth('signOut error', { error: error.message });
      } else {
        debugAuth('signOut successful');
      }
    } catch (error) {
      debugAuth('signOut threw (will fallback to local cleanup)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Guaranteed local cleanup so logout always "sticks"
    // This runs AFTER the network call completes (or fails)
    const authStorageKey = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;
    try {
      localStorage.removeItem(authStorageKey);
      localStorage.removeItem(`${authStorageKey}-code-verifier`);
      localStorage.removeItem(`${authStorageKey}-user`);
    } catch {
      // Ignore storage errors
    }

    // Clear state synchronously - this will trigger re-renders
    setSession(null);
    setUser(null);
    lastSessionId.current = null;
    initialSessionSet.current = false;
    
    debugAuth('signOut cleanup complete, state cleared');
  }, []);

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!session,
  };
}
