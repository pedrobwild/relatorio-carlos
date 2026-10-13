/**
 * Cronograma INTERNO da obra (`internal_schedule_items`) — somente staff.
 *
 * Nasce como cópia do cronograma do cliente (`project_activities`) e depois
 * evolui sozinho: datas puxadas, micro-etapas, responsável e prestador da
 * equipe. Nada daqui chega ao cliente (RLS: staff com acesso à obra lê;
 * papéis de 'schedule:edit' gravam). Quem gravou e quando é carimbado pelo
 * banco — o front não envia `created_by`/`updated_by`.
 *
 * O cronograma do cliente só é LIDO aqui (`listClientDates`), para comparar
 * datas; nunca é alterado por este repositório.
 */
import { supabase, executeListQuery, executeQuery, type RepositoryResult } from "./base.repository";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type InternalScheduleItem = Tables<"internal_schedule_items">;

/** Item com o nome do responsável e do prestador já resolvidos. */
export type InternalScheduleItemWithRefs = InternalScheduleItem & {
  responsible: { id: string; nome: string } | null;
  fornecedor: { id: string; nome: string } | null;
};

/** Datas de uma atividade do cronograma do cliente (só leitura, para comparar). */
export type ClientActivityDates = {
  id: string;
  description: string;
  planned_start: string;
  planned_end: string;
  parent_activity_id: string | null;
};

export type InternalScheduleInsert = Omit<
  TablesInsert<"internal_schedule_items">,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;

export type InternalSchedulePatch = Omit<
  TablesUpdate<"internal_schedule_items">,
  "id" | "project_id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;

/** Item com o nome da obra (leituras de carteira: calendário, lookahead…). */
export type InternalScheduleItemWithProject = InternalScheduleItem & {
  project: { id: string; name: string; status: string | null } | null;
  responsible: { id: string; nome: string } | null;
  fornecedor: { id: string; nome: string } | null;
};

/** Item com a obra e o nome do cliente da obra (Calendário de obras). */
export type InternalScheduleItemWithCustomer = InternalScheduleItem & {
  project:
    | { id: string; name: string; status: string | null; project_customers: { customer_name: string | null }[] | null }
    | null;
  responsible: { id: string; nome: string } | null;
  fornecedor: { id: string; nome: string } | null;
};

const REFS_SELECT =
  "*, responsible:users_profile!internal_schedule_items_responsible_user_id_fkey(id, nome), fornecedor:fornecedores!internal_schedule_items_fornecedor_id_fkey(id, nome)";

const WITH_PROJECT_SELECT = `${REFS_SELECT}, project:projects!internal_schedule_items_project_id_fkey(id, name, status)`;

const WITH_CUSTOMER_SELECT = `${REFS_SELECT}, project:projects!internal_schedule_items_project_id_fkey(id, name, status, project_customers!project_customers_project_id_fkey(customer_name))`;

export const internalScheduleRepo = {
  /** Cronograma interno da obra, na ordem do cronograma. */
  async listByProject(projectId: string) {
    return executeListQuery<InternalScheduleItemWithRefs>(async () => {
      return (await supabase
        .from("internal_schedule_items")
        .select(REFS_SELECT)
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("planned_start", { ascending: true })) as unknown as {
        data: InternalScheduleItemWithRefs[] | null;
        error: PostgrestError | null;
      };
    });
  },

  /** Datas do cronograma do cliente da obra (só leitura, para a comparação). */
  async listClientDates(projectId: string) {
    return executeListQuery<ClientActivityDates>(async () => {
      return await supabase
        .from("project_activities")
        .select("id, description, planned_start, planned_end, parent_activity_id")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
    });
  },

  async create(input: InternalScheduleInsert) {
    return executeQuery<InternalScheduleItem>(async () => {
      return await supabase
        .from("internal_schedule_items")
        .insert(input as TablesInsert<"internal_schedule_items">)
        .select("*")
        .single();
    });
  },

  /** Várias linhas de uma vez (micro-etapas criadas pelo Calendário). */
  async createMany(inputs: InternalScheduleInsert[]) {
    if (inputs.length === 0) return { data: [] as InternalScheduleItem[], error: null };
    return executeListQuery<InternalScheduleItem>(async () => {
      return await supabase
        .from("internal_schedule_items")
        .insert(inputs as TablesInsert<"internal_schedule_items">[])
        .select("*");
    });
  },

  async update(id: string, patch: InternalSchedulePatch) {
    return executeQuery<InternalScheduleItem>(async () => {
      return await supabase
        .from("internal_schedule_items")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  /**
   * Espelha na atividade do CLIENTE as datas reais e o responsável marcados
   * no Calendário / Lookahead — o mesmo que essas telas sempre gravaram no
   * cronograma do cliente. Só esses três campos; nada mais do interno vaza.
   */
  async mirrorToClientActivity(
    clientActivityId: string,
    patch: Partial<Pick<TablesUpdate<"project_activities">, "actual_start" | "actual_end" | "responsible_user_id">>,
  ) {
    const clean: TablesUpdate<"project_activities"> = {};
    if ("actual_start" in patch) clean.actual_start = patch.actual_start ?? null;
    if ("actual_end" in patch) clean.actual_end = patch.actual_end ?? null;
    if ("responsible_user_id" in patch) clean.responsible_user_id = patch.responsible_user_id ?? null;
    return executeQuery<null>(async () => {
      const { error } = await supabase.from("project_activities").update(clean).eq("id", clientActivityId);
      return { data: null, error };
    });
  },

  /** Apaga o item (as micro-etapas vão junto — ON DELETE CASCADE). */
  async remove(id: string) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.from("internal_schedule_items").delete().eq("id", id);
      return { data: null, error };
    });
  },

  /** Apaga todas as micro-etapas de um item. */
  async removeChildren(parentId: string) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.from("internal_schedule_items").delete().eq("parent_id", parentId);
      return { data: null, error };
    });
  },

  /**
   * Grava a nova ordem. Só as linhas que mudaram são enviadas; a primeira
   * falha interrompe e é devolvida (a tela relê o cronograma).
   */
  async reorder(changes: ReadonlyArray<{ id: string; sort_order: number }>): Promise<RepositoryResult<null>> {
    for (const c of changes) {
      const res = await executeQuery<null>(async () => {
        const { error } = await supabase
          .from("internal_schedule_items")
          .update({ sort_order: c.sort_order })
          .eq("id", c.id);
        return { data: null, error };
      });
      if (res.error) return res;
    }
    return { data: null, error: null };
  },

  /**
   * Quantas atividades da Semana/Hoje (`ops_activities`) estão penduradas
   * nestes itens. Apagar o item deixa essas atividades "sem etapa".
   */
  async countOpsActivities(itemIds: readonly string[]): Promise<RepositoryResult<number>> {
    if (itemIds.length === 0) return { data: 0, error: null };
    return executeQuery<number>(async () => {
      const { count, error } = await supabase
        .from("ops_activities")
        .select("id", { count: "exact", head: true })
        .in("stage_id", [...itemIds]);
      return { data: count ?? 0, error };
    });
  },

  /**
   * Copia o cronograma do cliente para o interno. `replace` = apaga o
   * interno e copia de novo (as atividades da Semana passam para os itens
   * novos da mesma atividade do cliente). Devolve quantas linhas copiou.
   */
  async copyFromClient(projectId: string, replace: boolean): Promise<RepositoryResult<number>> {
    return executeQuery<number>(async () => {
      const { data, error } = await supabase.rpc("copy_client_schedule_to_internal", {
        p_project_id: projectId,
        p_replace: replace,
      });
      return { data: typeof data === "number" ? data : Number(data ?? 0), error };
    });
  },

  // ---------------- leituras de carteira (várias obras) ----------------

  /**
   * Itens cujo previsto cruza o intervalo OU que começaram de fato dentro
   * dele (Calendário de obras). Datas são `date` no banco: sem fuso.
   */
  async listInRange(from: string, to: string) {
    return executeListQuery<InternalScheduleItemWithCustomer>(async () => {
      return (await supabase
        .from("internal_schedule_items")
        .select(WITH_CUSTOMER_SELECT)
        .or(
          `and(planned_start.lte.${to},planned_end.gte.${from}),and(actual_start.gte.${from},actual_start.lte.${to})`,
        )
        .order("planned_start", { ascending: true })) as unknown as {
        data: InternalScheduleItemWithCustomer[] | null;
        error: PostgrestError | null;
      };
    });
  },

  /** Itens que começam no intervalo e ainda não terminaram (Lookahead). */
  async listStartingBetween(from: string, to: string, limit = 500) {
    return executeListQuery<InternalScheduleItemWithProject>(async () => {
      return (await supabase
        .from("internal_schedule_items")
        .select(WITH_PROJECT_SELECT)
        .gte("planned_start", from)
        .lte("planned_start", to)
        .is("actual_end", null)
        .order("planned_start", { ascending: true })
        .limit(limit)) as unknown as {
        data: InternalScheduleItemWithProject[] | null;
        error: PostgrestError | null;
      };
    });
  },

  /** Itens em aberto de um responsável (Minha semana). */
  async listOpenByResponsible(userId: string, limit = 200) {
    return executeListQuery<InternalScheduleItemWithProject>(async () => {
      return (await supabase
        .from("internal_schedule_items")
        .select(WITH_PROJECT_SELECT)
        .eq("responsible_user_id", userId)
        .is("actual_end", null)
        .order("planned_end", { ascending: true })
        .limit(limit)) as unknown as {
        data: InternalScheduleItemWithProject[] | null;
        error: PostgrestError | null;
      };
    });
  },

  /** Obras com item sem responsável começando no intervalo (exceções do Painel). */
  async listUnassignedStarting(from: string, to: string) {
    return executeListQuery<Pick<InternalScheduleItem, "project_id">>(async () => {
      return await supabase
        .from("internal_schedule_items")
        .select("project_id")
        .is("responsible_user_id", null)
        .gte("planned_start", from)
        .lte("planned_start", to);
    });
  },

  /** Itens cujo previsto cruza o intervalo (filtro de período do Painel). */
  async listOverlapping(from: string, to: string) {
    return executeListQuery<InternalScheduleItemWithProject>(async () => {
      return (await supabase
        .from("internal_schedule_items")
        .select(WITH_PROJECT_SELECT)
        .lte("planned_start", to)
        .gte("planned_end", from)
        .order("planned_start", { ascending: true })) as unknown as {
        data: InternalScheduleItemWithProject[] | null;
        error: PostgrestError | null;
      };
    });
  },

  /** Itens com fim previsto antes de `before` ainda sem término real. */
  async listOpenEndingBefore(before: string) {
    return executeListQuery<InternalScheduleItemWithProject>(async () => {
      return (await supabase
        .from("internal_schedule_items")
        .select(WITH_PROJECT_SELECT)
        .lt("planned_end", before)
        .is("actual_end", null)
        .order("planned_end", { ascending: true })) as unknown as {
        data: InternalScheduleItemWithProject[] | null;
        error: PostgrestError | null;
      };
    });
  },

  /** Itens de várias obras (etapa atual de cada obra). */
  async listByProjects(projectIds: readonly string[]) {
    if (projectIds.length === 0) return { data: [] as InternalScheduleItem[], error: null };
    return executeListQuery<InternalScheduleItem>(async () => {
      return await supabase
        .from("internal_schedule_items")
        .select("*")
        .in("project_id", [...projectIds])
        .order("sort_order", { ascending: true });
    });
  },
};

