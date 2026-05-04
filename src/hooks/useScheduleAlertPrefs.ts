/**
 * Schedule Alert Preferences
 *
 * Preferências de notificação por canal (in-app, e-mail, push) para os
 * Schedule Alerts. Persistido em localStorage por usuário (chave única por
 * navegador). Mantém retrocompatibilidade quando a chave não existe — o
 * padrão é apenas in-app habilitado.
 */
import { useCallback, useEffect, useState } from "react";

export type ScheduleAlertChannel = "inApp" | "email" | "push";

export interface ScheduleAlertPrefs {
  enabled: boolean;
  channels: Record<ScheduleAlertChannel, boolean>;
}

const STORAGE_KEY = "schedule_alert_prefs_v1";

const DEFAULT_PREFS: ScheduleAlertPrefs = {
  enabled: true,
  channels: { inApp: true, email: false, push: false },
};

function readPrefs(): ScheduleAlertPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ScheduleAlertPrefs>;
    return {
      enabled: parsed.enabled ?? DEFAULT_PREFS.enabled,
      channels: { ...DEFAULT_PREFS.channels, ...(parsed.channels ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useScheduleAlertPrefs() {
  const [prefs, setPrefs] = useState<ScheduleAlertPrefs>(() => readPrefs());

  // Sincroniza entre abas
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
      // ignore quota / privacy errors — estado em memória já foi atualizado
    }
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => persist({ ...prefs, enabled }),
    [prefs, persist],
  );

  const setChannel = useCallback(
    (channel: ScheduleAlertChannel, value: boolean) =>
      persist({ ...prefs, channels: { ...prefs.channels, [channel]: value } }),
    [prefs, persist],
  );

  return { prefs, setEnabled, setChannel };
}
