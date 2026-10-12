/**
 * Linha de estado da fila offline na tela Hoje: sem sinal / enviando / tudo
 * enviado, e o que o servidor recusou (com o que fazer). Compacta e nunca
 * bloqueia a tela.
 */
import { AlertTriangle, CheckCircle2, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/lib/offline/syncStatus";

export interface SyncProblem {
  key: string;
  /** Ex.: `"Feito" de Pintura da sala`. */
  title: string;
  message: string;
  /** Recusa de foto: dá para tentar de novo. */
  onRetry?: () => void;
  /** Dispensar (confirmação) ou descartar a foto guardada. */
  onDismiss: () => void;
  dismissLabel: string;
}

interface Props {
  status: SyncStatus | null;
  problems: readonly SyncProblem[];
}

export function OfflineSyncBar({ status, problems }: Props) {
  if (!status && problems.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {status && (
        <p
          role="status"
          aria-live="polite"
          data-tone={status.tone}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
            status.tone === "offline" && "border-warning/40 bg-warning/10 text-foreground",
            status.tone === "sending" && "border-border bg-muted text-muted-foreground",
            status.tone === "done" && "border-success/30 bg-success/10 text-success",
          )}
        >
          {status.tone === "offline" && <CloudOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />}
          {status.tone === "sending" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
          {status.tone === "done" && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{status.text}</span>
        </p>
      )}

      {problems.length > 0 && (
        <ul
          aria-label="Registros não enviados"
          className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
        >
          {problems.map((p) => (
            <li key={p.key} className="flex flex-wrap items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">Não enviado: {p.title}</p>
                <p className="text-muted-foreground">{p.message}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {p.onRetry && (
                  <Button type="button" variant="outline" size="sm" className="min-h-[40px]" onClick={p.onRetry}>
                    Tentar de novo
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" className="min-h-[40px]" onClick={p.onDismiss}>
                  {p.dismissLabel}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
