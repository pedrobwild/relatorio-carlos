import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  listAudit,
  getAuditPayload,
  type WeeklyReportAuditEntry,
  type WeeklyReportAuditFilters,
} from "@/infra/repositories/weeklyReportAudit.repository";
import type { WeeklyReportData } from "@/types/weeklyReport";

/** Lista de salvamentos de relatórios semanais (staff-only). */
export function useWeeklyReportAudit(filters: WeeklyReportAuditFilters) {
  const query = useQuery({
    queryKey: queryKeys.weeklyReports.audit(
      filters as unknown as Record<string, unknown>,
    ),
    queryFn: async (): Promise<WeeklyReportAuditEntry[]> => {
      const result = await listAudit(filters);
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 30_000,
  });

  const entries = query.data ?? [];

  return {
    entries,
    total: entries[0]?.total_count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Conteúdo completo (texto + fotos) de um salvamento específico. */
export function useWeeklyReportAuditPayload(versionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.weeklyReports.auditPayload(versionId),
    queryFn: async (): Promise<WeeklyReportData | null> => {
      if (!versionId) return null;
      const result = await getAuditPayload(versionId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!versionId,
    staleTime: 5 * 60_000,
  });
}
