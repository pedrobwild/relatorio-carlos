import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity } from "@/types/report";
import { formatDateShort } from "./types";

interface Props {
  startDate: string | null;
  endDate: string | null;
  activities: Activity[];
  cronogramaPath?: string;
  canFix?: boolean;
}

/**
 * Exibe um aviso quando há inconsistências de datas no cronograma:
 * - Início previsto posterior ao Fim previsto (nível projeto)
 * - Atividades com plannedStart > plannedEnd
 */
export function ScheduleInconsistencyAlert({ startDate, endDate, activities, cronogramaPath, canFix }: Props) {
  const projectInverted = !!(startDate && endDate && startDate > endDate);

  const invertedActivities = activities.filter(
    (a) => a.plannedStart && a.plannedEnd && a.plannedStart > a.plannedEnd
  );

  if (!projectInverted && invertedActivities.length === 0) return null;

  return (
    <Alert
      variant="destructive"
      role="alert"
      className="mb-3 md:mb-4 border-destructive/40 bg-destructive/5"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">
        Inconsistências detectadas no cronograma
      </AlertTitle>
      <AlertDescription className="text-xs space-y-1.5 mt-1">
        {projectInverted && (
          <p>
            O <strong>Início previsto</strong> ({formatDateShort(startDate!)}) está depois do{" "}
            <strong>Fim previsto</strong> ({formatDateShort(endDate!)}). Revise as datas do
            projeto.
          </p>
        )}
        {invertedActivities.length > 0 && (
          <div>
            <p className="mb-1">
              {invertedActivities.length === 1
                ? "1 atividade com data de início posterior à data de fim:"
                : `${invertedActivities.length} atividades com data de início posterior à data de fim:`}
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {invertedActivities.slice(0, 5).map((a) => (
                <li key={a.id ?? a.description} className="truncate">
                  <span className="font-medium">{a.description}</span>{" "}
                  <span className="text-muted-foreground tabular-nums">
                    ({formatDateShort(a.plannedStart)} → {formatDateShort(a.plannedEnd)})
                  </span>
                </li>
              ))}
              {invertedActivities.length > 5 && (
                <li className="text-muted-foreground">
                  e mais {invertedActivities.length - 5}…
                </li>
              )}
            </ul>
          </div>
        )}
        {canFix && cronogramaPath && (
          <p className="pt-1">
            <a href={cronogramaPath} className="underline font-medium">
              Abrir cronograma para corrigir
            </a>
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
