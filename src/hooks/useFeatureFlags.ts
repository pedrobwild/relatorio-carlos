/**
 * Hook for DB-backed feature flags.
 *
 * Flags are fetched once and cached for 10 minutes.
 * Falls back to `FLAG_DEFAULTS` (or `false`) for unknown keys.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { FeatureFlagKey } from "@/types/permissions";

const FLAG_QUERY_KEY = ["feature-flags"] as const;

/**
 * Valor usado enquanto as flags carregam, se a consulta falhar ou se a linha
 * não existir no banco. Só entram aqui flags que nascem ligadas: sem isso o
 * "ligada por padrão" dependia de a linha existir e o gestor via o menu
 * completo piscar a cada carregamento. A linha no banco continua mandando
 * (desligar lá desliga aqui).
 */
export const FLAG_DEFAULTS: Partial<Record<FeatureFlagKey, boolean>> = {
  simpleModeGestor: true,
  // Painel de Obras reformulado em /gestao/painel-obras. Desligar a linha no
  // banco devolve o painel antigo para todos, sem publicar.
  painelReformulado: true,
};

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
   * While loading or if the flag doesn't exist, returns its default
   * (`FLAG_DEFAULTS`), otherwise `false`.
   */
  function isEnabled(key: FeatureFlagKey): boolean {
    return flags[key] ?? FLAG_DEFAULTS[key] ?? false;
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
