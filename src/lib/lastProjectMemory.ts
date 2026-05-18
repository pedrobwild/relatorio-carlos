/**
 * Persists the last visited projectId so the mobile bottom nav can return
 * the user to their previous obra after navigating to a global route
 * (e.g. /gestao/painel-obras, /gestao/atividades).
 */
const KEY = "bwild:lastProjectId";

export function rememberLastProjectId(projectId: string | undefined | null) {
  if (!projectId) return;
  try {
    localStorage.setItem(KEY, projectId);
  } catch {
    /* storage disabled — ignore */
  }
}

export function getLastProjectId(): string | undefined {
  try {
    return localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function clearLastProjectId() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
