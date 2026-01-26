import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track if initial session has been set to avoid unnecessary state updates
  const initialSessionSet = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      initialSessionSet.current = true;
    });

    // Set up auth state listener - only handle meaningful events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        
        // Only update state for meaningful auth events
        // Ignore TOKEN_REFRESHED to prevent re-renders on tab switch
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
        }
        
        // For INITIAL_SESSION, only set if we haven't set initial session yet
        if (event === 'INITIAL_SESSION' && !initialSessionSet.current) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          initialSessionSet.current = true;
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!session,
  };
}
