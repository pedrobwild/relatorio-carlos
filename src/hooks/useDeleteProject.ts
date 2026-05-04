import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectKeys } from "./useProjectsQuery";
import {
  deleteProject,
  restoreProject,
} from "@/infra/repositories/projects.repository";

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await deleteProject(projectId);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      toast.success("Obra movida para a lixeira", {
        description: "Você pode restaurar nos próximos dias.",
        action: {
          label: "Desfazer",
          onClick: async () => {
            const { error } = await restoreProject(projectId);
            if (error) {
              toast.error("Não foi possível restaurar: " + error.message);
              return;
            }
            toast.success("Obra restaurada");
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: Error) => {
      console.error("Error deleting project:", error);
      toast.error("Erro ao excluir obra: " + error.message);
    },
  });
}

export function useRestoreProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await restoreProject(projectId);
      if (error) throw error;
      return projectId;
    },
    onSuccess: () => {
      toast.success("Obra restaurada");
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: Error) => {
      toast.error("Erro ao restaurar obra: " + error.message);
    },
  });
}
