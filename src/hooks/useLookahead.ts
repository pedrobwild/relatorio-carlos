/**
 * useLookahead — janela de 14 ou 21 dias com todas as atividades de
 * cronograma que começam a partir de hoje nas obras acessíveis ao usuário
 * (RLS aplica o escopo automaticamente).
 *
 * Enriquecemos cada linha com o nome da obra e o nome do responsável para
 * evitar N+1 no componente. Agrupamos por semana ISO (segunda-feira como
 * ponto de partida) para o cockpit exibir "Semana de DD/MM".
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface LookaheadActivity {
  id: string;
  project_id: string;
  project_name: string;
  description: string;
  planned_start: string; // YYYY-MM-DD
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  weekKey: string; // segunda-feira ISO YYYY-MM-DD
  isOverdue: boolean;
  hasResponsible: boolean;
}

export interface LookaheadWeek {
  weekKey: string;
  weekStart: Date;
  activities: LookaheadActivity[];
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana ISO que contém `iso` (local). */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dow = d.getDay(); // 0=Dom .. 6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchLookahead(
  windowDays: number,
): Promise<LookaheadActivity[]> {
  const start = TODAY_ISO();
  const end = addDaysISO(start, windowDays);

  const { data, error } = await supabase
    .from("project_activities")
    .select(
      "id, project_id, description, planned_start, planned_end, actual_start, actual_end, responsible_user_id, projects:project_id(id, name)",
    )
    .gte("planned_start", start)
    .lte("planned_start", end)
    .is("actual_end", null)
    .order("planned_start", { ascending: true })
    .limit(500);

  if (error) throw error;

  const rows = data ?? [];

  const responsibleIds = Array.from(
    new Set(
      rows
        .map((r) => r.responsible_user_id)
        .filter((id): id is string => !!id),
    ),
  );

  const nameByUser = new Map<string, string>();
  if (responsibleIds.length > 0) {
    const { data: profs } = await supabase
      .from("users_profile")
      .select("id, nome")
      .in("id", responsibleIds);
    (profs ?? []).forEach((p) => nameByUser.set(p.id, p.nome));
  }

  const today = TODAY_ISO();

  return rows.map((row) => {
    const projectName =
      (row.projects as { name?: string } | null)?.name ?? "Sem obra";
    const planned_start = row.planned_start as string;
    return {
      id: row.id,
      project_id: row.project_id,
      project_name: projectName,
      description: row.description ?? "Atividade sem título",
      planned_start,
      planned_end: row.planned_end,
      actual_start: row.actual_start,
      actual_end: row.actual_end,
      responsible_user_id: row.responsible_user_id,
      responsible_name: row.responsible_user_id
        ? (nameByUser.get(row.responsible_user_id) ?? null)
        : null,
      weekKey: mondayOf(planned_start),
      isOverdue: planned_start < today && !row.actual_start,
      hasResponsible: !!row.responsible_user_id,
    };
  });
}

export interface UseLookaheadFilters {
  projectIds?: string[];
  responsibleIds?: string[];
  onlyWithoutResponsible?: boolean;
}

export function useLookahead(
  windowDays: 14 | 21,
  filters: UseLookaheadFilters = {},
) {
  const query = useQuery({
    queryKey: queryKeys.lookahead.list(windowDays),
    queryFn: () => fetchLookahead(windowDays),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const filtered = useMemo(() => {
    const all = query.data ?? [];
    return all.filter((a) => {
      if (filters.projectIds && filters.projectIds.length > 0) {
        if (!filters.projectIds.includes(a.project_id)) return false;
      }
      if (filters.onlyWithoutResponsible) {
        if (a.hasResponsible) return false;
      } else if (
        filters.responsibleIds &&
        filters.responsibleIds.length > 0
      ) {
        if (
          !a.responsible_user_id ||
          !filters.responsibleIds.includes(a.responsible_user_id)
        )
          return false;
      }
      return true;
    });
  }, [
    query.data,
    filters.projectIds,
    filters.responsibleIds,
    filters.onlyWithoutResponsible,
  ]);

  const weeks: LookaheadWeek[] = useMemo(() => {
    const map = new Map<string, LookaheadActivity[]>();
    filtered.forEach((a) => {
      const arr = map.get(a.weekKey);
      if (arr) arr.push(a);
      else map.set(a.weekKey, [a]);
    });
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => {
      const activities = (map.get(k) ?? []).sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return a.planned_start.localeCompare(b.planned_start);
      });
      return {
        weekKey: k,
        weekStart: new Date(`${k}T00:00:00`),
        activities,
      };
    });
  }, [filtered]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    (query.data ?? []).forEach((a) =>
      map.set(a.project_id, a.project_name),
    );
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [query.data]);

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
    weeks,
    totalCount: filtered.length,
    projectOptions,
  };
}
