import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { debugAuth } from "@/lib/debugAuth";
import { logError, logInfo } from "@/lib/errorLogger";

export type AppRole =
  | "engineer"
  | "admin"
  | "customer"
  | "manager"
  | "suprimentos"
  | "financeiro"
  | "gestor"
  | "cs"
  | "arquitetura";

interface UserRoleState {
  roles: AppRole[];
  /** @deprecated Use roles array instead. Returns the first/primary role for backwards compatibility */
  role: AppRole | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isManager: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

// Cache roles by user ID to prevent refetches on re-mounts
const roleCache = new Map<string, AppRole[]>();

// Track pending fetches to prevent duplicate concurrent requests
const pendingFetches = new Set<string>();

export function useUserRole(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>(() => {
    // Check cache on initial mount
    if (user?.id && roleCache.has(user.id)) {
      return roleCache.get(user.id) ?? [];
    }
    return [];
  });
  const [loading, setLoading] = useState(true);

  // Use ref to track if component is mounted
  const isMounted = useRef(true);

  const fetchRoles = useCallback(async (userId: string) => {
    // Prevent duplicate fetches for the same user
    if (pendingFetches.has(userId)) {
      debugAuth("useUserRole: fetch already in progress", { userId });
      return;
    }

    // Check cache first (double-check in case it was set between renders)
    if (roleCache.has(userId)) {
      const cachedRoles = roleCache.get(userId)!;
      debugAuth("useUserRole: using cached roles", {
        userId,
        roles: cachedRoles,
      });
      if (isMounted.current) {
        setRoles(cachedRoles);
        setLoading(false);
      }
      return;
    }

    pendingFetches.add(userId);
    debugAuth("useUserRole: fetching roles", { userId });

    try {
      // Fetch ALL roles for the user (not just single)
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!isMounted.current) {
        pendingFetches.delete(userId);
        return;
      }

      if (error) {
        logError("Error fetching user roles", error, {
          component: "useUserRole",
          userId,
        });
        const defaultRoles: AppRole[] = ["customer"];
        setRoles(defaultRoles);
        roleCache.set(userId, defaultRoles);
      } else {
        const fetchedRoles = (data || []).map((r) => r.role as AppRole);
        // If no roles found, default to customer
        const finalRoles =
          fetchedRoles.length > 0 ? fetchedRoles : (["customer"] as AppRole[]);
        setRoles(finalRoles);
        roleCache.set(userId, finalRoles);
        logInfo("User roles fetched", { userId, roles: finalRoles });
        debugAuth("useUserRole: roles fetched", { userId, roles: finalRoles });
      }
    } catch (err) {
      logError("Unexpected error in useUserRole", err, {
        component: "useUserRole",
        userId,
      });
      if (isMounted.current) {
        const defaultRoles: AppRole[] = ["customer"];
        setRoles(defaultRoles);
        roleCache.set(userId, defaultRoles);
      }
    } finally {
      pendingFetches.delete(userId);
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    if (authLoading) return;

    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    // Check cache synchronously first
    if (roleCache.has(user.id)) {
      const cachedRoles = roleCache.get(user.id)!;
      setRoles(cachedRoles);
      setLoading(false);
      return;
    }

    // Fetch roles if not cached
    fetchRoles(user.id);

    return () => {
      isMounted.current = false;
    };
  }, [user?.id, authLoading, fetchRoles]);

  // Helper functions
  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback(
    (checkRoles: AppRole[]) => checkRoles.some((r) => roles.includes(r)),
    [roles],
  );

  // Compute derived states based on all roles
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isStaff =
    roles.includes("engineer") ||
    isAdmin ||
    isManager ||
    roles.includes("gestor") ||
    roles.includes("suprimentos") ||
    roles.includes("financeiro") ||
    roles.includes("cs") ||
    roles.includes("arquitetura");
  const isCustomer = roles.includes("customer");

  return {
    roles,
    // Backwards compatibility: return first role (prioritize staff roles)
    role: isAdmin
      ? "admin"
      : isManager
        ? "manager"
        : roles.includes("engineer")
          ? "engineer"
          : roles[0] || null,
    loading: loading || authLoading,
    isStaff,
    isAdmin,
    isCustomer,
    isManager,
    hasRole,
    hasAnyRole,
  };
}

// Export function to clear cache (useful for testing or logout)
export function clearRoleCache(): void {
  roleCache.clear();
  pendingFetches.clear();
}
