/**
 * useOnlineStatus — escuta `online`/`offline` do browser e expõe contexto rico.
 *
 * Retorna:
 *  - online:           bool — estado atual da conexão
 *  - lastChange:       Date — momento da última transição (para UI/timer)
 *  - durationOffline:  ms   — quanto tempo está offline (0 quando online)
 *  - persistentOffline:bool — true quando offline há mais de `persistentThresholdMs` (default 30s)
 *
 * Use junto com `useCanPerform` para travar ações destrutivas em offline persistente.
 */
import { useEffect, useState } from 'react';

export interface OnlineStatus {
  online: boolean;
  lastChange: Date;
  durationOffline: number;
  persistentOffline: boolean;
}

interface Options {
  /** Tempo (ms) para considerar offline "persistente". Default: 30s. */
  persistentThresholdMs?: number;
  /** Frequência do tick que atualiza `durationOffline`. Default: 1s. */
  tickIntervalMs?: number;
}

function getInitialOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function useOnlineStatus(options: Options = {}): OnlineStatus {
  const { persistentThresholdMs = 30_000, tickIntervalMs = 1_000 } = options;

  const [online, setOnline] = useState<boolean>(getInitialOnline);
  const [lastChange, setLastChange] = useState<Date>(() => new Date());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setLastChange(new Date());
    };
    const goOffline = () => {
      setOnline(false);
      setLastChange(new Date());
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Tick para atualizar durationOffline / persistentOffline em tempo real.
  useEffect(() => {
    if (online) return;
    const id = window.setInterval(() => setNow(Date.now()), tickIntervalMs);
    return () => window.clearInterval(id);
  }, [online, tickIntervalMs]);

  const durationOffline = online ? 0 : Math.max(0, now - lastChange.getTime());
  const persistentOffline = !online && durationOffline >= persistentThresholdMs;

  return { online, lastChange, durationOffline, persistentOffline };
}
