/**
 * Schedule Alerts Hook
 *
 * Lista atividades de cronograma com pendências de sinalização:
 * - Início não sinalizado: planned_start já passou e actual_start IS NULL
 * - Término não sinalizado: planned_end vencido (depois das 18h do dia previsto)
 *   e actual_end IS NULL
 *
 * Dados vêm da tabela project_activities (cf. useProjectActivities) com join
 * em projects(name). A query traz um superset e o filtro fino é aplicado em
 * memória para acomodar a regra das 18h sem complicar a SQL.
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys, invalidateActivityQueries } from "@/lib/queryKeys";

export type ScheduleAlertKind = "missing_start" | "missing_end";

export interface ScheduleAlertActivity {
  id: string;
  project_id: string;
  project_name: string;
  description: string;
  etapa: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  kinds: ScheduleAlertKind[];
  /** Inteiro de dias de atraso (>=1 quando há atraso real). */
  days_overdue: number;
}

const END_OF_DAY_HOUR = 18;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** YYYY-MM-DD → midnight UTC date */
function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveAlerts(
  rows: Array<{
    id: string;
    project_id: string;
    description: string;
    etapa: string | null;
    planned_start: string | null;
    planned_end: string | null;
    actual_start: string | null;
    actual_end: string | null;
    projects: { id: string; name: string } | null;
  }>,
  now: Date,
): ScheduleAlertActivity[] {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const localNowHour = now.getHours();
  const todayStr = today.toISOString().slice(0, 10);

  const alerts: ScheduleAlertActivity[] = [];

  for (const row of rows) {
    if (!row.planned_start || !row.planned_end) continue;

    const plannedStart = parseDateOnly(row.planned_start);
    const plannedEnd = parseDateOnly(row.planned_end);

    const kinds: ScheduleAlertKind[] = [];

    // Missing start: hoje passou da data prevista e ainda não há actual_start.
    // Regra: plannedStart < hoje (ou seja, virou pelo menos um dia).
    if (!row.actual_start && plannedStart < today) {
      kinds.push("missing_start");
    }

    // Missing end: actual_end ausente E
    //  - plannedEnd já passou (dia anterior), OU
    //  - é hoje e já são >= 18h
    if (!row.actual_end) {
      const endIsBeforeToday = plannedEnd < today;
      const endIsTodayAfter18 =
        row.planned_end === todayStr && localNowHour >= END_OF_DAY_HOUR;
      if (endIsBeforeToday || endIsTodayAfter18) {
        kinds.push("missing_end");
      }
    }

    if (kinds.length === 0) continue;

    // Dias de atraso: prioriza atraso de término; se ausente, usa atraso de início.
    const reference = kinds.includes("missing_end") ? plannedEnd : plannedStart;
    const days = Math.max(diffDays(today, reference), 0);

    alerts.push({
      id: row.id,
      project_id: row.project_id,
      project_name: row.projects?.name ?? "Obra sem nome",
      description: row.description,
      etapa: row.etapa,
      planned_start: row.planned_start,
      planned_end: row.planned_end,
      actual_start: row.actual_start,
      actual_end: row.actual_end,
      kinds,
      days_overdue: days,
    });
  }

  // Mais atrasado primeiro; em empate, alfabético por obra.
  alerts.sort((a, b) => {
    if (a.days_overdue !== b.days_overdue)
      return b.days_overdue - a.days_overdue;
    return a.project_name.localeCompare(b.project_name, "pt-BR");
  });

  return alerts;
}

export function useScheduleAlerts() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.activities.alerts();

  const {
    data: alerts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const today = todayISO();

      // Superset: atividades sem actual_end com planned_start <= hoje OU
      // sem actual_start com planned_start < hoje. Trazemos um pouco extra e
      // filtramos no cliente para aplicar a regra das 18h.
      const { data, error: queryError } = await supabase
        .from("project_activities")
        .select(
          "id, project_id, description, etapa, planned_start, planned_end, actual_start, actual_end, projects:project_id(id, name)",
        )
        .or(
          `and(actual_start.is.null,planned_start.lte.${today}),and(actual_end.is.null,planned_end.lte.${today})`,
        )
        .order("planned_start", { ascending: true });

      if (queryError) throw queryError;

      return deriveAlerts((data ?? []) as never, new Date());
    },
    staleTime: 1000 * 60, // 1 min
    refetchOnWindowFocus: true,
  });

  const markStarted = useMutation({
    mutationFn: async (activityId: string) => {
      const today = todayISO();
      const { error: updateError } = await supabase
        .from("project_activities")
        .update({ actual_start: today })
        .eq("id", activityId);
      if (updateError) throw updateError;
      return { activityId, projectId: undefined as string | undefined };
    },
    onSuccess: () => {
      toast.success("Início sinalizado");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
    },
    onError: () => toast.error("Erro ao sinalizar início"),
  });

  const markCompleted = useMutation({
    mutationFn: async (activityId: string) => {
      const today = todayISO();
      // Garante que actual_start exista antes de fechar.
      const { data: current, error: fetchError } = await supabase
        .from("project_activities")
        .select("actual_start")
        .eq("id", activityId)
        .single();
      if (fetchError) throw fetchError;

      const updates: { actual_end: string; actual_start?: string } = {
        actual_end: today,
      };
      if (!current?.actual_start) updates.actual_start = today;

      const { error: updateError } = await supabase
        .from("project_activities")
        .update(updates)
        .eq("id", activityId);
      if (updateError) throw updateError;
    },
    onSuccess: (_data, activityId) => {
      toast.success("Atividade marcada como concluída");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      // Best-effort: invalida cache por projeto se conhecido
      const cached =
        queryClient.getQueryData<ScheduleAlertActivity[]>(queryKey);
      const projectId = cached?.find((a) => a.id === activityId)?.project_id;
      if (projectId) invalidateActivityQueries(projectId, activityId);
    },
    onError: () => toast.error("Erro ao concluir atividade"),
  });

  const summary = useMemo(() => {
    const missingStart = alerts.filter((a) =>
      a.kinds.includes("missing_start"),
    ).length;
    const missingEnd = alerts.filter((a) =>
      a.kinds.includes("missing_end"),
    ).length;
    const projects = new Set(alerts.map((a) => a.project_id)).size;
    return { total: alerts.length, missingStart, missingEnd, projects };
  }, [alerts]);

  return {
    alerts,
    summary,
    isLoading,
    error,
    refetch,
    markStarted,
    markCompleted,
  };
}
