import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo = '/auth'
}: ProtectedRouteProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  // Show nothing while loading
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect if not authenticated, preserving the original destination
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // Check role if specified
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect based on role
    if (role === 'customer') {
      return <Navigate to="/minhas-obras" replace />;
    } else {
      return <Navigate to="/gestao" replace />;
    }
  }

  return <>{children}</>;
}

export function StaffRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['engineer', 'admin']}>
      {children}
    </ProtectedRoute>
  );
}

export function CustomerRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['customer']}>
      {children}
    </ProtectedRoute>
  );
}
