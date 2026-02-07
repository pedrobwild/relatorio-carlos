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
 * 
 * For users with multiple roles, prioritizes staff routes over customer routes.
 */
export function AuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: roleLoading, isStaff, isCustomer } = useUserRole();
  
  // Track if we've already done the initial redirect to prevent re-triggers
  // Also track the user roles to reset on user change (logout/login)
  const hasRedirected = useRef(false);
  const lastAuthState = useRef<{ isAuthenticated: boolean; roles: string[] }>({ 
    isAuthenticated: false, 
    roles: [] 
  });

  useEffect(() => {
    if (authLoading || roleLoading) {
      debugNav('AuthRedirect: still loading', { authLoading, roleLoading });
      return;
    }
    
    // BUG FIX: Reset redirect flag when auth state changes (logout/login with different user)
    const rolesKey = roles.join(',');
    const prevRolesKey = lastAuthState.current.roles.join(',');
    const hasAuthChanged = 
      lastAuthState.current.isAuthenticated !== isAuthenticated ||
      prevRolesKey !== rolesKey;
    
    if (hasAuthChanged) {
      debugNav('AuthRedirect: auth state changed, resetting redirect flag', {
        previous: lastAuthState.current,
        current: { isAuthenticated, roles },
      });
      hasRedirected.current = false;
      lastAuthState.current = { isAuthenticated, roles };
    }
    
    // Prevent multiple redirects for same auth state
    if (hasRedirected.current) {
      debugNav('AuthRedirect: already redirected for this auth state, skipping');
      return;
    }

    // Only redirect if we're on the root path "/" AND authenticated
    // This prevents redirect loops from other routes
    if (isAuthenticated && roles.length > 0 && location.pathname === '/') {
      debugNav('AuthRedirect: performing role-based redirect', { 
        roles, 
        isStaff, 
        isCustomer 
      });
      
      hasRedirected.current = true;
      
      // Prioritize staff routes for users with multiple roles
      if (isStaff) {
        navigate('/gestao', { replace: true });
      } else if (isCustomer) {
        navigate('/minhas-obras', { replace: true });
      }
    }
  }, [isAuthenticated, roles, isStaff, isCustomer, authLoading, roleLoading, navigate, location.pathname]);

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
