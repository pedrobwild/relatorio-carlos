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
      // Staff roles (engineer, manager, admin) go to gestao
      return <Navigate to="/gestao" replace />;
    }
  }

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
