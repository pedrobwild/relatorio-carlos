/**
 * Bwild Compras no Workflow — cópia somente leitura e vínculo de obra.
 * Ver a migration `20261124140000_compras_espelho_e_vinculo.sql`.
 *
 * O Workflow só LÊ o Compras (função `sync-compras-pull`). O sigilo é do
 * banco: as tabelas `compras_*` só têm policy de leitura para `is_staff()`;
 * cliente não lê nada. Vincular passa pela RPC `compras_decidir_vinculo`,
 * sempre uma obra por vez — nunca por semelhança de texto.
 *
 * As tabelas ainda não estão nos tipos gerados; por isso o acesso sem tipo.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { PostgrestError } from "@supabase/supabase-js";

export type ComprasVinculoStatus = "pendente" | "confirmado" | "ignorado";

export interface ComprasObraVinculo {
  id: string;
  chave: string;
  cliente: string;
  empreendimento: string | null;
  unidade: string | null;
  project_id: string | null;
  status: ComprasVinculoStatus;
  decidido_por_nome: string | null;
  decidido_em: string | null;
  ultima_vez_em: string;
  /** Solicitações ativas desta obra na cópia. */
  solicitacoes: number;
  project: { id: string; name: string } | null;
}

export interface ComprasSyncExecucao {
  id: string;
  origem: string;
  iniciado_em: string;
  terminado_em: string | null;
  ok: boolean | null;
  solicitacoes: number | null;
  obras_novas: number | null;
  erro: string | null;
}

export interface ObraWorkflowOpcao {
  id: string;
  name: string;
  unit_name: string | null;
  customer_name: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnsafeBuilder = any;
const unsafeFrom = (table: string): UnsafeBuilder =>
  (supabase.from as unknown as (t: string) => UnsafeBuilder)(table);
const unsafeRpc = (fn: string, args: Record<string, unknown>) =>
  (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: PostgrestError | null }>
  )(fn, args);

export const comprasSyncRepo = {
  /** Obras que existem no Compras, com a obra do Workflow quando já vinculada. */
  async listVinculos() {
    return executeListQuery<ComprasObraVinculo>(async () => {
      const { data, error } = await unsafeFrom("compras_obra_vinculos")
        .select(
          "id, chave, cliente, empreendimento, unidade, project_id, status, decidido_por_nome, decidido_em, ultima_vez_em, project:projects(id, name), compras_solicitacoes(count)",
        )
        .is("compras_solicitacoes.removido_em", null)
        .order("cliente", { ascending: true });
      if (error) return { data: null, error };
      const rows = ((data ?? []) as UnsafeBuilder[]).map((r) => ({
        ...r,
        solicitacoes: Number(r.compras_solicitacoes?.[0]?.count ?? 0),
        compras_solicitacoes: undefined,
      })) as ComprasObraVinculo[];
      return { data: rows, error: null };
    });
  },

  /** Obras do Workflow para escolher no vínculo (nome, unidade e cliente). */
  async listObrasWorkflow() {
    return executeListQuery<ObraWorkflowOpcao>(async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, unit_name, project_customers(customer_name)")
        .order("name", { ascending: true });
      if (error) return { data: null, error };
      const rows = ((data ?? []) as UnsafeBuilder[]).map((p) => ({
        id: p.id,
        name: p.name,
        unit_name: p.unit_name ?? null,
        customer_name: p.project_customers?.[0]?.customer_name ?? null,
      })) as ObraWorkflowOpcao[];
      return { data: rows, error: null };
    });
  },

  async ultimaExecucao() {
    return executeQuery<ComprasSyncExecucao | null>(async () => {
      return await unsafeFrom("compras_sync_execucoes")
        .select("id, origem, iniciado_em, terminado_em, ok, solicitacoes, obras_novas, erro")
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
    });
  },

  /** Confirma, desfaz ou ignora o vínculo de UMA obra do Compras. */
  async decidirVinculo(
    vinculoId: string,
    acao: "confirmar" | "desfazer" | "ignorar",
    projectId?: string,
  ) {
    return executeQuery<ComprasObraVinculo>(async () => {
      const { data, error } = await unsafeRpc("compras_decidir_vinculo", {
        p_vinculo_id: vinculoId,
        p_acao: acao,
        p_project_id: projectId ?? null,
      });
      return { data: data as ComprasObraVinculo | null, error };
    });
  },
};
