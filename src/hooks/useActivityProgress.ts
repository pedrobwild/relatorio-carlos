/**
 * useActivityProgress — hooks staff-only para medições de avanço físico
 * e baselines de cronograma (Onda A1).
 *
 * Uso: registrar % de avanço parcial de uma atividade e consultar histórico.
 * RLS garante isolamento por obra; hook não deve ser usado em componentes
 * expostos ao role customer.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/queryKeys";
import {
  createBaselineFromCurrentSchedule,
  createMeasurement,
  deleteBaseline,
  deleteMeasurement,
  getCurrentBaseline,
  getLatestMeasurementsForProject,
  listBaselineActivities,
  listBaselines,
  listMeasurementsByActivity,
  listMeasurementsByProject,
  setBaselineAsCurrent,
  type ActivityProgressMeasurement,
  type CreateProgressMeasurementInput,
  type ScheduleBaseline,
  type ScheduleBaselineActivity,
} from "@/infra/repositories/activityProgress.repository";

export type {
  ActivityProgressMeasurement,
  CreateProgressMeasurementInput,
  ScheduleBaseline,
  ScheduleBaselineActivity,
};

// ────────── Medições ──────────

export function useActivityMeasurements(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.avancoFisico.byActivity(activityId),
    queryFn: () => listMeasurementsByActivity(activityId!),
    enabled: !!activityId,
    staleTime: 30_000,
  });
}

export function useProjectMeasurements(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.avancoFisico.byProject(projectId),
    queryFn: () => listMeasurementsByProject(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useLatestMeasurementsByActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.avancoFisico.latest(projectId),
    queryFn: async () => {
      const map = await getLatestMeasurementsForProject(projectId!);
      // Map não é serializável para persistQueryClient — convertemos em objeto.
      const out: Record<string, ActivityProgressMeasurement> = {};
      for (const [k, v] of map) out[k] = v;
      return out;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProgressMeasurementInput) =>
      createMeasurement(input),
    onSuccess: (measurement) => {
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.byActivity(measurement.activity_id),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.byProject(measurement.project_id),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.latest(measurement.project_id),
      });
      qc.invalidateQueries({ queryKey: queryKeys.lookahead.all });
      toast.success("Avanço registrado.");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Erro ao registrar avanço";
      toast.error(message);
    },
  });
}

export function useDeleteMeasurement(
  activityId: string,
  projectId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeasurement(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.byActivity(activityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.byProject(projectId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.latest(projectId),
      });
      toast.success("Medição removida.");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Erro ao remover medição";
      toast.error(message);
    },
  });
}

// ────────── Baselines ──────────

export function useScheduleBaselines(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.avancoFisico.baselines(projectId),
    queryFn: () => listBaselines(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useCurrentBaseline(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.avancoFisico.baselineCurrent(projectId),
    queryFn: () => getCurrentBaseline(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useBaselineActivities(baselineId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.avancoFisico.baselineActivities(baselineId),
    queryFn: () => listBaselineActivities(baselineId!),
    enabled: !!baselineId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      project_id: string;
      name: string;
      notes?: string | null;
      makeCurrent?: boolean;
    }) => createBaselineFromCurrentSchedule(input),
    onSuccess: (baseline) => {
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.baselines(baseline.project_id),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.baselineCurrent(baseline.project_id),
      });
      toast.success("Baseline criada.");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Erro ao criar baseline";
      toast.error(message);
    },
  });
}

export function useSetBaselineAsCurrent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (baselineId: string) =>
      setBaselineAsCurrent(baselineId, projectId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.baselines(projectId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.baselineCurrent(projectId),
      });
      toast.success("Baseline atual atualizada.");
    },
  });
}

export function useDeleteBaseline(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (baselineId: string) => deleteBaseline(baselineId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.baselines(projectId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.avancoFisico.baselineCurrent(projectId),
      });
      toast.success("Baseline removida.");
    },
  });
}
