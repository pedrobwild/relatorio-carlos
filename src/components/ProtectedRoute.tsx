import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { debugNav } from "@/lib/debugAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  redirectTo = "/auth",
}: ProtectedRouteProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    roles,
    hasAnyRole,
    isStaff,
    isCustomer,
    loading: roleLoading,
  } = useUserRole();
  const location = useLocation();

  // Show nothing while loading - NEVER redirect during loading state
  if (authLoading || roleLoading) {
    debugNav("ProtectedRoute: loading", {
      authLoading,
      roleLoading,
      path: location.pathname,
    });
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background">
        {/* Skeleton header */}
        <div className="h-14 border-b border-border bg-card/95 flex items-center px-4 gap-3">
          <div className="h-6 w-6 rounded bg-muted animate-pulse" />
          <div className="h-1 w-px bg-border mx-1" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="flex-1" />
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        </div>
        {/* Skeleton sidebar + content */}
        <div className="flex">
          <div className="hidden md:block w-[220px] border-r border-border p-3 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 rounded bg-muted animate-pulse" />
            ))}
          </div>
          <div className="flex-1 p-6 space-y-4">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg bg-muted animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">Verificando autenticação...</span>
      </div>
    );
  }

  // Redirect if not authenticated, preserving the original destination
  if (!isAuthenticated) {
    debugNav("ProtectedRoute: not authenticated, redirecting to auth", {
      from: location.pathname,
    });
    return (
      <Navigate to={redirectTo} state={{ from: location.pathname }} replace />
    );
  }

  // Check role if specified - user needs at least ONE of the allowed roles
  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    debugNav("ProtectedRoute: no matching role", {
      userRoles: roles,
      allowedRoles,
      path: location.pathname,
    });
    // Redirect based on highest priority role
    if (isStaff) {
      return <Navigate to="/gestao" replace />;
    } else if (isCustomer) {
      return <Navigate to="/minhas-obras" replace />;
    }
  }

  debugNav("ProtectedRoute: access granted", {
    roles,
    path: location.pathname,
  });

  return <>{children}</>;
}

// Staff: engineers, managers, and admins - can manage projects
export function StaffRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute
      allowedRoles={[
        "engineer",
        "manager",
        "admin",
        "gestor",
        "suprimentos",
        "financeiro",
        "cs",
        "arquitetura",
      ]}
    >
      {children}
    </ProtectedRoute>
  );
}

// Manager: managers and admins - can supervise engineers and view all org projects
export function ManagerRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["manager", "admin"]}>
      {children}
    </ProtectedRoute>
  );
}

// Customer: read-only access to assigned projects
export function CustomerRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["customer"]}>{children}</ProtectedRoute>
  );
}

// Admin: full system access including user management
export function AdminRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute allowedRoles={["admin"]}>{children}</ProtectedRoute>;
}
