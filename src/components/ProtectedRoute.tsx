import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { debugNav } from '@/lib/debugAuth';

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
  const { roles, hasAnyRole, isStaff, isCustomer, loading: roleLoading } = useUserRole();
  const location = useLocation();

  // Show nothing while loading - NEVER redirect during loading state
  if (authLoading || roleLoading) {
    debugNav('ProtectedRoute: loading', { authLoading, roleLoading, path: location.pathname });
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando autenticação">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="sr-only">Verificando autenticação...</span>
      </div>
    );
  }

  // Redirect if not authenticated, preserving the original destination
  if (!isAuthenticated) {
    debugNav('ProtectedRoute: not authenticated, redirecting to auth', { 
      from: location.pathname 
    });
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // Check role if specified - user needs at least ONE of the allowed roles
  if (allowedRoles && roles.length > 0 && !hasAnyRole(allowedRoles)) {
    debugNav('ProtectedRoute: no matching role', { 
      userRoles: roles, 
      allowedRoles, 
      path: location.pathname 
    });
    // Redirect based on highest priority role
    if (isStaff) {
      return <Navigate to="/gestao" replace />;
    } else if (isCustomer) {
      return <Navigate to="/minhas-obras" replace />;
    }
  }

  debugNav('ProtectedRoute: access granted', { 
    roles, 
    path: location.pathname 
  });

  return <>{children}</>;
}

// Staff: engineers, managers, and admins - can manage projects
export function StaffRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['engineer', 'manager', 'admin']}>
      {children}
    </ProtectedRoute>
  );
}

// Manager: managers and admins - can supervise engineers and view all org projects
export function ManagerRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['manager', 'admin']}>
      {children}
    </ProtectedRoute>
  );
}

// Customer: read-only access to assigned projects
export function CustomerRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['customer']}>
      {children}
    </ProtectedRoute>
  );
}

// Admin: full system access including user management
export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      {children}
    </ProtectedRoute>
  );
}
