/**
 * Tela Obras (Fase 5) — leituras de carteira (várias obras de uma vez).
 *
 * Uma consulta por tabela para todas as obras ativas, em lotes de ids para
 * não estourar o limite de linhas do PostgREST nem o tamanho da URL.
 * Staff-only: as tabelas da camada de Operação não têm policy para cliente.
 */
import { supabase, executeListQuery } from "./base.repository";
import type { Database, Tables } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export type PortfolioStage = Pick<
  Tables<"project_activities">,
  "id" | "project_id" | "description" | "sort_order" | "planned_start" | "planned_end" | "actual_start" | "actual_end"
>;

export type PortfolioActivity = {
  id: string | null;
  project_id: string | null;
  stage_id: string | null;
  title: string | null;
  status: Enums["ops_activity_status"] | null;
  is_critical: boolean | null;
  late_finish: string | null;
  assignments_not_done: number | null;
};

export type PortfolioMaterial = Pick<
  Tables<"ops_materials">,
  "id" | "project_id" | "activity_id" | "description" | "needed_by" | "status"
>;

export type PortfolioAssignment = Pick<
  Tables<"ops_assignments">,
  "id" | "project_id" | "activity_id" | "work_date" | "outcome"
>;

/** Tamanho do lote de ids por consulta. */
export const PORTFOLIO_CHUNK = 25;

export function chunk<T>(list: readonly T[], size = PORTFOLIO_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Executa `run` por lote e junta tudo; o primeiro erro interrompe. */
async function inChunks<T>(
  ids: readonly string[],
  run: (ids: string[]) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return { data: [], error: null };
  const parts = await Promise.all(chunk(unique).map((part) => run(part)));
  const failed = parts.find((p) => p.error);
  if (failed) return { data: [], error: failed.error };
  return { data: parts.flatMap((p) => p.data ?? []), error: null };
}

export const obrasPanelRepo = {
  /** Etapas do cronograma (datas previstas e reais) das obras. */
  async listStages(projectIds: readonly string[]) {
    return inChunks<PortfolioStage>(projectIds, (ids) =>
      executeListQuery<PortfolioStage>(async () =>
        await supabase
          .from("project_activities")
          .select("id, project_id, description, sort_order, planned_start, planned_end, actual_start, actual_end")
          .in("project_id", ids)
          .order("sort_order", { ascending: true }),
      ),
    );
  },

  /** Atividades abertas ou críticas — o que pode gerar alerta. */
  async listActivities(projectIds: readonly string[]) {
    return inChunks<PortfolioActivity>(projectIds, (ids) =>
      executeListQuery<PortfolioActivity>(async () =>
        await supabase
          .from("v_ops_activities")
          .select("id, project_id, stage_id, title, status, is_critical, late_finish, assignments_not_done")
          .in("project_id", ids)
          .not("status", "in", "(aprovada,concluida)"),
      ),
    );
  },

  /** Material que ainda não está na obra. */
  async listOpenMaterials(projectIds: readonly string[]) {
    return inChunks<PortfolioMaterial>(projectIds, (ids) =>
      executeListQuery<PortfolioMaterial>(async () =>
        await supabase
          .from("ops_materials")
          .select("id, project_id, activity_id, description, needed_by, status")
          .in("project_id", ids)
          .neq("status", "na_obra"),
      ),
    );
  },

  /** Dias marcados na semana (para "Esta semana" e "semana planejada"). */
  async listAssignments(projectIds: readonly string[], from: string, to: string) {
    return inChunks<PortfolioAssignment>(projectIds, (ids) =>
      executeListQuery<PortfolioAssignment>(async () =>
        await supabase
          .from("ops_assignments")
          .select("id, project_id, activity_id, work_date, outcome")
          .in("project_id", ids)
          .gte("work_date", from)
          .lte("work_date", to),
      ),
    );
  },
};
