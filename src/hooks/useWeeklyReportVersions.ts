import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  listVersions,
  restoreVersion,
  type WeeklyReportVersion,
} from "@/infra/repositories/weeklyReports.repository";
import { getUserMessageFromRepoError } from "@/infra/repositories/base.repository";

interface Options {
  projectId: string | undefined;
  weekNumber: number | undefined;
  enabled?: boolean;
}

/**
 * Histórico de versões de um relatório semanal (texto + fotos).
 * Cada salvamento gera uma versão no banco; aqui listamos e restauramos.
 */
export function useWeeklyReportVersions({
  projectId,
  weekNumber,
  enabled = true,
}: Options) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.weeklyReports.versions(projectId, weekNumber);

  const versionsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<WeeklyReportVersion[]> => {
      if (!projectId || weekNumber === undefined) return [];
      const result = await listVersions(projectId, weekNumber);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: enabled && !!projectId && weekNumber !== undefined,
    staleTime: 30_000,
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const result = await restoreVersion(versionId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.weeklyReports.list(projectId),
      });
      toast.success("Versão restaurada. O relatório voltou ao conteúdo dessa versão.");
    },
    onError: (error) => {
      toast.error(
        getUserMessageFromRepoError(error as never) ||
          "Não foi possível restaurar esta versão.",
      );
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    error: versionsQuery.error,
    restoreVersion: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
  };
}
