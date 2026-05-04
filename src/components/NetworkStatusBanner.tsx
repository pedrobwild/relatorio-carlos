import { useState, useEffect } from'react';
import { WifiOff, RefreshCw } from'lucide-react';
import { Button } from'@/components/ui/button';
import { cn } from'@/lib/utils';
import { motion, AnimatePresence } from'framer-motion';

/**
 * Global banner that appears when the user goes offline or network is unstable.
 * Place once in the app root layout.
 */
export function NetworkStatusBanner() {
 const [isOffline, setIsOffline] = useState(!navigator.onLine);
 const [wasOffline, setWasOffline] = useState(false);

 useEffect(() => {
 let backOnlineTimer: ReturnType<typeof setTimeout> | null = null;
 const goOffline = () => { setIsOffline(true); setWasOffline(true); };
 const goOnline = () => {
 setIsOffline(false);
 // Show"back online" briefly — track the timer so we can cancel it on unmount.
 backOnlineTimer = setTimeout(() => setWasOffline(false), 3000);
 };

 window.addEventListener('online', goOnline);
 window.addEventListener('offline', goOffline);
 return () => {
 window.removeEventListener('online', goOnline);
 window.removeEventListener('offline', goOffline);
 if (backOnlineTimer) clearTimeout(backOnlineTimer);
 };
 }, []);

 const showBanner = isOffline || wasOffline;

 return (
 <AnimatePresence>
 {showBanner && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}
 role="alert"
 aria-live="assertive"
 className="overflow-hidden"
 >
 <div className={cn(
'flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium',
 isOffline
 ?'bg-destructive/10 text-destructive border-b border-destructive/20'
 :'bg-green-500/10 text-green-700 border-b border-green-500/20'
 )}>
 {isOffline ? (
 <>
 <WifiOff className="h-3.5 w-3.5 shrink-0" />
 <span>Sem conexão — alterações serão sincronizadas ao reconectar</span>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs ml-2"
 onClick={() => window.location.reload()}
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
