import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-supplier-inbound (Portal BWild)
 *
 * Receives supplier/fornecedor data FROM Envision.
 * Validates the integration key, validates fields, and upserts into fornecedores.
 *
 * POST body:
 *   { fornecedor: { ...fields }, source_id: string }
 *   { fornecedores: [{ ...fields, source_id }] }  — batch
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // --- Auth ---
    const integrationKey = req.headers.get("x-integration-key");
    const expectedKey = Deno.env.get("INTEGRATION_API_KEY");

    if (!expectedKey) {
      return jsonResponse({ error: "INTEGRATION_API_KEY not configured" }, 500);
    }
    if (integrationKey !== expectedKey) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();

    // Normalize to array
    const items: Array<{ fornecedor: Record<string, unknown>; source_id: string }> = body.fornecedores
      ? body.fornecedores.map((f: Record<string, unknown>) => ({ fornecedor: f, source_id: (f.source_id ?? f.id) as string }))
      : [{ fornecedor: body.fornecedor, source_id: body.source_id }];

    const results: Array<{
      source_id: string;
      status: string;
      supplier_id?: string;
      action?: string;
      error?: string;
    }> = [];

    for (const { fornecedor, source_id } of items) {
      // --- Validate ---
      if (!fornecedor || !source_id) {
        results.push({ source_id: source_id ?? "unknown", status: "skipped", error: "Missing data" });
        continue;
      }

      const nome = ((fornecedor.nome ?? fornecedor.name ?? "") as string).trim();
      if (!nome) {
        results.push({ source_id, status: "skipped", error: "Nome do fornecedor é obrigatório" });
        continue;
      }

      try {
        // Map Envision payload → Portal BWild fornecedores
        const payload = mapToFornecedor(fornecedor);

        // Upsert by external_id
        const { data: existing } = await db
          .from("fornecedores")
          .select("id")
          .eq("external_id", source_id)
          .eq("external_system", "envision")
          .maybeSingle();

        let fornecedorId: string;
        let action: string;

        if (existing) {
          await db.from("fornecedores").update(payload).eq("id", existing.id);
          fornecedorId = existing.id;
          action = "updated";
        } else {
          const { data: inserted, error: insertErr } = await db
            .from("fornecedores")
            .insert({
              ...payload,
              external_id: source_id,
              external_system: "envision",
            })
            .select("id")
            .single();
          if (insertErr) throw insertErr;
          fornecedorId = inserted.id;
          action = "created";
        }

        // Log sync
        await db.from("integration_sync_log").upsert({
          source_system: "envision",
          target_system: "portal_bwild",
          entity_type: "supplier",
          source_id: source_id,
          target_id: fornecedorId,
          sync_status: "success",
          payload: fornecedor,
          attempts: 1,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: "source_system,entity_type,source_id",
        });

        results.push({ source_id, status: "success", supplier_id: fornecedorId, action });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to sync fornecedor ${source_id}:`, errMsg);

        await db.from("integration_sync_log").upsert({
          source_system: "envision",
          target_system: "portal_bwild",
          entity_type: "supplier",
          source_id: source_id,
          sync_status: "failed",
          payload: fornecedor,
          error_message: errMsg,
          attempts: 1,
        }, {
          onConflict: "source_system,entity_type,source_id",
        });

        results.push({ source_id, status: "failed", error: errMsg });
      }
    }

    return jsonResponse({ results });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-supplier-inbound error:", errMsg);
    return jsonResponse({ error: errMsg }, 500);
  }
});

/**
 * Maps Envision supplier payload → Portal BWild fornecedores row.
 * Uses correct supplier_category enum values: materiais, mao_de_obra, servicos, equipamentos, outros
 */
function mapToFornecedor(f: Record<string, unknown>) {
  return {
    nome: ((f.nome ?? f.name ?? "") as string).trim(),
    razao_social: f.razao_social ?? null,
    cnpj_cpf: f.cnpj_cpf ?? null,
    categoria: mapCategoria(f.categoria as string | null | undefined),
    supplier_type: f.tipo ?? f.supplier_type ?? null,
    supplier_subcategory: f.subcategoria ?? f.supplier_subcategory ?? null,
    endereco: f.endereco ?? null,
    cidade: f.cidade ?? null,
    estado: f.estado ?? null,
    cep: f.cep ?? null,
    email: f.email ?? null,
    telefone: f.telefone ?? null,
    site: f.site ?? null,
    condicoes_pagamento: f.condicoes_pagamento ?? null,
    prazo_entrega_dias: f.prazo_entrega_dias ?? null,
    produtos_servicos: f.produtos_servicos ?? null,
    nota_avaliacao: f.nota ?? f.nota_avaliacao ?? null,
    observacoes: f.observacoes ?? null,
    status: f.is_active === false ? "inativo" : "ativo",
  };
}

/**
 * Map Envision categoria to Portal BWild supplier_category enum.
 * Valid values: materiais, mao_de_obra, servicos, equipamentos, outros
 */
function mapCategoria(cat: string | null | undefined): string {
  if (!cat) return "outros";
  const lower = cat.toLowerCase().trim();

  const validCategories = ["materiais", "mao_de_obra", "servicos", "equipamentos", "outros"];
  if (validCategories.includes(lower)) return lower;

  if (lower.includes("material") || lower.includes("construcao") || lower.includes("construção")) return "materiais";
  if (lower.includes("mao") || lower.includes("mão") || lower.includes("obra") || lower.includes("trabalh")) return "mao_de_obra";
  if (lower.includes("servic") || lower.includes("serviç")) return "servicos";
  if (lower.includes("equip")) return "equipamentos";
  if (lower.includes("eletric") || lower.includes("elétric")) return "servicos";
  if (lower.includes("hidraul") || lower.includes("hidrául")) return "servicos";
  if (lower.includes("pintura")) return "servicos";
  if (lower.includes("acabamento")) return "materiais";
  if (lower.includes("estrutur")) return "materiais";
  if (lower.includes("ferrag")) return "materiais";

  return "outros";
}
