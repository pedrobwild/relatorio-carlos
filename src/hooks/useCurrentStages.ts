import { useQuery } from "@tanstack/react-query";
import { QUERY_TIMING } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { todayISO } from "@/lib/hojeDia";
import { internalScheduleRepo } from "@/infra/repositories/internalSchedule.repository";

export interface CurrentStageInfo {
  description: string;
  isAwaitingStart: boolean;
}

/**
 * Etapa atual de cada obra, numa consulta só, a partir do CRONOGRAMA INTERNO
 * (lista de obras da equipe).
 * Devolve projectId -> CurrentStageInfo.
 */
export function useCurrentStages(projectIds: string[]) {
  return useQuery({
    queryKey: queryKeys.internalSchedule.currentStages(projectIds),
    queryFn: async (): Promise<Map<string, CurrentStageInfo>> => {
      if (projectIds.length === 0) return new Map();

      const res = await internalScheduleRepo.listByProjects(projectIds);
      if (res.error) throw res.error;
      const data = res.data;

      const map = new Map<string, CurrentStageInfo>();
      // Dia local (não UTC): à noite em São Paulo, toISOString já é amanhã.
      const today = todayISO();

      // Group by project
      const byProject = new Map<string, typeof data>();
      for (const row of data || []) {
        if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
        byProject.get(row.project_id)!.push(row);
      }

      for (const [projectId, activities] of byProject) {
        // Sort by sort_order (already ordered but grouped may lose order)
        activities.sort((a, b) => a.sort_order - b.sort_order);

        const firstStart = activities[0]?.planned_start;
        if (firstStart && firstStart > today) {
          map.set(projectId, {
            description: "Aguardando liberação",
            isAwaitingStart: true,
          });
          continue;
        }

        // Find first activity without actual_end
        const current = activities.find((a) => !a.actual_end);
        if (current) {
          map.set(projectId, {
            description: current.description,
            isAwaitingStart: false,
          });
        } else if (activities.length > 0) {
          // All completed
          map.set(projectId, {
            description: "Concluído",
            isAwaitingStart: false,
          });
        }
      }

      return map;
    },
    enabled: projectIds.length > 0,
    staleTime: QUERY_TIMING.default.staleTime,
  });
}
