import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { debugNav } from '@/lib/debugAuth';

/**
 * Component that redirects authenticated users based on their role.
 * ONLY redirects on INITIAL page load. Does NOT redirect on:
 * - Tab switch / focus events
 * - Token refresh
 * - Component re-mount due to HMR or React strict mode
 */
export function AuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, isStaff, isCustomer } = useUserRole();
  
  // Track if we've already done the initial redirect to prevent re-triggers
  // Also track the user ID to reset on user change (logout/login)
  const hasRedirected = useRef(false);
  const lastAuthState = useRef<{ isAuthenticated: boolean; role: string | null }>({ 
    isAuthenticated: false, 
    role: null 
  });

  useEffect(() => {
    if (authLoading || roleLoading) {
      debugNav('AuthRedirect: still loading', { authLoading, roleLoading });
      return;
    }
    
    // BUG FIX: Reset redirect flag when auth state changes (logout/login with different user)
    const currentState = { isAuthenticated, role };
    const hasAuthChanged = 
      lastAuthState.current.isAuthenticated !== isAuthenticated ||
      lastAuthState.current.role !== role;
    
    if (hasAuthChanged) {
      debugNav('AuthRedirect: auth state changed, resetting redirect flag', {
        previous: lastAuthState.current,
        current: currentState,
      });
      hasRedirected.current = false;
      lastAuthState.current = currentState;
    }
    
    // Prevent multiple redirects for same auth state
    if (hasRedirected.current) {
      debugNav('AuthRedirect: already redirected for this auth state, skipping');
      return;
    }

    // Only redirect if we're on the root path "/" AND authenticated
    // This prevents redirect loops from other routes
    if (isAuthenticated && role && location.pathname === '/') {
      debugNav('AuthRedirect: performing role-based redirect', { 
        role, 
        isStaff, 
        isCustomer 
      });
      
      hasRedirected.current = true;
      
      if (isStaff) {
        navigate('/gestao', { replace: true });
      } else if (isCustomer) {
        navigate('/minhas-obras', { replace: true });
      }
    }
  }, [isAuthenticated, role, isStaff, isCustomer, authLoading, roleLoading, navigate, location.pathname]);

  // Show loading while checking auth
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return null;
}
