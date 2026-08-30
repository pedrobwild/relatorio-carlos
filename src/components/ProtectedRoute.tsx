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
    error: roleError,
    sessionExpired,
    refetch: refetchRoles,
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

  // Sessão morta (a renovação já foi tentada e recusada). Não adianta oferecer
  // "tentar novamente" — isso era um beco sem saída: o retry repetia o mesmo
  // 401 para sempre. O caminho de saída é entrar na conta de novo.
  if (isAuthenticated && sessionExpired) {
    debugNav("ProtectedRoute: sessão expirada, indo para /auth", {
      path: location.pathname,
    });
    return (
      <Navigate to="/auth" state={{ from: location.pathname }} replace />
    );
  }

  // Falha ao LER as permissões (rede/RLS) — não sabemos o papel do usuário.
  // Nunca adivinhe: mandar um admin para o portal do cliente é pior do que
  // dizer a verdade e oferecer "tentar novamente".
  if (isAuthenticated && roleError) {
    debugNav("ProtectedRoute: falha ao carregar permissões", {
      path: location.pathname,
      message: roleError.message,
    });
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-body text-foreground">
            Não conseguimos confirmar suas permissões.
          </p>
          <p className="text-caption text-muted-foreground">
            Sua conexão pode ter caído ou sua sessão expirou. Tente novamente —
            se continuar, entre na sua conta outra vez.
          </p>
          <button
            type="button"
            onClick={refetchRoles}
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition"
          >
            Tentar novamente
          </button>
        </div>
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
    }
    if (isCustomer) {
      return <Navigate to="/minhas-obras" replace />;
    }
    // Autenticado mas sem nenhum papel permitido e sem perfil staff/customer:
    // nega por padrão em vez de cair no `return children` (não vazar conteúdo
    // protegido para usuários sem papel).
    return <Navigate to={redirectTo} replace />;
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
