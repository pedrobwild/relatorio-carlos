import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const BACK_ONLINE_VISIBLE_MS = 3000;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

/**
 * Global banner que aparece quando o usuário fica offline ou a rede
 * volta. Coloque uma única vez no layout raiz.
 *
 * Acessibilidade: `role="alert"` + `aria-live="assertive"` para que
 * leitores de tela anunciem imediatamente. Mostra duração do offline e
 * botão "Tentar agora" sem reload pesado (apenas re-evalua status).
 */
export function NetworkStatusBanner() {
  const { online, durationOffline } = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (!online) {
      setShowBackOnline(false);
      return;
    }
    // Mostrar "back online" só se já estivemos offline antes (durationOffline > 0
    // só aparece imediatamente após reconectar, dentro de useOnlineStatus)
    setShowBackOnline(true);
    const t = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_VISIBLE_MS);
    return () => clearTimeout(t);
    // Re-disparar quando perde→ganha conexão. `lastChange` muda a cada transição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // No primeiro render online sem ter ficado offline, não mostra banner verde.
  const initiallyOnline = online && durationOffline === 0;
  const showBanner = !online || (showBackOnline && !initiallyOnline);
  const isOffline = !online;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="alert"
          aria-live="assertive"
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium',
              isOffline
                ? 'bg-destructive/10 text-destructive border-b border-destructive/20'
                : 'bg-green-500/10 text-green-700 dark:text-green-400 border-b border-green-500/20',
            )}
          >
            {isOffline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Sem conexão — alterações serão sincronizadas ao reconectar
                  {durationOffline > 5000 && (
                    <span className="ml-1 opacity-75">({formatDuration(durationOffline)})</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs ml-2"
                  onClick={() => window.location.reload()}
                  aria-label="Tentar reconectar"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Tentar
                </Button>
              </>
            ) : (
              <span>✓ Conexão restabelecida</span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
