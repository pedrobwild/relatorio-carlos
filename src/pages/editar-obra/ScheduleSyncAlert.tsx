import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Activity } from "./types";

interface ScheduleSyncAlertProps {
  plannedStart: string | null;
  plannedEnd: string | null;
  activities: Activity[];
  onRecalculate?: () => void;
  isBusy?: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd 'de' MMM 'de' yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

/**
 * Alerta exibido em "Dados Gerais" quando as datas planejadas do projeto
 * não coincidem com as bordas das atividades do cronograma.
 * Indica que o usuário deve salvar para recalcular o cronograma (via ShiftModeDialog).
 */
export function ScheduleSyncAlert({
  plannedStart,
  plannedEnd,
  activities,
  onRecalculate,
  isBusy,
}: ScheduleSyncAlertProps) {
  const valid = activities.filter((a) => a.planned_start && a.planned_end);
  if (valid.length === 0) return null;
  if (!plannedStart && !plannedEnd) return null;

  const starts = valid.map((a) => parseISO(a.planned_start).getTime());
  const ends = valid.map((a) => parseISO(a.planned_end).getTime());
  const scheduleStart = format(new Date(Math.min(...starts)), "yyyy-MM-dd");
  const scheduleEnd = format(new Date(Math.max(...ends)), "yyyy-MM-dd");

  const startMismatch = !!plannedStart && plannedStart !== scheduleStart;
  const endMismatch = !!plannedEnd && plannedEnd !== scheduleEnd;
  if (!startMismatch && !endMismatch) return null;

  return (
    <Alert className="border-warning/40 bg-warning/5 text-warning-foreground">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">
        Cronograma desconectado das datas do projeto
      </AlertTitle>
      <AlertDescription className="space-y-3 mt-1">
        <p className="text-sm text-foreground/90">
          As datas planejadas em "Dados Gerais" não correspondem às bordas
          atuais do cronograma. Você pode recalcular agora ou ao salvar — em
          ambos os casos poderá escolher entre manter a duração de cada
          atividade ou encaixar tudo proporcionalmente na nova janela.
        </p>
        <ul className="text-xs space-y-1">
          {startMismatch && (
            <li>
              <span className="font-medium">Início:</span> projeto{" "}
              <span className="font-mono">{formatDate(plannedStart)}</span> ≠
              cronograma{" "}
              <span className="font-mono">{formatDate(scheduleStart)}</span>
            </li>
          )}
          {endMismatch && (
            <li>
              <span className="font-medium">Término:</span> projeto{" "}
              <span className="font-mono">{formatDate(plannedEnd)}</span> ≠
              cronograma{" "}
              <span className="font-mono">{formatDate(scheduleEnd)}</span>
            </li>
          )}
        </ul>
        {onRecalculate && (
          <div className="flex">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRecalculate}
              disabled={isBusy}
              className="gap-1.5 border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`}
              />
              Recalcular cronograma
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
