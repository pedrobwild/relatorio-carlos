/**
 * Hook for DB-backed feature flags.
 *
 * Flags are fetched once and cached for 10 minutes.
 * Falls back to `false` for unknown keys.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { FeatureFlagKey } from "@/types/permissions";

const FLAG_QUERY_KEY = ["feature-flags"] as const;

async function fetchFlags(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled");

  if (error) throw error;

  const map: Record<string, boolean> = {};
  for (const row of data ?? []) {
    map[row.key] = row.enabled;
  }
  return map;
}

export function useFeatureFlags() {
  const { user } = useAuth();

  const { data: flags = {}, isLoading } = useQuery({
    queryKey: FLAG_QUERY_KEY,
    queryFn: fetchFlags,
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 min
    gcTime: 30 * 60 * 1000,
  });

  /**
   * Check if a feature flag is enabled.
   * Returns `false` while loading or if the flag doesn't exist.
   */
  function isEnabled(key: FeatureFlagKey): boolean {
    return flags[key] ?? false;
  }

  return { flags, isEnabled, isLoading };
}

/**
 * Simple single-flag hook for conditional rendering.
 */
export function useFlag(key: FeatureFlagKey): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(key);
}
