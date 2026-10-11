/**
 * Hooks da camada de Operação (Fase 2) — staff-only.
 * Base para as telas Hoje (Fase 3) e Semana (Fase 4).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  opsRepo,
  type OpsAssignmentOutcome,
  type OpsBlockReason,
  type OpsMaterialStatus,
  type OpsReviewResult,
} from "@/infra/repositories/ops.repository";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

const unwrap = <T,>(res: { data: T | null; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};

export function useOpsActivities(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.activities(projectId),
    enabled: !!projectId,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listActivities(projectId)) ?? [] : []),
  });
}

export function useOpsAssignments(projectId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.ops.assignments(projectId, from, to),
    enabled: !!projectId,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listAssignments(projectId, from, to)) ?? [] : []),
  });
}

/** Alocações de um dia — base da tela Hoje. */
export function useOpsDay(date: string, userId?: string | null) {
  return useQuery({
    queryKey: queryKeys.ops.day(date, userId),
    queryFn: async () => unwrap(await opsRepo.listDay(date, userId)) ?? [],
  });
}

export function useStageRollup(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.stageRollup(projectId),
    enabled: !!projectId,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listStageRollup(projectId)) ?? [] : []),
  });
}

export function useOpsMaterials(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.materials(activityId),
    enabled: !!activityId,
    queryFn: async () => (activityId ? unwrap(await opsRepo.listMaterials(activityId)) ?? [] : []),
  });
}

/** Qualquer escrita na operação invalida tudo de `ops` (contadores e rollup dependem entre si). */
function useOpsMutation<TVars, TOut>(fn: (vars: TVars) => Promise<TOut>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ops.all }),
  });
}

export const useCreateOpsActivity = () =>
  useOpsMutation(async (input: TablesInsert<"ops_activities">) => unwrap(await opsRepo.createActivity(input)));

export const useUpdateOpsActivity = () =>
  useOpsMutation(async ({ id, patch }: { id: string; patch: TablesUpdate<"ops_activities"> }) =>
    unwrap(await opsRepo.updateActivity(id, patch)),
  );

export const useCreateOpsAssignment = () =>
  useOpsMutation(async (input: Omit<TablesInsert<"ops_assignments">, "project_id">) =>
    unwrap(await opsRepo.createAssignment(input)),
  );

export const useSetAssignmentOutcome = () =>
  useOpsMutation(
    async (vars: {
      id: string;
      outcome: OpsAssignmentOutcome | null;
      reason?: OpsBlockReason | null;
      notes?: string | null;
      photoPaths?: string[];
    }) => unwrap(await opsRepo.setOutcome(vars.id, vars.outcome, vars)),
  );

export const useCreateOpsMaterial = () =>
  useOpsMutation(async (input: Omit<TablesInsert<"ops_materials">, "project_id">) =>
    unwrap(await opsRepo.createMaterial(input)),
  );

export const useSetMaterialStatus = () =>
  useOpsMutation(async ({ id, status }: { id: string; status: OpsMaterialStatus }) =>
    unwrap(await opsRepo.setMaterialStatus(id, status)),
  );

export const useCreateOpsReview = () =>
  useOpsMutation(
    async (input: { activity_id: string; result: OpsReviewResult; notes?: string | null; photo_paths?: string[] }) =>
      unwrap(await opsRepo.createReview(input)),
  );
