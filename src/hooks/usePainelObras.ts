/**
 * usePainelObras — visão executiva unificada de obras.
 * Lê da tabela `projects` (fonte única) e dos summaries (progresso/pendências).
 * Edição inline de campos do painel via optimistic updates.
 */
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useProjectsQuery,
  useProjectSummaryQuery,
  projectKeys,
} from "./useProjectsQuery";
import { useStaffUsers } from "./useStaffUsers";
import type { ProjectWithCustomer } from "@/infra/repositories/projects.repository";

export type PainelEtapa =
  | "Projeto 3D"
  | "Projeto Executivo"
  | "Executivo Aprovado"
  | "Medição"
  | "Executivo"
  | "Emissão RRT"
  | "Condomínio"
  | "Planejamento"
  | "Mobilização"
  | "Execução"
  | "Vistoria"
  | "Vistoria reprovada"
  | "Finalizada";

export type PainelStatus = "Aguardando" | "Em dia" | "Atrasado" | "Paralisada";

export type PainelRelacionamento =
  | "Normal"
  | "Atrito"
  | "Insatisfeito"
  | "Crítico";

/**
 * Prazo é armazenado como text livre (painel_prazo) mas editado via select
 * controlado no painel. Mantemos a lista aqui como fonte única de verdade.
 */
export type PainelPrazo = "55 dias" | "60 dias" | "65 dias" | "75 dias";

export const PAINEL_PRAZO_OPTIONS: PainelPrazo[] = [
  "55 dias",
  "60 dias",
  "65 dias",
  "75 dias",
];

/** Linha unificada do Painel: dados da obra + campos operacionais + métricas. */
export interface PainelObra {
  id: string;
  nome: string;
  customer_name: string | null;
  engineer_name: string | null;

  // Datas oficiais (vindas de projects.planned_start_date / planned_end_date)
  inicio_oficial: string | null;
  entrega_oficial: string | null;
  inicio_real: string | null;
  entrega_real: string | null;

  // Campos operacionais do painel (colunas adicionadas em projects)
  prazo: string | null;
  etapa: PainelEtapa | null;
  inicio_etapa: string | null;
  previsao_avanco: string | null;
  status: PainelStatus | null;
  relacionamento: PainelRelacionamento | null;
  external_budget_id: string | null;
  /** ID do usuário responsável pela obra (FK -> users_profile.id). */
  responsavel_id: string | null;
  /** Nome do responsável (resolvido em runtime via useStaffUsers). */
  responsavel_nome: string | null;
  ultima_atualizacao: string;
  /** True quando a obra ainda está em fase de projeto (sem execução em campo). */
  is_project_phase: boolean;

  // Métricas (do summary)
  progress_percentage: number | null;
  pending_count: number;
  overdue_count: number;
}

/**
 * Ordem canônica das etapas (reflete o ciclo de vida de uma obra).
 * A primeira etapa (`Medição`) espelha o início oficial via cronograma;
 * a última etapa (`Finalizada`) indica entrega consolidada.
 */
export const ETAPA_OPTIONS: PainelEtapa[] = [
  "Projeto 3D",
  "Projeto Executivo",
  "Executivo Aprovado",
  "Medição",
  "Executivo",
  "Emissão RRT",
  "Condomínio",
  "Planejamento",
  "Mobilização",
  "Execução",
  "Vistoria",
  "Vistoria reprovada",
  "Finalizada",
];

export const STATUS_OPTIONS: PainelStatus[] = [
  "Aguardando",
  "Em dia",
  "Atrasado",
  "Paralisada",
];

export const RELACIONAMENTO_OPTIONS: PainelRelacionamento[] = [
  "Normal",
  "Atrito",
  "Insatisfeito",
  "Crítico",
];

/** Patch suportado para edição inline (somente campos operacionais). */
export type PainelObraPatch = Partial<{
  prazo: string | null;
  etapa: PainelEtapa | null;
  inicio_etapa: string | null;
  previsao_avanco: string | null;
  status: PainelStatus | null;
  relacionamento: PainelRelacionamento | null;
  external_budget_id: string | null;
  responsavel_id: string | null;
  inicio_oficial: string | null;
  entrega_oficial: string | null;
  inicio_real: string | null;
  entrega_real: string | null;
}>;

/** Mapeamento patch lógico → colunas reais do `projects`. */
function patchToDbColumns(patch: PainelObraPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("prazo" in patch) out.painel_prazo = patch.prazo;
  if ("etapa" in patch) out.painel_etapa = patch.etapa;
  if ("inicio_etapa" in patch) out.painel_inicio_etapa = patch.inicio_etapa;
  if ("previsao_avanco" in patch)
    out.painel_previsao_avanco = patch.previsao_avanco;
  if ("status" in patch) out.painel_status = patch.status;
  if ("relacionamento" in patch)
    out.painel_relacionamento = patch.relacionamento;
  if ("external_budget_id" in patch)
    out.painel_external_budget_id = patch.external_budget_id;
  if ("responsavel_id" in patch)
    out.painel_responsavel_id = patch.responsavel_id;
  if ("inicio_oficial" in patch) out.planned_start_date = patch.inicio_oficial;
  if ("entrega_oficial" in patch) out.planned_end_date = patch.entrega_oficial;
  if ("inicio_real" in patch) out.actual_start_date = patch.inicio_real;
  if ("entrega_real" in patch) out.actual_end_date = patch.entrega_real;
  return out;
}

export function usePainelObras() {
  const qc = useQueryClient();
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error,
    refetch,
  } = useProjectsQuery();
  const { data: summaries = [], isLoading: summariesLoading } =
    useProjectSummaryQuery();
  const { data: staffUsers = [] } = useStaffUsers();

  const obras = useMemo<PainelObra[]>(() => {
    const summaryMap = new Map(summaries.map((s) => [s.id, s]));
    const staffMap = new Map(staffUsers.map((u) => [u.id, u.nome]));
    return projects.map((p) => {
      const s = summaryMap.get(p.id);
      // Campos do painel vêm da row crua de projects (cast por compatibilidade
      // até regenerar types do Supabase).
      const raw = p as ProjectWithCustomer & {
        painel_prazo?: string | null;
        painel_etapa?: PainelEtapa | null;
        painel_inicio_etapa?: string | null;
        painel_previsao_avanco?: string | null;
        painel_status?: PainelStatus | null;
        painel_relacionamento?: PainelRelacionamento | null;
        painel_external_budget_id?: string | null;
        painel_responsavel_id?: string | null;
        painel_ultima_atualizacao?: string;
      };
      const responsavelId = raw.painel_responsavel_id ?? null;
      return {
        id: p.id,
        nome: p.name,
        customer_name: p.customer_name ?? null,
        engineer_name: p.engineer_name ?? null,
        inicio_oficial: p.planned_start_date,
        entrega_oficial: p.planned_end_date,
        inicio_real: p.actual_start_date,
        entrega_real: p.actual_end_date,
        prazo: raw.painel_prazo ?? null,
        etapa: raw.painel_etapa ?? null,
        inicio_etapa: raw.painel_inicio_etapa ?? null,
        previsao_avanco: raw.painel_previsao_avanco ?? null,
        status: raw.painel_status ?? null,
        relacionamento: raw.painel_relacionamento ?? null,
        external_budget_id: raw.painel_external_budget_id ?? null,
        responsavel_id: responsavelId,
        responsavel_nome: responsavelId
          ? (staffMap.get(responsavelId) ?? null)
          : null,
        ultima_atualizacao: raw.painel_ultima_atualizacao ?? p.updated_at,
        is_project_phase: !!p.is_project_phase,
        progress_percentage:
          s?.progress_percentage != null
            ? Math.round(Math.min(100, Number(s.progress_percentage)))
            : null,
        pending_count: s?.pending_count ?? 0,
        overdue_count: s?.overdue_count ?? 0,
      };
    });
  }, [projects, summaries, staffUsers]);

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: PainelObraPatch;
    }) => {
      const dbPatch = patchToDbColumns(patch);
      if (Object.keys(dbPatch).length === 0) return { id, patch };
      const { error: updateErr } = await supabase
        .from("projects")
        .update(dbPatch as never)
        .eq("id", id);
      if (updateErr) throw updateErr;
      return { id, patch };
    },
    onMutate: async ({ id, patch }) => {
      // Optimistic: atualiza todas as listas em cache
      await qc.cancelQueries({ queryKey: projectKeys.lists() });
      const snapshots = qc.getQueriesData<ProjectWithCustomer[]>({
        queryKey: projectKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<ProjectWithCustomer[]>(
          key,
          prev.map((p) => {
            if (p.id !== id) return p;
            const next: Record<string, unknown> = { ...p };
            if ("prazo" in patch) next.painel_prazo = patch.prazo;
            if ("etapa" in patch) {
              next.painel_etapa = patch.etapa;
              // Espelha o trigger do banco: ao mudar a etapa, início da
              // etapa é "hoje" — a menos que o caller tenha enviado um
              // valor explícito no mesmo patch.
              if (!("inicio_etapa" in patch)) {
                next.painel_inicio_etapa = new Date()
                  .toISOString()
                  .slice(0, 10);
              }
            }
            if ("inicio_etapa" in patch)
              next.painel_inicio_etapa = patch.inicio_etapa;
            if ("previsao_avanco" in patch)
              next.painel_previsao_avanco = patch.previsao_avanco;
            if ("status" in patch) next.painel_status = patch.status;
            if ("relacionamento" in patch)
              next.painel_relacionamento = patch.relacionamento;
            if ("external_budget_id" in patch)
              next.painel_external_budget_id = patch.external_budget_id;
            if ("responsavel_id" in patch)
              next.painel_responsavel_id = patch.responsavel_id;
            if ("inicio_oficial" in patch)
              next.planned_start_date = patch.inicio_oficial;
            if ("entrega_oficial" in patch)
              next.planned_end_date = patch.entrega_oficial;
            if ("inicio_real" in patch)
              next.actual_start_date = patch.inicio_real;
            if ("entrega_real" in patch)
              next.actual_end_date = patch.entrega_real;
            next.painel_ultima_atualizacao = new Date().toISOString();
            return next as unknown as ProjectWithCustomer;
          }),
        );
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
      }
      toast.error("Erro ao salvar alteração");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });

  return {
    obras,
    isLoading: projectsLoading || summariesLoading,
    error: error ? (error as Error).message : null,
    refetch,
    updateObra: (id: string, patch: PainelObraPatch) =>
      update.mutateAsync({ id, patch }),
    isUpdating: update.isPending,
  };
}
