/**
 * useDailyLogTodayCoverage — cobertura de RDO de hoje por obra (staff).
 *
 * Retorna, para cada projectId em `projectIds`, se já existe um
 * `project_daily_logs` com data = hoje (fuso local do usuário).
 * Usado no card compacto "Diários de hoje" da tela Minha Semana.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface DailyLogCoverageRow {
  projectId: string;
  hasLog: boolean;
  logId: string | null;
  updatedAt: string | null;
}

export function useDailyLogTodayCoverage(projectIds: string[] | undefined) {
  const date = useMemo(() => todayIso(), []);
  const ids = useMemo(
    () => (projectIds ? [...projectIds].filter(Boolean) : []),
    [projectIds],
  );

  const q = useQuery({
    queryKey: queryKeys.diario.todayCoverage(ids, date),
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<DailyLogCoverageRow[]> => {
      const { data, error } = await supabase
        .from("project_daily_logs")
        .select("id, project_id, updated_at")
        .in("project_id", ids)
        .eq("log_date", date);
      if (error) throw error;
      const byId = new Map(
        (data ?? []).map((r) => [
          r.project_id as string,
          { id: r.id as string, updated_at: r.updated_at as string | null },
        ]),
      );
      return ids.map((pid) => {
        const hit = byId.get(pid);
        return {
          projectId: pid,
          hasLog: !!hit,
          logId: hit?.id ?? null,
          updatedAt: hit?.updated_at ?? null,
        };
      });
    },
  });

  return {
    date,
    rows: q.data ?? [],
    isLoading: q.isLoading,
    filled: (q.data ?? []).filter((r) => r.hasLog).length,
    total: ids.length,
  };
}
