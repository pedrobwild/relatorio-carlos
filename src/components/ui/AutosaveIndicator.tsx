import { Check, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface AutosaveIndicatorProps {
  /** When the latest autosave happened. */
  lastSavedAt: Date | null;
  /** Optional flag while a network/storage write is in progress. */
  saving?: boolean;
  className?: string;
}

/**
 * Inline status: "Salvando..." → "Rascunho salvo agora" → "Rascunho salvo há 2 min".
 * Use inside dialog footers/headers where the user is filling in long forms.
 */
export function AutosaveIndicator({
  lastSavedAt,
  saving,
  className = "",
}: AutosaveIndicatorProps) {
  const [, setTick] = useState(0);

  // Refresh relative time every 30s
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  if (saving) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando rascunho…
      </span>
    );
  }

  if (!lastSavedAt) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 ${className}`}
      >
        <RefreshCw className="h-3 w-3" />
        Salvamento automático ativo
      </span>
    );
  }

  const diffMs = Date.now() - lastSavedAt.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const label =
    minutes < 1
      ? "Rascunho salvo agora"
      : minutes === 1
        ? "Rascunho salvo há 1 min"
        : `Rascunho salvo há ${minutes} min`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
    >
      <Check className="h-3 w-3 text-[hsl(var(--success))]" />
      {label}
    </span>
  );
}
