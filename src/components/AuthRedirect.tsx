import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { debugNav } from "@/lib/debugAuth";

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
  const { data: projects = [], isLoading: projectsLoading } =
    useProjectsQuery();

  // Track if we've already done the initial redirect to prevent re-triggers
  // Also track the user roles to reset on user change (logout/login)
  const hasRedirected = useRef(false);
  const lastAuthState = useRef<{ isAuthenticated: boolean; roles: string[] }>({
    isAuthenticated: false,
    roles: [],
  });

  useEffect(() => {
    if (authLoading || roleLoading || projectsLoading) {
      debugNav("AuthRedirect: still loading", {
        authLoading,
        roleLoading,
        projectsLoading,
      });
      return;
    }

    // BUG FIX: Reset redirect flag when auth state changes (logout/login with different user)
    const rolesKey = roles.join(",");
    const prevRolesKey = lastAuthState.current.roles.join(",");
    const hasAuthChanged =
      lastAuthState.current.isAuthenticated !== isAuthenticated ||
      prevRolesKey !== rolesKey;

    if (hasAuthChanged) {
      debugNav("AuthRedirect: auth state changed, resetting redirect flag", {
        previous: lastAuthState.current,
        current: { isAuthenticated, roles },
      });
      hasRedirected.current = false;
      lastAuthState.current = { isAuthenticated, roles };
    }

    // Prevent multiple redirects for same auth state
    if (hasRedirected.current) {
      debugNav(
        "AuthRedirect: already redirected for this auth state, skipping",
      );
      return;
    }

    // Only redirect if we're on the root path "/" AND authenticated
    // This prevents redirect loops from other routes
    if (isAuthenticated && roles.length > 0 && location.pathname === "/") {
      debugNav("AuthRedirect: performing role-based redirect", {
        roles,
        isStaff,
        isCustomer,
      });

      hasRedirected.current = true;

      // Staff with a single active project → go directly to that project
      if (isStaff) {
        const activeProjects = projects.filter((p) => p.status === "active");
        if (activeProjects.length === 1) {
          debugNav(
            "AuthRedirect: single active project, redirecting directly",
            { projectId: activeProjects[0].id },
          );
          navigate(`/obra/${activeProjects[0].id}`, { replace: true });
        } else {
          navigate("/gestao", { replace: true });
        }
      } else if (isCustomer) {
        navigate("/minhas-obras", { replace: true });
      }
    }
  }, [
    isAuthenticated,
    roles,
    isStaff,
    isCustomer,
    authLoading,
    roleLoading,
    projectsLoading,
    projects,
    navigate,
    location.pathname,
  ]);

  // Show loading while checking auth
  if (authLoading || roleLoading || projectsLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-label="Carregando"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  return null;
}
