import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

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

  useEffect(() => {
    if (authLoading || roleLoading) return;

    // Only redirect if we're on the root path "/" AND authenticated
    // This prevents redirect loops from other routes
    if (isAuthenticated && role && location.pathname === '/') {
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
