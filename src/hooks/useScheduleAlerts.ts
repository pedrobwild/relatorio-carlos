/**
 * Schedule Alerts Hook
 *
 * Lista atividades de cronograma com pendências de sinalização:
 * - Início não sinalizado: planned_start já passou e actual_start IS NULL
 * - Término não sinalizado: planned_end vencido (depois das 18h do dia previsto)
 *   e actual_end IS NULL
 *
 * Otimizações:
 * - Janela limitada (180 dias para trás) reduz drasticamente o payload em bases grandes.
 * - `select` enxuto, `placeholderData: keepPreviousData` evita "piscar" durante refetch.
 * - `refetchOnWindowFocus` respeita visibilidade (não refaz quando aba está oculta).
 * - Mutações otimistas: a linha some imediatamente da lista; rollback em erro.
 * - Hook leve `useScheduleAlertsSummary` reutiliza o mesmo cache para o badge global,
 *   sem disparar refetches independentes.
 */

import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
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

export interface ScheduleAlertSummary {
  total: number;
  missingStart: number;
  missingEnd: number;
  projects: number;
}

const END_OF_DAY_HOUR = 18;
const LOOKBACK_DAYS = 180;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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

    if (!row.actual_start && plannedStart < today) {
      kinds.push("missing_start");
    }

    if (!row.actual_end) {
      const endIsBeforeToday = plannedEnd < today;
      const endIsTodayAfter18 =
        row.planned_end === todayStr && localNowHour >= END_OF_DAY_HOUR;
      if (endIsBeforeToday || endIsTodayAfter18) {
        kinds.push("missing_end");
      }
    }

    if (kinds.length === 0) continue;

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

  alerts.sort((a, b) => {
    if (a.days_overdue !== b.days_overdue)
      return b.days_overdue - a.days_overdue;
    return a.project_name.localeCompare(b.project_name, "pt-BR");
  });

  return alerts;
}

function computeSummary(alerts: ScheduleAlertActivity[]): ScheduleAlertSummary {
  let missingStart = 0;
  let missingEnd = 0;
  const projects = new Set<string>();
  for (const a of alerts) {
    if (a.kinds.includes("missing_start")) missingStart += 1;
    if (a.kinds.includes("missing_end")) missingEnd += 1;
    projects.add(a.project_id);
  }
  return {
    total: alerts.length,
    missingStart,
    missingEnd,
    projects: projects.size,
  };
}

export function useScheduleAlerts() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.activities.alerts();

  const {
    data: alerts = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const today = todayISO();
      const lookback = isoDaysAgo(LOOKBACK_DAYS);

      // Janela limitada: ignora atividades muito antigas (provavelmente esquecidas
      // ou fora do escopo executivo). Reduz payload sem mudar a regra de negócio.
      const { data, error: queryError } = await supabase
        .from("project_activities")
        .select(
          "id, project_id, description, etapa, planned_start, planned_end, actual_start, actual_end, projects:project_id(id, name)",
        )
        .gte("planned_start", lookback)
        .or(
          `and(actual_start.is.null,planned_start.lte.${today}),and(actual_end.is.null,planned_end.lte.${today})`,
        )
        .order("planned_start", { ascending: true })
        .limit(500);

      if (queryError) throw queryError;

      return deriveAlerts((data ?? []) as never, new Date());
    },
    staleTime: 1000 * 60 * 2, // 2 min — dados não mudam tão rápido
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: "always",
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  /** Atualização otimista: remove a linha; em erro, restaura. */
  const optimisticRemove = (activityId: string) => {
    const previous =
      queryClient.getQueryData<ScheduleAlertActivity[]>(queryKey) ?? [];
    queryClient.setQueryData<ScheduleAlertActivity[]>(
      queryKey,
      previous.filter((a) => a.id !== activityId),
    );
    return previous;
  };

  const markStarted = useMutation({
    mutationFn: async (activityId: string) => {
      const today = todayISO();
      const { error: updateError } = await supabase
        .from("project_activities")
        .update({ actual_start: today })
        .eq("id", activityId);
      if (updateError) throw updateError;
      return activityId;
    },
    onMutate: async (activityId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = optimisticRemove(activityId);
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Erro ao sinalizar início");
    },
    onSuccess: (activityId) => {
      toast.success("Início sinalizado");
      const cached =
        queryClient.getQueryData<ScheduleAlertActivity[]>(queryKey);
      const projectId = cached?.find((a) => a.id === activityId)?.project_id;
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      if (projectId) invalidateActivityQueries(projectId, activityId);
    },
  });

  const markCompleted = useMutation({
    mutationFn: async (activityId: string) => {
      const today = todayISO();
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
      return activityId;
    },
    onMutate: async (activityId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = optimisticRemove(activityId);
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Erro ao concluir atividade");
    },
    onSuccess: (activityId) => {
      toast.success("Atividade marcada como concluída");
      const cached =
        queryClient.getQueryData<ScheduleAlertActivity[]>(queryKey);
      const projectId = cached?.find((a) => a.id === activityId)?.project_id;
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      if (projectId) invalidateActivityQueries(projectId, activityId);
    },
  });

  const summary = useMemo(() => computeSummary(alerts), [alerts]);

  return {
    alerts,
    summary,
    isLoading,
    isFetching,
    error,
    refetch,
    markStarted,
    markCompleted,
  };
}

/**
 * Versão "leve" para badges/sinos globais. Compartilha o mesmo queryKey,
 * portanto reutiliza o cache do hook principal sem disparar fetches paralelos.
 */
export function useScheduleAlertsSummary(): ScheduleAlertSummary & {
  isLoading: boolean;
} {
  const queryKey = queryKeys.activities.alerts();
  const { data: alerts = [], isLoading } = useQuery({
    queryKey,
    // Não define queryFn aqui: depende do hook principal estar montado em algum
    // ponto da árvore. Se não houver, o cache fica vazio (summary = 0) — aceitável
    // para um indicador acessório.
    enabled: true,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const today = todayISO();
      const lookback = isoDaysAgo(LOOKBACK_DAYS);
      const { data, error: queryError } = await supabase
        .from("project_activities")
        .select(
          "id, project_id, description, etapa, planned_start, planned_end, actual_start, actual_end, projects:project_id(id, name)",
        )
        .gte("planned_start", lookback)
        .or(
          `and(actual_start.is.null,planned_start.lte.${today}),and(actual_end.is.null,planned_end.lte.${today})`,
        )
        .order("planned_start", { ascending: true })
        .limit(500);
      if (queryError) throw queryError;
      return deriveAlerts((data ?? []) as never, new Date());
    },
  });
  return { ...computeSummary(alerts), isLoading };
}
