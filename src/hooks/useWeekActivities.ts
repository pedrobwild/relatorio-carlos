/**
 * useWeekActivities — itens do CRONOGRAMA INTERNO (internal_schedule_items)
 * programados para um intervalo, em todas as obras que o usuário acessa.
 * Base do Calendário de obras (staff-only).
 *
 * "Programado no intervalo" = previsto cruzando o intervalo OU início real
 * dentro dele. Micro-etapas são itens filhos do cronograma interno: criar,
 * remover e marcar datas aqui nunca muda o cronograma do cliente.
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { invalidateInternalScheduleQueries, queryKeys } from "@/lib/queryKeys";
import {
  internalScheduleRepo,
  type InternalScheduleItemWithCustomer,
} from "@/infra/repositories/internalSchedule.repository";
import {
  internalScheduleErrorMessage,
  resolveMirrorChange,
  updateInternalMirroringClient,
  type MirrorChange,
} from "@/hooks/useInternalSchedule";

export interface WeekActivity {
  id: string;
  project_id: string;
  project_name: string;
  /** Nome do cliente vinculado à obra (de projects.client_name). */
  client_name: string | null;
  /** Status do projeto-pai (active, completed, draft, on_hold, cancelled, ...). */
  project_status: string | null;
  description: string;
  detailed_description: string | null;
  etapa: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  /** Cronograma interno não tem linha de base: sempre null (mantido pelo formato). */
  baseline_start: string | null;
  baseline_end: string | null;
  baseline_saved_at: string | null;
  weight: number;
  /** Ordem no cronograma interno. */
  sort_order: number;
  /** Atividade do cronograma do cliente de onde o item veio (null = só interno). */
  client_activity_id: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Se preenchido, o item é uma micro-etapa (`parent_id` do cronograma
   * interno). No Calendário, só Admin/Engenheiro veem o detalhamento; os
   * demais veem o item-mãe.
   */
  parent_activity_id: string | null;
  /** ID do membro da equipe (Staff) responsável por esta atividade/micro-etapa. */
  responsible_user_id: string | null;
  /** Nome do responsável (pré-resolvido a partir de users_profile). */
  responsible_name: string | null;
  /** ID do prestador (fornecedor) que executará esta atividade/micro-etapa. */
  fornecedor_id: string | null;
  /** Nome do prestador (pré-resolvido a partir de fornecedores). */
  fornecedor_nome: string | null;
}

/** Payload para criar uma micro-etapa (sub-atividade) de uma atividade-mãe. */
export interface SubActivityInput {
  description: string;
  planned_start: string; // YYYY-MM-DD
  planned_end: string; // YYYY-MM-DD
  /** Opcional: Staff responsável por esta micro-etapa. */
  responsible_user_id?: string | null;
  /**
   * Opcional: Prestador (fornecedor) que executará esta micro-etapa.
   * Indicado direto no momento da quebra para evitar um segundo modal.
   */
  fornecedor_id?: string | null;
}

export function toWeekActivity(row: InternalScheduleItemWithCustomer): WeekActivity {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project?.name ?? "Obra sem nome",
    // Nome do contratante vem de project_customers (fonte única).
    client_name: row.project?.project_customers?.[0]?.customer_name ?? null,
    project_status: row.project?.status ?? null,
    description: row.description,
    detailed_description: row.detailed_description ?? null,
    etapa: row.etapa,
    planned_start: row.planned_start,
    planned_end: row.planned_end,
    actual_start: row.actual_start,
    actual_end: row.actual_end,
    baseline_start: null,
    baseline_end: null,
    baseline_saved_at: null,
    weight: Number(row.weight),
    sort_order: row.sort_order,
    client_activity_id: row.client_activity_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    parent_activity_id: row.parent_id ?? null,
    responsible_user_id: row.responsible_user_id ?? null,
    responsible_name: row.responsible?.nome ?? null,
    fornecedor_id: row.fornecedor_id ?? null,
    fornecedor_nome: row.fornecedor?.nome ?? null,
  };
}

async function fetchWeekActivities(weekStart: string, weekEnd: string): Promise<WeekActivity[]> {
  // Previsto cruzando o intervalo OU início real dentro dele: o segundo caso
  // mantém no filtro "obras em andamento nesta semana" o item que começou
  // atrasado. Colunas `date`: comparação de yyyy-mm-dd, sem fuso.
  const res = await internalScheduleRepo.listInRange(weekStart, weekEnd);
  if (res.error) throw res.error;
  return res.data.map(toWeekActivity);
}

export function useWeekActivities(weekStart: string, weekEnd: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.internalSchedule.range(weekStart, weekEnd);

  const {
    data: activities = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchWeekActivities(weekStart, weekEnd),
    enabled: !!user && !!weekStart && !!weekEnd,
    staleTime: 30_000,
  });

  /**
   * Datas reais / responsável. `updates` traz só o que a pessoa mexeu; um
   * valor pode ser calculado da linha (ex.: "Concluir" sem início usa o
   * início previsto da PRÓPRIA linha). Item de primeiro nível ligado ao
   * cliente grava também na atividade do cliente (como o Calendário sempre
   * fez), com os padrões calculados da linha do cliente. Micro-etapa: só interno.
   */
  const updateDates = useMutation({
    mutationFn: async ({
      activityId,
      updates,
    }: {
      activityId: string;
      updates: MirrorChange;
    }) => {
      const a = activities.find((x) => x.id === activityId);
      if (!a) throw new Error("Atividade não encontrada no calendário. Recarregue a página.");
      await updateInternalMirroringClient(
        {
          id: a.id,
          project_id: a.project_id,
          parent_id: a.parent_activity_id,
          client_activity_id: a.client_activity_id,
          actual_start: a.actual_start,
          actual_end: a.actual_end,
          planned_start: a.planned_start,
          responsible_user_id: a.responsible_user_id,
        },
        updates,
      );
      return { activityId, updates };
    },
    onMutate: async ({ activityId, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<WeekActivity[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<WeekActivity[]>(
          queryKey,
          prev.map((a) => (a.id === activityId ? { ...a, ...resolveMirrorChange(updates, a) } : a)),
        );
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error(internalScheduleErrorMessage(e) || "Erro ao salvar atividade");
    },
    onSuccess: () => {
      invalidateInternalScheduleQueries(queryClient);
      toast.success("Atividade atualizada");
    },
  });

  /**
   * Cria N micro-etapas no cronograma INTERNO, penduradas no item-mãe
   * (`parent_id`). Herdam etapa, responsável e prestador da mãe quando a
   * linha não escolhe outro. O cronograma do cliente não muda.
   */
  const breakIntoSubActivities = useMutation({
    mutationFn: async ({
      parent,
      subs,
    }: {
      parent: WeekActivity;
      subs: SubActivityInput[];
    }) => {
      if (!user) throw new Error("Sessão expirada");
      if (parent.parent_activity_id) {
        throw new Error("Micro-etapa não pode ser dividida de novo (máximo de 2 níveis).");
      }
      const baseSortOrder = (parent.sort_order ?? 0) + 1;
      // Divide o peso da mãe igualmente entre as micro-etapas.
      const childWeight =
        subs.length > 0
          ? Math.max(0.01, Number((parent.weight / subs.length).toFixed(2)))
          : 0;

      const rows = subs.map((s, idx) => ({
        project_id: parent.project_id,
        parent_id: parent.id,
        description: s.description.trim(),
        planned_start: s.planned_start,
        planned_end: s.planned_end,
        weight: Math.min(100, childWeight),
        sort_order: baseSortOrder + idx,
        etapa: parent.etapa ?? null,
        predecessor_ids: [],
        responsible_user_id:
          s.responsible_user_id !== undefined
            ? s.responsible_user_id
            : (parent.responsible_user_id ?? null),
        fornecedor_id:
          s.fornecedor_id !== undefined
            ? s.fornecedor_id
            : (parent.fornecedor_id ?? null),
      }));

      const res = await internalScheduleRepo.createMany(rows);
      if (res.error) throw res.error;
      return { parentId: parent.id, count: subs.length };
    },
    onError: (err: unknown) => {
      toast.error(internalScheduleErrorMessage(err) || "Erro ao criar micro-etapas");
    },
    onSuccess: (res) => {
      invalidateInternalScheduleQueries(queryClient);
      toast.success(`${res.count} micro-etapa(s) criada(s)`);
    },
  });

  /** Remove TODAS as micro-etapas de um item-mãe (mescla de volta). */
  const mergeSubActivities = useMutation({
    mutationFn: async (parentId: string) => {
      const res = await internalScheduleRepo.removeChildren(parentId);
      if (res.error) throw res.error;
      return parentId;
    },
    onError: () => toast.error("Erro ao mesclar micro-etapas"),
    onSuccess: () => {
      invalidateInternalScheduleQueries(queryClient);
      toast.success("Micro-etapas removidas");
    },
  });

  /** Remove UMA micro-etapa específica (não a mãe). */
  const removeSubActivity = useMutation({
    mutationFn: async (subId: string) => {
      const res = await internalScheduleRepo.remove(subId);
      if (res.error) throw res.error;
      return subId;
    },
    onError: () => toast.error("Erro ao remover micro-etapa"),
    onSuccess: () => {
      invalidateInternalScheduleQueries(queryClient);
      toast.success("Micro-etapa removida");
    },
  });

  // Group by project for convenience.
  // Items inside each project are ordered by effective start date:
  // actual_start when present, otherwise planned_start (ascending).
  // Tie-break by planned_end so shorter / earlier-ending tasks come first.
  const byProject = useMemo(() => {
    const map = new Map<
      string,
      {
        project_id: string;
        project_name: string;
        client_name: string | null;
        project_status: string | null;
        items: WeekActivity[];
      }
    >();
    for (const a of activities) {
      if (!map.has(a.project_id)) {
        map.set(a.project_id, {
          project_id: a.project_id,
          project_name: a.project_name,
          client_name: a.client_name,
          project_status: a.project_status,
          items: [],
        });
      }
      map.get(a.project_id)!.items.push(a);
    }
    for (const group of map.values()) {
      group.items.sort((a, b) => {
        const aStart = a.actual_start ?? a.planned_start;
        const bStart = b.actual_start ?? b.planned_start;
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        return a.planned_end.localeCompare(b.planned_end);
      });
    }
    return Array.from(map.values()).sort((x, y) =>
      x.project_name.localeCompare(y.project_name, "pt-BR"),
    );
  }, [activities]);

  return {
    activities,
    byProject,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    updateDates: (activityId: string, updates: MirrorChange) =>
      updateDates.mutateAsync({ activityId, updates }),
    isUpdating: updateDates.isPending,
    breakIntoSubActivities: (parent: WeekActivity, subs: SubActivityInput[]) =>
      breakIntoSubActivities.mutateAsync({ parent, subs }),
    isBreaking: breakIntoSubActivities.isPending,
    mergeSubActivities: (parentId: string) =>
      mergeSubActivities.mutateAsync(parentId),
    isMerging: mergeSubActivities.isPending,
    removeSubActivity: (subId: string) => removeSubActivity.mutateAsync(subId),
    isRemovingSub: removeSubActivity.isPending,
  };
}
