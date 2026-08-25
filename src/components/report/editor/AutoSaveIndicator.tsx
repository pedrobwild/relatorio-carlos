import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Clock,
  CloudOff,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";


interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  retryInSeconds?: number | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Usa cores claras para fundos escuros (cabeçalho do editor). */
  onDark?: boolean;
}

const AutoSaveIndicator = ({
  status,
  lastSaved,
  retryInSeconds,
  errorMessage,
  onRetry,
  onDark = false,
}: AutoSaveIndicatorProps) => {
  const muted = onDark ? "text-white/70" : "text-muted-foreground";
  const ok = onDark ? "text-green-300" : "text-success";
  const bad = onDark ? "text-red-200" : "text-destructive";

  if (status === "saving") {
    return (
      <span
        className={`flex items-center gap-1.5 ${muted}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        Salvando…
      </span>
    );
  }

  if (status === "retrying" || status === "error") {
    const retrying = status === "retrying";
    return (
      <span
        className={`flex flex-wrap items-center gap-1.5 ${bad}`}
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          {retrying
            ? `Falha ao salvar. Nova tentativa em ${retryInSeconds ?? 0}s…`
            : `Não foi possível salvar${errorMessage ? `: ${errorMessage}` : "."} Suas alterações continuam na tela.`}
        </span>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant={onDark ? "outline" : "secondary"}
            onClick={onRetry}
            className={`h-8 px-2 ${onDark ? "bg-white/10 border-white/20 text-white hover:bg-white/20" : ""}`}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Tentar agora
          </Button>
        )}
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={`flex items-center gap-1.5 ${muted}`}
        role="status"
        aria-live="polite"
      >
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        Alterações não salvas
      </span>
    );
  }

  if (lastSaved) {
    return (
      <span
        className={`flex items-center gap-1.5 ${ok}`}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        Salvo às {format(lastSaved, "HH:mm", { locale: ptBR })}
      </span>
    );
  }

  return null;
};

export default AutoSaveIndicator;
