import { useMemo, useCallback } from "react";
import { useUserRole } from "./useUserRole";
import { canAny, canAll, type Feature } from "@/config/permissions";

/**
 * Hook to check feature permissions based on user roles
 */
export function useCan() {
  const { roles, loading } = useUserRole();

  /**
   * Check if user can perform a single feature
   */
  const userCan = useCallback(
    (feature: Feature): boolean => {
      if (loading) return false;
      return canAny(roles, feature);
    },
    [roles, loading],
  );

  /**
   * Check if user can perform ALL features
   */
  const userCanAll = useCallback(
    (features: Feature[]): boolean => {
      if (loading) return false;
      return canAll(roles, features);
    },
    [roles, loading],
  );

  /**
   * Check if user can perform ANY of the features
   */
  const userCanAny = useCallback(
    (features: Feature[]): boolean => {
      if (loading) return false;
      return features.some((feature) => canAny(roles, feature));
    },
    [roles, loading],
  );

  return {
    can: userCan,
    canAll: userCanAll,
    canAny: userCanAny,
    loading,
  };
}

/**
 * Simple hook for checking a single permission
 * @param feature The feature to check
 * @returns boolean indicating if user has permission
 */
export function useCanFeature(feature: Feature): boolean {
  const { roles, loading } = useUserRole();

  return useMemo(() => {
    if (loading) return false;
    return canAny(roles, feature);
  }, [roles, loading, feature]);
}
