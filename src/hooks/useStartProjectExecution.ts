/**
 * useStartProjectExecution — "Iniciar obra": tira a obra da fase de projeto e
 * libera o cronograma para o cliente (RPC `start_project_execution`).
 *
 * Substitui o antigo "Concluir Mobilização", que CLONAVA a obra, e o banner
 * que só aparecia com todas as etapas concluídas. A RPC exige cronograma
 * cadastrado e devolve o motivo em PT-BR (P0001) quando não pode iniciar.
 *
 * Não usa useMutation de propósito: o handler global de mutations mostraria
 * uma mensagem genérica por cima do motivo real que a RPC devolve.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectsRepo } from "@/infra/repositories";
import type { StartProjectExecutionResult } from "@/infra/repositories/projects.repository";
import { invalidateProjectQueries } from "@/lib/queryKeys";
import { describeSaveError } from "@/lib/saveErrors";
import { captureError } from "@/lib/errorMonitoring";
import { useProjectOptional } from "@/contexts/ProjectContext";

export function useStartProjectExecution() {
  const queryClient = useQueryClient();
  const projectContext = useProjectOptional();
  const [isPending, setIsPending] = useState(false);

  const start = useCallback(
    async (
      projectId: string,
      startDate?: string | null,
    ): Promise<StartProjectExecutionResult | null> => {
      setIsPending(true);
      const result = await projectsRepo.startProjectExecution(
        projectId,
        startDate,
      );
      setIsPending(false);

      if (result.error || !result.data) {
        captureError(result.error, {
          feature: "general",
          action: "start_project_execution",
          projectId,
        });
        toast.error("Não foi possível iniciar a obra", {
          description: describeSaveError(result.error).message,
        });
        return null;
      }

      // Jornada, listas de obras e o projeto aberto mudam de uma vez.
      queryClient.invalidateQueries({ queryKey: ["project-journey", projectId] });
      invalidateProjectQueries(projectId);
      if (projectContext?.project?.id === projectId) {
        await projectContext.refetch();
      }

      toast.success(
        result.data.already_in_execution
          ? "A obra já estava em execução"
          : "Obra iniciada: o cliente já vê o cronograma",
      );
      return result.data;
    },
    [queryClient, projectContext],
  );

  return { start, isPending };
}
