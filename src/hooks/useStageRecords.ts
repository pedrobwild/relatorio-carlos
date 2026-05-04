import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RecordCategory = "decision" | "conversation" | "history";
export type RecordResponsible = "client" | "bwild";

export interface StageRecord {
  id: string;
  stage_id: string;
  project_id: string;
  category: RecordCategory;
  title: string;
  description: string | null;
  record_date: string;
  responsible: RecordResponsible;
  evidence_url: string | null;
  created_by: string;
  created_at: string;
}

export function useStageRecords(
  stageId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ["stage-records", stageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_stage_records")
        .select("*")
        .eq("stage_id", stageId!)
        .order("record_date", { ascending: false });
      if (error) throw error;
      return (data || []) as StageRecord[];
    },
    enabled: !!stageId && !!projectId,
    retry: 2,
  });
}

export function useCreateStageRecord() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      stage_id: string;
      project_id: string;
      category: RecordCategory;
      title: string;
      description?: string;
      record_date?: string;
      responsible?: RecordResponsible;
      evidence_url?: string;
      created_by: string;
    }) => {
      const { error } = await supabase.from("journey_stage_records").insert({
        stage_id: input.stage_id,
        project_id: input.project_id,
        category: input.category,
        title: input.title,
        description: input.description ?? null,
        record_date:
          input.record_date ?? new Date().toISOString().split("T")[0],
        responsible: input.responsible ?? "bwild",
        evidence_url: input.evidence_url ?? null,
        created_by: input.created_by,
      });
      if (error) throw error;
      return { stageId: input.stage_id };
    },
    onSuccess: ({ stageId }) => {
      qc.invalidateQueries({ queryKey: ["stage-records", stageId] });
      toast.success("Registro salvo com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar registro. Tente novamente.");
    },
  });
}

export function useDeleteStageRecord() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      const { error } = await supabase
        .from("journey_stage_records")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { stageId };
    },
    onSuccess: ({ stageId }) => {
      qc.invalidateQueries({ queryKey: ["stage-records", stageId] });
      toast.success("Registro removido");
    },
    onError: () => {
      toast.error("Erro ao remover registro. Tente novamente.");
    },
  });
}
