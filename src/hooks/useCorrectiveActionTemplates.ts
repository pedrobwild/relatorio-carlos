import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTemplates,
  getAllActiveTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/infra/repositories/correctiveActionTemplatesRepository";

export type { CorrectiveActionTemplate } from "@/infra/repositories/correctiveActionTemplatesRepository";

const QUERY_KEY = ["corrective-action-templates"];

/** All templates (admin view — includes inactive) */
export function useAllCorrectiveActionTemplates() {
  return useQuery({
    queryKey: [...QUERY_KEY, "all"],
    queryFn: getTemplates,
  });
}

/** Active templates only (for template selector in NC dialog) */
export function useActiveCorrectiveActionTemplates() {
  return useQuery({
    queryKey: [...QUERY_KEY, "active"],
    queryFn: getAllActiveTemplates,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Template criado");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Template atualizado");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Template removido");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
