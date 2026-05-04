import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePendencias, getStatus } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";

const APPROVAL_TYPES = new Set([
  "approval_3d",
  "approval_exec",
  "decision",
  "extra_purchase",
]);

interface FloatingApprovalBannerProps {
  projectId?: string;
}

export function FloatingApprovalBanner({
  projectId,
}: FloatingApprovalBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { sortedItems } = usePendencias({ projectId });
  const { paths } = useProjectNavigation();
  const reducedMotion = useReducedMotionSafe();

  // Only show for urgent/overdue approval-type items
  const urgentApprovals = sortedItems.filter((item) => {
    if (!APPROVAL_TYPES.has(item.type)) return false;
    if (!item.dueDate) return false;
    const s = getStatus(item.dueDate);
    return s === "atrasado" || s === "urgente";
  });

  if (dismissed || urgentApprovals.length === 0) return null;

  const hasOverdue = urgentApprovals.some(
    (i) => i.dueDate && getStatus(i.dueDate) === "atrasado",
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={reducedMotion ? false : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", damping: 25, stiffness: 300 }
        }
        className={cn(
          "fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50",
          "max-w-md w-[calc(100%-2rem)]",
          "bg-card border rounded-xl shadow-lg px-4 py-3",
          hasOverdue
            ? "border-destructive/40 shadow-destructive/10"
            : "border-warning/40 shadow-warning/10",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
              hasOverdue
                ? "bg-destructive/15 text-destructive"
                : "bg-warning/15 text-[hsl(var(--warning))]",
            )}
          >
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {urgentApprovals.length === 1
                ? "Aprovação pendente"
                : `${urgentApprovals.length} aprovações pendentes`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {urgentApprovals[0].title}
              {urgentApprovals.length > 1 &&
                ` e mais ${urgentApprovals.length - 1}`}
            </p>
          </div>

          <Link to={paths.pendencias}>
            <Button
              size="sm"
              variant={hasOverdue ? "destructive" : "default"}
              className="gap-1 shrink-0"
            >
              Ver
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>

          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pulsing dot */}
        {hasOverdue && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
