/**
 * useWeekActivities — fetches all project_activities scheduled for a given week
 * across every project the current user has access to.
 *
 * "Scheduled for the week" = activity whose [planned_start, planned_end] interval
 * intersects the week range. Uses TanStack Query for caching + optimistic updates
 * when the user marks actual start / actual end.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { invalidateActivityQueries } from '@/lib/queryKeys';

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
  baseline_start: string | null;
  baseline_end: string | null;
  baseline_saved_at: string | null;
  weight: number;
  created_at: string;
  updated_at: string;
  /**
   * Se preenchido, indica que esta atividade é uma micro-etapa (sub-atividade)
   * de outra atividade-mãe. Usado para que apenas Admin/Engineer enxerguem o
   * detalhamento interno no Calendário, enquanto clientes veem apenas a
   * atividade-mãe (mais informativa).
   */
  parent_activity_id: string | null;
  /** ID do membro da equipe (Staff) responsável por esta atividade/micro-etapa. */
  responsible_user_id: string | null;
  /** Nome do responsável (pré-resolvido a partir de users_profile). */
  responsible_name: string | null;
}

/** Payload para criar uma micro-etapa (sub-atividade) de uma atividade-mãe. */
export interface SubActivityInput {
  description: string;
  planned_start: string; // YYYY-MM-DD
  planned_end: string;   // YYYY-MM-DD
  /** Opcional: Staff responsável por esta micro-etapa. */
  responsible_user_id?: string | null;
}

interface FetchArgs {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
}

async function fetchWeekActivities({ weekStart, weekEnd }: FetchArgs): Promise<WeekActivity[]> {
  // Interval intersection: planned_start <= weekEnd AND planned_end >= weekStart
  const { data, error } = await supabase
    .from('project_activities')
    .select(`
      id,
      project_id,
      description,
      detailed_description,
      etapa,
      planned_start,
      planned_end,
      actual_start,
      actual_end,
      baseline_start,
      baseline_end,
      baseline_saved_at,
      weight,
      created_at,
      updated_at,
      parent_activity_id,
      responsible_user_id,
      fornecedor_id,
      projects:project_id (
        name,
        client_name,
        status,
        project_customers!project_customers_project_id_fkey (
          customer_name
        )
      ),
      responsible:responsible_user_id ( id, nome ),
      fornecedor:fornecedor_id ( id, nome )
    `)
    // Trazemos atividades cujo intervalo PLANEJADO intersecta a semana
    // OU cujo `actual_start` (data real de início) cai dentro da semana.
    // O segundo caso é essencial para o filtro "obras em andamento nesta
    // semana" da Semana · Timeline: uma atividade pode ter sido iniciada
    // dentro da semana mesmo que seu planejamento original esteja fora do
    // recorte (ex.: começou atrasada). Comparações usam `YYYY-MM-DD` puro
    // (colunas `date` no Postgres) — sem fuso horário envolvido.
    .or(
      `and(planned_start.lte.${weekEnd},planned_end.gte.${weekStart}),and(actual_start.gte.${weekStart},actual_start.lte.${weekEnd})`,
    )
    .order('planned_start', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    project_name: row.projects?.name ?? 'Obra sem nome',
    // Preferimos o nome real do contratante (project_customers.customer_name)
    // pois projects.client_name geralmente vem vazio no banco atual.
    client_name:
      row.projects?.project_customers?.[0]?.customer_name ??
      row.projects?.client_name ??
      null,
    project_status: row.projects?.status ?? null,
    description: row.description,
    detailed_description: row.detailed_description ?? null,
    etapa: row.etapa,
    planned_start: row.planned_start,
    planned_end: row.planned_end,
    actual_start: row.actual_start,
    actual_end: row.actual_end,
    baseline_start: row.baseline_start ?? null,
    baseline_end: row.baseline_end ?? null,
    baseline_saved_at: row.baseline_saved_at ?? null,
    weight: row.weight,
    created_at: row.created_at,
    updated_at: row.updated_at,
    parent_activity_id: row.parent_activity_id ?? null,
    responsible_user_id: row.responsible_user_id ?? null,
    responsible_name: row.responsible?.nome ?? null,
  }));
}

export function useWeekActivities(weekStart: string, weekEnd: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['week-activities', weekStart, weekEnd] as const;

  const { data: activities = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchWeekActivities({ weekStart, weekEnd }),
    enabled: !!user && !!weekStart && !!weekEnd,
    staleTime: 30_000,
  });

  const updateDates = useMutation({
    mutationFn: async ({
      activityId,
      updates,
    }: {
      activityId: string;
      updates: {
        actual_start?: string | null;
        actual_end?: string | null;
        responsible_user_id?: string | null;
      };
    }) => {
      const { error: err } = await supabase
        .from('project_activities')
        .update(updates)
        .eq('id', activityId);
      if (err) throw err;
      return { activityId, updates };
    },
    onMutate: async ({ activityId, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<WeekActivity[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<WeekActivity[]>(
          queryKey,
          prev.map((a) => (a.id === activityId ? { ...a, ...updates } : a)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error('Erro ao salvar atividade');
    },
    onSuccess: (_, vars) => {
      const projectId = activities.find((a) => a.id === vars.activityId)?.project_id;
      if (projectId) invalidateActivityQueries(projectId);
      toast.success('Atividade atualizada');
    },
  });

  /**
   * Cria N micro-etapas (sub-atividades) vinculadas a uma atividade-mãe.
   * Estratégia: enfileira inserts via supabase. Em caso de erro, desfaz nada
   * (RLS protege contra cross-project) e exibe toast. As novas atividades
   * recebem `parent_activity_id` e herdam `etapa` da mãe quando ausente.
   */
  const breakIntoSubActivities = useMutation({
    mutationFn: async ({
      parent,
      subs,
    }: {
      parent: WeekActivity;
      subs: SubActivityInput[];
    }) => {
      if (!user) throw new Error('Sessão expirada');
      // Pega o sort_order da mãe para inserir os children logo após (incremento decimal-like via +1, +2...)
      const { data: parentRow, error: pErr } = await supabase
        .from('project_activities')
        .select('sort_order, etapa, weight')
        .eq('id', parent.id)
        .single();
      if (pErr) throw pErr;

      const baseSortOrder = (parentRow?.sort_order ?? 0) + 1;
      // Distribui o peso da mãe igualmente entre as micro-etapas para que o
      // progresso ponderado total siga somando ~100%. Mantemos a mãe como
      // agregadora visual (cliente segue vendo só ela), mas tecnicamente o
      // peso fica nos children. A mãe permanece com weight original; o
      // sistema de progresso continua funcionando porque as views de cliente
      // filtram por parent_activity_id IS NULL.
      const childWeight =
        subs.length > 0 ? Math.max(0.01, Number((parent.weight / subs.length).toFixed(2))) : 0;

      const rows = subs.map((s, idx) => ({
        project_id: parent.project_id,
        parent_activity_id: parent.id,
        description: s.description.trim(),
        planned_start: s.planned_start,
        planned_end: s.planned_end,
        weight: childWeight,
        sort_order: baseSortOrder + idx,
        created_by: user.id,
        etapa: parentRow?.etapa ?? null,
        predecessor_ids: [],
        // Se o usuário não definir um responsável para a micro-etapa,
        // herda da atividade-mãe (quando existir).
        responsible_user_id:
          s.responsible_user_id !== undefined
            ? s.responsible_user_id
            : parent.responsible_user_id ?? null,
      }));

      const { error: insErr } = await supabase.from('project_activities').insert(rows);
      if (insErr) throw insErr;
      return { parentId: parent.id, count: subs.length };
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Erro ao criar micro-etapas');
    },
    onSuccess: (res, vars) => {
      invalidateActivityQueries(vars.parent.project_id);
      queryClient.invalidateQueries({ queryKey: ['week-activities'] });
      toast.success(`${res.count} micro-etapa(s) criada(s)`);
    },
  });

  /**
   * Remove TODAS as micro-etapas de uma atividade-mãe (mescla de volta).
   */
  const mergeSubActivities = useMutation({
    mutationFn: async (parentId: string) => {
      const { error: err } = await supabase
        .from('project_activities')
        .delete()
        .eq('parent_activity_id', parentId);
      if (err) throw err;
      return parentId;
    },
    onError: () => toast.error('Erro ao mesclar micro-etapas'),
    onSuccess: (parentId) => {
      const projectId = activities.find((a) => a.id === parentId)?.project_id;
      if (projectId) invalidateActivityQueries(projectId);
      queryClient.invalidateQueries({ queryKey: ['week-activities'] });
      toast.success('Micro-etapas removidas');
    },
  });

  /** Remove UMA micro-etapa específica (não a mãe). */
  const removeSubActivity = useMutation({
    mutationFn: async (subId: string) => {
      const { error: err } = await supabase
        .from('project_activities')
        .delete()
        .eq('id', subId);
      if (err) throw err;
      return subId;
    },
    onError: () => toast.error('Erro ao remover micro-etapa'),
    onSuccess: (subId) => {
      const projectId = activities.find((a) => a.id === subId)?.project_id;
      if (projectId) invalidateActivityQueries(projectId);
      queryClient.invalidateQueries({ queryKey: ['week-activities'] });
      toast.success('Micro-etapa removida');
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
    return Array.from(map.values()).sort((x, y) => x.project_name.localeCompare(y.project_name, 'pt-BR'));
  }, [activities]);

  return {
    activities,
    byProject,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    updateDates: (
      activityId: string,
      updates: {
        actual_start?: string | null;
        actual_end?: string | null;
        responsible_user_id?: string | null;
      },
    ) => updateDates.mutateAsync({ activityId, updates }),
    isUpdating: updateDates.isPending,
    breakIntoSubActivities: (parent: WeekActivity, subs: SubActivityInput[]) =>
      breakIntoSubActivities.mutateAsync({ parent, subs }),
    isBreaking: breakIntoSubActivities.isPending,
    mergeSubActivities: (parentId: string) => mergeSubActivities.mutateAsync(parentId),
    isMerging: mergeSubActivities.isPending,
    removeSubActivity: (subId: string) => removeSubActivity.mutateAsync(subId),
    isRemovingSub: removeSubActivity.isPending,
  };
}
