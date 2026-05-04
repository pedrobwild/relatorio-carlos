export type PortalViewState = {
  activeTab?: string;
  weeklyReport?: {
    open?: boolean;
    index?: number;
  };
};

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
