import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import {
  getInspectionsByProject,
  getInspectionById,
  getInspectionItems,
  createInspectionWithItems,
  updateInspectionItem,
  completeInspection,
} from "@/infra/repositories/inspectionsRepository";

// eslint-disable-next-line no-duplicate-imports
import type {
  Inspection,
  InspectionItemResult,
  InspectionItem,
  InspectionStatus,
} from "@/infra/repositories/inspectionsRepository";
export type {
  Inspection,
  InspectionItem,
  InspectionStatus,
  InspectionItemResult,
};

// ── Queries ──

export function useInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: ["inspections", projectId],
    queryFn: () => getInspectionsByProject(projectId!),
    enabled: !!projectId,
  });
}

export function useInspection(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ["inspection", inspectionId],
    queryFn: () => getInspectionById(inspectionId!),
    enabled: !!inspectionId,
  });
}

export function useInspectionItems(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ["inspection-items", inspectionId],
    queryFn: () => getInspectionItems(inspectionId!),
    enabled: !!inspectionId,
  });
}

// ── Mutations ──

export function useCreateInspection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      project_id: string;
      activity_id?: string;
      inspection_date?: string;
      notes?: string;
      items: { description: string; sort_order: number }[];
      inspection_type?: string;
      inspector_user_id?: string;
      client_present?: boolean;
      client_name?: string;
    }) => {
      if (!user) throw new Error("Não autenticado");
      const id = await createInspectionWithItems(params);
      return { id, project_id: params.project_id } as Inspection;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["inspections", data.project_id],
      });
      toast.success("Vistoria criada com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar vistoria: " + err.message);
    },
  });
}

export function useUpdateInspectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      inspection_id: string;
      result?: InspectionItemResult;
      notes?: string | null;
      photo_paths?: string[];
    }) => {
      await updateInspectionItem({
        id: params.id,
        result: params.result,
        notes: params.notes,
        photo_paths: params.photo_paths,
      });
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({
        queryKey: ["inspection-items", params.inspection_id],
      });
    },
  });
}

export function useCompleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; project_id: string }) => {
      await completeInspection(params.id);
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({
        queryKey: ["inspections", params.project_id],
      });
      queryClient.invalidateQueries({ queryKey: ["inspection", params.id] });
      queryClient.invalidateQueries({
        queryKey: ["inspection-items", params.id],
      });
      toast.success("Vistoria finalizada");
    },
  });
}
