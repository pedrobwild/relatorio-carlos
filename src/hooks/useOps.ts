/**
 * Hooks da camada de Operação (Fase 2) — staff-only.
 * Base para as telas Hoje (Fase 3) e Semana (Fase 4).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { invalidatePurchaseQueries, queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/useAuth";
import { purchasesRepo, type CreatePurchaseInput } from "@/infra/repositories/purchases.repository";
import {
  opsRepo,
  type OpsAssignmentPlanPatch,
  type OpsDayAssignment,
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

/**
 * Qualquer escrita na operação invalida tudo de `ops` (contadores e rollup
 * dependem entre si) e também a tela Obras, que lê as mesmas tabelas com
 * outra chave — sem isso ela mostrava "semana não planejada" e alertas
 * antigos logo depois de planejar/confirmar.
 */
export function invalidateOps(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.obrasPanel.all });
  return qc.invalidateQueries({ queryKey: queryKeys.ops.all });
}

function useOpsMutation<TVars, TOut>(fn: (vars: TVars) => Promise<TOut>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateOps(qc),
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

export interface SetOutcomeVars {
  id: string;
  outcome: OpsAssignmentOutcome | null;
  reason?: OpsBlockReason | null;
  notes?: string | null;
  photoPaths?: string[];
}

/** Aplica o Feito / Não feito numa lista do dia (usado no update otimista). */
export function applyOutcome(list: OpsDayAssignment[] | undefined, vars: SetOutcomeVars, now: string) {
  if (!list) return list;
  return list.map((a) =>
    a.id !== vars.id
      ? a
      : {
          ...a,
          outcome: vars.outcome,
          not_done_reason: vars.outcome === "nao_feito" ? (vars.reason ?? null) : null,
          // Desfazer limpa a observação do "Não feito" (igual ao repositório).
          notes: vars.notes !== undefined ? vars.notes : vars.outcome === null ? null : a.notes,
          done_at: vars.outcome ? now : null,
        },
  );
}

/**
 * Feito / Não feito / desfazer. A tela responde na hora (otimista); se o
 * banco recusar, volta ao estado anterior e o erro sobe para quem chamou.
 */
export function useSetAssignmentOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SetOutcomeVars) => unwrap(await opsRepo.setOutcome(vars.id, vars.outcome, vars)),
    onMutate: async (vars) => {
      const dayKey = [...queryKeys.ops.all, "day"] as const;
      await qc.cancelQueries({ queryKey: dayKey });
      const previous = qc.getQueriesData<OpsDayAssignment[]>({ queryKey: dayKey });
      const now = new Date().toISOString();
      for (const [key, list] of previous) qc.setQueryData(key, applyOutcome(list, vars, now));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, list] of (ctx?.previous ?? []) as [QueryKey, OpsDayAssignment[] | undefined][]) {
        qc.setQueryData(key, list);
      }
    },
    onSettled: () => invalidateOps(qc),
  });
}

/** Material faltando por atividade (uma consulta para o dia inteiro). */
export function useOpsReadiness(activityIds: string[]) {
  return useQuery({
    queryKey: queryKeys.ops.readiness(activityIds),
    enabled: activityIds.length > 0,
    queryFn: async () => unwrap(await opsRepo.listReadiness(activityIds)) ?? [],
  });
}

export function useOpsStages(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.stages(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listStages(projectId)) ?? [] : []),
  });
}

/** Envia as fotos e acrescenta os caminhos na alocação. */
export const useAddAssignmentPhotos = () =>
  useOpsMutation(
    async (vars: { assignment: Pick<OpsDayAssignment, "id" | "project_id" | "photo_paths">; files: File[] }) => {
      const paths: string[] = [];
      for (const file of vars.files) {
        paths.push(unwrap(await opsRepo.uploadPhoto(vars.assignment.project_id, vars.assignment.id, file)));
      }
      return unwrap(await opsRepo.setPhotos(vars.assignment.id, [...(vars.assignment.photo_paths ?? []), ...paths]));
    },
  );

export function useOpsPhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: queryKeys.ops.photoUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
    // URL assinada expira em ~1h: não vai para o cache persistido (24h).
    meta: { persist: false },
    queryFn: async () => unwrap(await opsRepo.getPhotoUrls(paths)) ?? [],
  });
}

export const useCreateOpsMaterial = () =>
  useOpsMutation(async (input: Omit<TablesInsert<"ops_materials">, "project_id">) =>
    unwrap(await opsRepo.createMaterial(input)),
  );

export const useSetMaterialStatus = () =>
  useOpsMutation(async ({ id, status }: { id: string; status: OpsMaterialStatus }) =>
    unwrap(await opsRepo.setMaterialStatus(id, status)),
  );

// ---------------------------------------------------------------------------
// Material ligado à compra
// ---------------------------------------------------------------------------
// Com compra vinculada a situação do material é calculada pelo banco: depois
// de vincular/desvincular a tela relê (invalidateOps), nada é "adivinhado".

/** Compras da obra que podem atender um material (só busca com o seletor aberto). */
export function useOpsLinkablePurchases(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ops.linkablePurchases(projectId),
    enabled: !!projectId && enabled,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listLinkablePurchases(projectId)) ?? [] : []),
  });
}

export const useLinkMaterialToPurchase = () =>
  useOpsMutation(async ({ materialId, purchaseId }: { materialId: string; purchaseId: string }) =>
    unwrap(await opsRepo.linkMaterialToPurchase(materialId, purchaseId)),
  );

export const useUnlinkMaterialFromPurchase = () =>
  useOpsMutation(async (materialId: string) => unwrap(await opsRepo.unlinkMaterialFromPurchase(materialId)));

/** A compra foi criada, mas o vínculo com o material falhou. */
export class PurchaseCreatedButNotLinkedError extends Error {
  constructor(
    public readonly purchaseId: string,
    public readonly linkError: unknown,
  ) {
    super("A compra foi criada, mas não foi possível vinculá-la ao material.");
    this.name = "PurchaseCreatedButNotLinkedError";
  }
}

/**
 * "Pedir compra": cria a solicitação pelo mesmo caminho da tela Compras
 * (`purchasesRepo.create`) e liga o material a ela. Relê a operação e todas
 * as telas de compras.
 */
export function useRequestPurchaseForMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ materialId, purchase }: { materialId: string; purchase: CreatePurchaseInput }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const created = unwrap(await purchasesRepo.create(purchase, user.id));
      const linked = await opsRepo.linkMaterialToPurchase(materialId, created.id);
      if (linked.error) throw new PurchaseCreatedButNotLinkedError(created.id, linked.error);
      return { purchase: created, material: linked.data };
    },
    onSettled: () => {
      invalidatePurchaseQueries();
      return invalidateOps(qc);
    },
  });
}

export const useCreateOpsReview = () =>
  useOpsMutation(
    async (input: { activity_id: string; result: OpsReviewResult; notes?: string | null; photo_paths?: string[] }) =>
      unwrap(await opsRepo.createReview(input)),
  );

// ---------------------------------------------------------------------------
// Tela Semana (Fase 4)
// ---------------------------------------------------------------------------

export function useOpsActivityAssignments(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.activityAssignments(activityId),
    enabled: !!activityId,
    queryFn: async () => (activityId ? unwrap(await opsRepo.listAssignmentsByActivity(activityId)) ?? [] : []),
  });
}

export function useOpsProjectMaterials(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.projectMaterials(projectId),
    enabled: !!projectId,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listMaterialsByProject(projectId)) ?? [] : []),
  });
}

export function useOpsReviews(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ops.reviews(activityId),
    enabled: !!activityId,
    queryFn: async () => (activityId ? unwrap(await opsRepo.listReviews(activityId)) ?? [] : []),
  });
}

export const useCreateOpsAssignments = () =>
  useOpsMutation(async (rows: Omit<TablesInsert<"ops_assignments">, "project_id">[]) =>
    unwrap(await opsRepo.createAssignments(rows)),
  );

export const useUpdateAssignmentPlan = () =>
  useOpsMutation(async ({ id, patch }: { id: string; patch: OpsAssignmentPlanPatch }) =>
    unwrap(await opsRepo.updateAssignmentPlan(id, patch)),
  );

export const useDeleteOpsAssignment = () =>
  useOpsMutation(async (id: string) => unwrap(await opsRepo.deleteAssignment(id)));

export const useDeleteOpsMaterial = () =>
  useOpsMutation(async (id: string) => unwrap(await opsRepo.deleteMaterial(id)));

// ---------------------------------------------------------------------------
// Fechamento de semana e PPC (Fase 6)
// ---------------------------------------------------------------------------

/** Fechamento da semana `monday` e os anteriores (mais recente primeiro). */
export function useOpsWeekClosings(projectId: string | undefined, monday: string) {
  return useQuery({
    queryKey: queryKeys.ops.weekClosings(projectId, monday),
    enabled: !!projectId,
    queryFn: async () => (projectId ? unwrap(await opsRepo.listWeekClosings(projectId, monday)) ?? [] : []),
  });
}

export const useCloseOpsWeek = () =>
  useOpsMutation(async (input: { project_id: string; week_start: string; notes?: string | null }) =>
    unwrap(await opsRepo.closeWeek(input)),
  );

export const useReopenOpsWeek = () => useOpsMutation(async (id: string) => unwrap(await opsRepo.reopenWeek(id)));
