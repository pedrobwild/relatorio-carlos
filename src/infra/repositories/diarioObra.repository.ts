/**
 * Diário de obra (relatório de campo diário) — ver a migration
 * `20261124120000_diario_obra.sql`.
 *
 * Leitura: obras, etapas do cronograma interno, equipe, fornecedores, itens
 * de material e os relatos já enviados. Escrita: só pelas RPCs
 * `diario_obra_enviar` e `diario_obra_salvar_texto_cliente` (o banco revalida
 * as regras e aplica os efeitos numa transação).
 *
 * As tabelas `diario_obra*` ainda não estão nos tipos gerados
 * (`integrations/supabase/types.ts`); por isso o acesso sem tipo abaixo, com
 * os tipos das linhas declarados aqui.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { opsRepo } from "./ops.repository";
import type { StatusEtapa, TipoMedicao } from "@/lib/diarioObra/regras";

const WEEKLY_REPORTS_BUCKET = "weekly-reports";

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

export interface DiarioObraOption {
  id: string;
  name: string;
  unit_name: string | null;
  budget_code: string | null;
  planned_start_date: string | null;
  actual_start_date: string | null;
}

export interface DiarioEtapaRow {
  id: string;
  parent_id: string | null;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_end: string | null;
  sort_order: number;
}

/** Etapa de um relato já enviado, com o que a tela do cliente precisa. */
export interface DiarioRelatoRow {
  id: string;
  item_id: string | null;
  description: string;
  status: StatusEtapa;
  photo_path: string;
  marco: "eletrica" | "medicao" | null;
  medicao_tipo: TipoMedicao | null;
  texto_cliente: string | null;
  diario: {
    id: string;
    report_date: string;
    team_count: number;
    created_at: string;
    weekly: { available_at: string | null } | null;
  } | null;
  /** Pendências que esta etapa abriu naquele relato. */
  pendencias: number;
}

export interface DiarioPessoa {
  user_id: string;
  name: string;
}

export interface DiarioFornecedor {
  id: string;
  nome: string;
  categoria: string | null;
}

export interface DiarioItemMaterial {
  id: string;
  item_name: string;
}

export interface DiarioEnvioResult {
  id: string;
  weekly_report_id: string | null;
  week_number: number | null;
  duplicate: boolean;
}

/** Tira o que quebraria o filtro `or(...)` do PostgREST. */
const limparBusca = (termo: string) => termo.replace(/[%,()*\\]/g, " ").trim().slice(0, 40);

export const diarioObraRepo = {
  /** Obras em andamento ou pausadas a que a pessoa tem acesso (a RLS filtra). */
  async listObras() {
    return executeListQuery<DiarioObraOption>(async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, unit_name, budget_code, planned_start_date, actual_start_date")
        .is("deleted_at", null)
        // Mesmas obras da gaveta Registrar: em andamento ou pausadas.
        .or("status.is.null,status.in.(active,paused)")
        .order("name", { ascending: true });
      return { data: (data as DiarioObraOption[] | null) ?? [], error };
    });
  },

  /** Cronograma interno da obra (a tela usa só as etapas sem filhas). */
  async listEtapas(projectId: string) {
    return executeListQuery<DiarioEtapaRow>(async () => {
      const { data, error } = await supabase
        .from("internal_schedule_items")
        .select("id, parent_id, description, planned_start, planned_end, actual_end, sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("planned_start", { ascending: true });
      return { data: (data as DiarioEtapaRow[] | null) ?? [], error };
    });
  },

  /** Etapas relatadas na obra, da mais recente para a mais antiga. */
  async listRelatos(projectId: string) {
    return executeListQuery<DiarioRelatoRow>(async () => {
      const { data, error } = await unsafeFrom("diario_obra_etapas")
        .select(
          "id, item_id, description, status, photo_path, marco, medicao_tipo, texto_cliente, " +
            "diario:diario_obra!inner(id, report_date, team_count, created_at, weekly:weekly_reports(available_at))",
        )
        .eq("project_id", projectId)
        .limit(500);
      if (error) return { data: null, error };
      const rows = ((data ?? []) as Array<Omit<DiarioRelatoRow, "pendencias">>).map((r) => ({ ...r, pendencias: 0 }));

      const diarioIds = [...new Set(rows.flatMap((r) => (r.diario ? [r.diario.id] : [])))];
      if (diarioIds.length > 0) {
        const pend = await unsafeFrom("diario_obra_pendencias")
          .select("diario_id, etapa_item_id")
          .in("diario_id", diarioIds)
          .not("etapa_item_id", "is", null);
        if (!pend.error) {
          for (const p of (pend.data ?? []) as Array<{ diario_id: string; etapa_item_id: string }>) {
            const row = rows.find((r) => r.diario?.id === p.diario_id && r.item_id === p.etapa_item_id);
            if (row) row.pendencias += 1;
          }
        }
      }
      rows.sort(
        (a, b) =>
          (b.diario?.report_date ?? "").localeCompare(a.diario?.report_date ?? "") ||
          (b.diario?.created_at ?? "").localeCompare(a.diario?.created_at ?? ""),
      );
      return { data: rows, error: null };
    });
  },

  /** Pessoas da equipe da obra (engenheiros e membros), para "responsável". */
  async listEquipe(projectId: string) {
    return executeListQuery<DiarioPessoa>(async () => {
      const [eng, mem] = await Promise.all([
        supabase.from("project_engineers").select("engineer_user_id").eq("project_id", projectId),
        supabase.from("project_members").select("user_id, role").eq("project_id", projectId),
      ]);
      if (eng.error) return { data: null, error: eng.error };
      const ids = new Set<string>((eng.data ?? []).map((e) => e.engineer_user_id));
      for (const m of mem.data ?? []) if (m.role !== "customer") ids.add(m.user_id);
      if (ids.size === 0) return { data: [], error: null };

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", [...ids]);
      if (error) return { data: null, error };
      const pessoas = (data ?? [])
        .filter((p) => !!p.display_name?.trim())
        .map((p) => ({ user_id: p.user_id, name: (p.display_name as string).trim() }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return { data: pessoas, error: null };
    });
  },

  /** Fornecedores por nome, categoria ou serviço (para a medição). */
  async buscarFornecedores(termo: string) {
    return executeListQuery<DiarioFornecedor>(async () => {
      const t = limparBusca(termo);
      let q = supabase.from("fornecedores").select("id, nome, categoria").order("nome", { ascending: true }).limit(8);
      if (t) {
        q = q.or(
          `nome.ilike.%${t}%,categoria.ilike.%${t}%,supplier_subcategory.ilike.%${t}%,produtos_servicos.ilike.%${t}%`,
        );
      }
      const { data, error } = await q;
      return { data: (data as DiarioFornecedor[] | null) ?? [], error };
    });
  },

  /** Itens comprados para a obra (o que pode chegar). */
  async listItensMaterial(projectId: string) {
    return executeListQuery<DiarioItemMaterial>(async () => {
      const { data, error } = await supabase
        .from("project_purchases")
        .select("id, item_name")
        .eq("project_id", projectId)
        .order("item_name", { ascending: true })
        .limit(80);
      const itens = ((data as DiarioItemMaterial[] | null) ?? []).filter((i) => !!i.item_name?.trim());
      return { data: itens, error };
    });
  },

  /** Envia o diário. Idempotente pelo `client_id` do payload. */
  async enviar(payload: Record<string, unknown>) {
    return executeQuery<DiarioEnvioResult>(async () => {
      const { data, error } = await unsafeRpc("diario_obra_enviar", { p_payload: payload as unknown as Json });
      return { data: (data as DiarioEnvioResult | null) ?? null, error };
    });
  },

  /** Ajusta o texto do cliente de uma etapa relatada (antes de ficar visível). */
  async salvarTextoCliente(etapaId: string, texto: string) {
    return executeQuery<{ id: string; available_at: string | null }>(async () => {
      const { data, error } = await unsafeRpc("diario_obra_salvar_texto_cliente", {
        p_etapa_id: etapaId,
        p_texto: texto,
      });
      return { data: (data as { id: string; available_at: string | null } | null) ?? null, error };
    });
  },

  /** URLs temporárias (1 h) das fotos de etapa. */
  async urlsDasFotos(paths: string[]) {
    if (paths.length === 0) return { data: [] as { path: string; url: string }[], error: null };
    const { data, error } = await supabase.storage.from(WEEKLY_REPORTS_BUCKET).createSignedUrls(paths, 3600);
    if (error) return { data: null, error };
    return {
      data: (data ?? []).flatMap((d) => (d.signedUrl && d.path ? [{ path: d.path, url: d.signedUrl }] : [])),
      error: null,
    };
  },

  /** Foto de divergência de material: interna, no bucket das fotos de campo. */
  async uploadFotoDivergencia(projectId: string, file: File, key: string) {
    return opsRepo.uploadPhoto(projectId, "diario", file, key);
  },
};
