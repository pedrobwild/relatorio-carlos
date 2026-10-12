/**
 * Ficha da obra (staff-only): leitura e gravação de `project_studio_info`.
 * Usada pela gaveta "Ficha da obra" nas telas Hoje, Semana e Painel de Obras.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { studioInfoRepo, type StudioInfo, type StudioInfoPatch } from "@/infra/repositories/studioInfo.repository";

/** `data === null` = a obra ainda não tem ficha; `undefined` = ainda não carregou. */
export function useStudioInfo(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.studioInfo.byProject(projectId ?? undefined),
    enabled: !!projectId,
    staleTime: 60_000,
    // A ficha traz a senha da fechadura: fica só na memória da sessão, não
    // vai para o cache gravado no aparelho (localStorage, 24h).
    meta: { persist: false },
    queryFn: async (): Promise<StudioInfo | null> => {
      if (!projectId) return null;
      const res = await studioInfoRepo.getStudioInfo(projectId);
      if (res.error) throw res.error;
      return res.data ?? null;
    },
  });
}

export interface UpdateStudioInfoVars {
  projectId: string;
  /** Só os campos que mudaram. */
  patch: StudioInfoPatch;
}

/** Grava a ficha. O aviso de erro é o global das mutações (queryClient). */
export function useUpdateStudioInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, patch }: UpdateStudioInfoVars) => {
      const res = await studioInfoRepo.upsertStudioInfo(projectId, patch);
      if (res.error) throw res.error;
      return res.data as StudioInfo;
    },
    onSuccess: (saved, { projectId }) => {
      // Mostra na hora o que o banco gravou e confirma com uma nova leitura.
      if (saved) qc.setQueryData(queryKeys.studioInfo.byProject(projectId), saved);
      void qc.invalidateQueries({ queryKey: queryKeys.studioInfo.byProject(projectId) });
    },
  });
}
