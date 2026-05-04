import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TabOnboardingTipProps {
  tabKey: string;
  message: string;
  className?: string;
}

const STORAGE_PREFIX = "onboarding_tip_dismissed_";

/**
 * Contextual onboarding tip shown once per tab on first visit.
 */
export function TabOnboardingTip({
  tabKey,
  message,
  className,
}: TabOnboardingTipProps) {
  const storageKey = `${STORAGE_PREFIX}${tabKey}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setVisible(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(storageKey, "1");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 mb-4",
            className,
          )}
        >
          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground flex-1 leading-relaxed">
            {message}
          </p>
          <button
            onClick={dismiss}
            className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label="Fechar dica"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
