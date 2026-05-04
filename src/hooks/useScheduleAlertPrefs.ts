/**
 * Schedule Alert Preferences
 *
 * Apenas uma preferência local: mostrar ou ocultar o badge global de alertas
 * de cronograma na barra de navegação. As notificações in-app reais vivem em
 * `useNotifications`; este toggle controla apenas o indicador discreto na
 * sidebar (e o badge no link "Alertas" dentro do Cronograma da obra).
 */
import { useCallback, useEffect, useState } from "react";

export interface ScheduleAlertPrefs {
  showBadge: boolean;
}

const STORAGE_KEY = "schedule_alert_prefs_v2";

const DEFAULT_PREFS: ScheduleAlertPrefs = {
  showBadge: true,
};

function readPrefs(): ScheduleAlertPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ScheduleAlertPrefs>;
    return { showBadge: parsed.showBadge ?? DEFAULT_PREFS.showBadge };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useScheduleAlertPrefs() {
  const [prefs, setPrefs] = useState<ScheduleAlertPrefs>(() => readPrefs());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(readPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: ScheduleAlertPrefs) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / privacy errors
    }
  }, []);

  const setShowBadge = useCallback(
    (showBadge: boolean) => persist({ ...prefs, showBadge }),
    [prefs, persist],
  );

  return { prefs, setShowBadge };
}
