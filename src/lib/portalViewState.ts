export type PortalViewState = {
  activeTab?: string;
  weeklyReport?: {
    open?: boolean;
    index?: number;
    /**
     * weekNumber é o identificador semântico do relatório semanal e
     * sobrevive a mudanças de ordenação/quantidade de reports. Quando
     * presente, a restauração tenta casar por weekNumber primeiro e cai
     * pra index só como fallback (compat com estados antigos salvos).
     */
    weekNumber?: number;
  };
};

export function getPortalViewStateKey(projectId?: string | null): string {
  return `portal:view:${projectId ?? "sem-projeto"}`;
}

export function getPortalViewState(key: string): PortalViewState {
  if (typeof window === "undefined") return {};
  try {
    // Usamos localStorage (e não sessionStorage) porque alguns navegadores
    // podem limpar sessionStorage quando a aba é “descartada” (memory saver),
    // causando perda de estado e retorno para a aba padrão.
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PortalViewState;
  } catch {
    return {};
  }
}

export function setPortalViewState(key: string, state: PortalViewState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function patchPortalViewState(
  key: string,
  patch: Partial<PortalViewState>,
): PortalViewState {
  const current = getPortalViewState(key);
  const next: PortalViewState = {
    ...current,
    ...patch,
    weeklyReport: patch.weeklyReport
      ? { ...current.weeklyReport, ...patch.weeklyReport }
      : current.weeklyReport,
  };

  setPortalViewState(key, next);
  return next;
}
