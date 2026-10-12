/**
 * Fase de projeto — `project_phase_steps` (uma linha por obra × etapa).
 *
 * Responsável, prazo, conclusão e observação de cada uma das seis etapas
 * antes da obra. As linhas nascem sob demanda: obra sem linha = nada
 * registrado ainda.
 *
 * O banco faz o resto (ver a migration 20261012130000): ao mudar uma
 * conclusão, um gatilho atualiza em `projects` a etapa do Painel, as datas de
 * aprovação e — na aprovação do condomínio — o início oficial (5 dias úteis
 * depois) e o início do prazo contratual. Por isso, depois de gravar, as
 * listas de obras e o prazo contratual precisam ser relidos (os hooks de
 * `useProjectPhase` já fazem isso).
 *
 * RLS: a equipe com acesso à obra lê; grava quem tem 'projectPhase:edit'.
 * O cliente não vê esta tabela.
 */
import {
  supabase,
  executeListQuery,
  executeQuery,
  type RepositoryListResult,
  type RepositoryResult,
} from "./base.repository";
import { chunk, PAGE_SIZE } from "./obrasPanel.repository";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";

export type ProjectPhaseStep = Tables<"project_phase_steps">;
export type ProjectPhaseStepKey = Database["public"]["Enums"]["project_phase_step"];

/**
 * O que a tela pode gravar numa etapa. Só os campos PRESENTES são enviados:
 * `undefined` (ou campo ausente) = não mexe; `null` = limpa.
 */
export interface SaveProjectPhaseStepInput {
  project_id: string;
  step: ProjectPhaseStepKey;
  /** Prazo combinado (yyyy-mm-dd). */
  due_date?: string | null;
  /** Dia em que a etapa foi concluída (yyyy-mm-dd, nunca no futuro); null reabre. */
  done_at?: string | null;
  /** `users_profile.id` de quem responde pela etapa. */
  responsible_user_id?: string | null;
  notes?: string | null;
}

const EDITABLE_FIELDS = ["due_date", "done_at", "responsible_user_id", "notes"] as const;

/** Lê todas as páginas de uma consulta (o PostgREST corta em 1000 linhas). */
async function allPages<T>(
  page: (from: number, to: number) => Promise<RepositoryListResult<T>>,
): Promise<RepositoryListResult<T>> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await page(from, from + PAGE_SIZE - 1);
    if (res.error) return { data: [], error: res.error };
    out.push(...res.data);
    if (res.data.length < PAGE_SIZE) return { data: out, error: null };
  }
}

export const projectPhaseRepo = {
  /** Etapas registradas de uma obra, na ordem do fluxo. Lista vazia = nada registrado. */
  async listSteps(projectId: string): Promise<RepositoryListResult<ProjectPhaseStep>> {
    return executeListQuery<ProjectPhaseStep>(async () =>
      await supabase
        .from("project_phase_steps")
        .select("*")
        .eq("project_id", projectId)
        .order("step", { ascending: true }),
    );
  },

  /**
   * Etapas registradas de várias obras de uma vez (carteira). Os ids vão em
   * lotes, para não estourar o tamanho da URL, e cada lote é lido até a
   * última página. O primeiro erro interrompe e devolve lista vazia + erro.
   */
  async listStepsForProjects(projectIds: readonly string[]): Promise<RepositoryListResult<ProjectPhaseStep>> {
    const unique = [...new Set(projectIds)].filter(Boolean);
    if (unique.length === 0) return { data: [], error: null };

    const parts = await Promise.all(
      chunk(unique).map((ids) =>
        allPages<ProjectPhaseStep>((first, last) =>
          executeListQuery<ProjectPhaseStep>(async () =>
            await supabase
              .from("project_phase_steps")
              .select("*")
              .in("project_id", ids)
              .order("id", { ascending: true })
              .range(first, last),
          ),
        ),
      ),
    );
    const failed = parts.find((p) => p.error);
    if (failed) return { data: [], error: failed.error };
    return { data: parts.flatMap((p) => p.data), error: null };
  },

  /**
   * Cria a linha da etapa ou atualiza SÓ os campos enviados: o que não veio
   * em `input` fica como está no banco (duas pessoas editando campos
   * diferentes da mesma etapa não apagam o trabalho uma da outra).
   *
   * O banco recusa, com mensagem em português, conclusão no futuro.
   */
  async saveStep(input: SaveProjectPhaseStepInput): Promise<RepositoryResult<ProjectPhaseStep>> {
    const payload: TablesInsert<"project_phase_steps"> = {
      project_id: input.project_id,
      step: input.step,
    };
    for (const field of EDITABLE_FIELDS) {
      const value = input[field];
      if (value !== undefined) payload[field] = value;
    }

    return executeQuery<ProjectPhaseStep>(async () =>
      await supabase
        .from("project_phase_steps")
        .upsert(payload, { onConflict: "project_id,step" })
        .select("*")
        .single(),
    );
  },

  /**
   * "Esta obra está NA etapa X": conclui as anteriores (hoje, se ainda não
   * tinham data) e reabre X e as seguintes — tudo numa transação, no banco
   * (RPC `move_project_to_phase_step`). Prazo, responsável e observação das
   * etapas não mudam. Recusa obra que já saiu da fase de projeto.
   */
  async moveToStep(projectId: string, step: ProjectPhaseStepKey): Promise<RepositoryResult<null>> {
    return executeQuery<null>(async () => {
      const { error } = await supabase.rpc("move_project_to_phase_step", {
        p_project_id: projectId,
        p_step: step,
      });
      return { data: null, error };
    });
  },
};
