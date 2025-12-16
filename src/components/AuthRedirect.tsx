import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Component that redirects authenticated users based on their role
 */
export function AuthRedirect() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, isStaff, isCustomer } = useUserRole();

  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (isAuthenticated && role) {
      if (isStaff) {
        navigate('/gestao', { replace: true });
      } else if (isCustomer) {
        navigate('/minhas-obras', { replace: true });
      }
    }
  }, [isAuthenticated, role, isStaff, isCustomer, authLoading, roleLoading, navigate]);

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
