import { useEffect, useState } from 'react';

export interface OnlineStatus {
  /** `true` quando o navegador reporta conexão. */
  online: boolean;
  /** Timestamp (ms) da última transição online↔offline. */
  lastChange: number;
  /** Há quanto tempo (ms) o usuário está offline. `0` se online. */
  durationOffline: number;
}

const initialOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

/**
 * Observa o status de conexão do navegador.
 *
 * Atualiza `durationOffline` a cada segundo enquanto offline para que
 * componentes possam reagir a "offline persistente" (ex.: desabilitar
 * ações destrutivas após 30s sem conexão).
 *
 * Em SSR / testes sem `window`, retorna estado online estável.
 */
export function useOnlineStatus(): OnlineStatus {
  const [state, setState] = useState<OnlineStatus>(() => ({
    online: initialOnline,
    lastChange: Date.now(),
    durationOffline: 0,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setState({ online: true, lastChange: Date.now(), durationOffline: 0 });
    };
    const handleOffline = () => {
      setState({ online: false, lastChange: Date.now(), durationOffline: 0 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Tick a cada 1s só enquanto offline para atualizar durationOffline
  useEffect(() => {
    if (state.online) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (prev.online) return prev;
        return { ...prev, durationOffline: Date.now() - prev.lastChange };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.online]);

  return state;
}
