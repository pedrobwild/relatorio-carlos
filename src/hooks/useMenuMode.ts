/**
 * useMenuMode — decide se o menu de gestão aparece no modo simples
 * (Obras / Semana / Hoje) ou completo. Ver regras em `@/lib/menuMode`.
 */

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { useFeatureFlags } from "./useFeatureFlags";
import {
  defaultMenuMode,
  readMenuModeOverride,
  resolveMenuMode,
  writeMenuModeOverride,
  type MenuMode,
} from "@/lib/menuMode";

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function useMenuMode() {
  const { user } = useAuth();
  const { roles, loading: rolesLoading } = useUserRole();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const userId = user?.id ?? null;

  const [override, setOverrideState] = useState<MenuMode | null>(() =>
    readMenuModeOverride(getStorage(), userId),
  );

  const flagEnabled = isEnabled("simpleModeGestor");
  const defaultMode = useMemo(
    () => defaultMenuMode({ flagEnabled, roles }),
    [flagEnabled, roles],
  );
  const mode = useMemo(
    () => resolveMenuMode({ flagEnabled, roles, override }),
    [flagEnabled, roles, override],
  );

  const setMode = useCallback(
    (next: MenuMode) => {
      // Voltar ao padrão limpa o override, para acompanhar mudanças de flag/papel.
      const value: MenuMode | null = next === defaultMode ? null : next;
      writeMenuModeOverride(getStorage(), userId, value);
      setOverrideState(value);
    },
    [defaultMode, userId],
  );

  return {
    mode,
    isSimple: mode === "simple",
    defaultMode,
    /** Só oferece o alternador para quem tem o modo simples como padrão. */
    canToggle: defaultMode === "simple",
    setMode,
    isLoading: rolesLoading || flagsLoading,
  };
}
