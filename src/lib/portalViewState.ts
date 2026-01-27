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
    const raw = window.sessionStorage.getItem(key);
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
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function patchPortalViewState(
  key: string,
  patch: Partial<PortalViewState>
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
