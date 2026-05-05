import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-suppliers-inbound
 * 
 * Receives a supplier from the Envision Build Guide and upserts into Portal BWild fornecedores.
 * Authenticated via x-integration-key header.
 * 
 * Body: supplier payload with _source_system and _source_id
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // --- Validate integration key ---
    const integrationKey = Deno.env.get("INTEGRATION_API_KEY");
    const incomingKey = req.headers.get("x-integration-key");

    if (!integrationKey || !incomingKey || incomingKey !== integrationKey) {
      console.error("[sync-inbound] Invalid integration key");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // --- Parse payload ---
    const payload = await req.json();
    const {
      name, razao_social, cnpj_cpf, categoria, endereco, cidade, estado,
      email, telefone, site, condicoes_pagamento, prazo_entrega_dias,
      produtos_servicos, nota, is_active,
      _source_system, _source_id,
      // New taxonomy fields from Envision
      tipo, supplier_type, subcategoria, supplier_subcategory,
    } = payload;

    if (!name || !_source_system || !_source_id) {
      return jsonResponse({ error: "name, _source_system, and _source_id are required" }, 400);
    }

    // --- Check if already synced (idempotency) ---
    const { data: existingSync } = await supabaseAdmin
      .from("integration_sync_log")
      .select("id, target_id")
      .eq("source_system", _source_system)
      .eq("entity_type", "supplier")
      .eq("source_id", _source_id)
      .maybeSingle();

    // --- Map to Portal BWild schema ---
    const legacyCategoria = mapCategoria(categoria);
    const rawSubcategory = subcategoria ?? supplier_subcategory ?? null;
    const rawType = tipo ?? supplier_type ?? null;

    // Determine supplier_type: explicit > inferred from subcategory > inferred from legacy
    const resolvedType = rawType
      ?? (rawSubcategory ? inferTypeFromSubcategory(rawSubcategory) : null)
      ?? LEGACY_TO_TYPE[legacyCategoria]
      ?? null;

    const supplierData: Record<string, unknown> = {
      nome: name,
      razao_social: razao_social || null,
      cnpj_cpf: cnpj_cpf || null,
      categoria: legacyCategoria,
      supplier_type: resolvedType,
      supplier_subcategory: rawSubcategory,
      endereco: endereco || null,
      cidade: cidade || null,
      estado: estado || null,
      email: email || null,
      telefone: telefone || null,
      site: site || null,
      condicoes_pagamento: condicoes_pagamento || null,
      prazo_entrega_dias: prazo_entrega_dias || null,
      produtos_servicos: produtos_servicos || null,
      nota_avaliacao: nota || null,
      status: is_active === false ? "inativo" : "ativo",
    };

    let targetId: string;

    if (existingSync?.target_id) {
      // Update existing supplier
      const { error: updateErr } = await supabaseAdmin
        .from("fornecedores")
        .update(supplierData)
        .eq("id", existingSync.target_id);

      if (updateErr) {
        console.error("[sync-inbound] Update error:", updateErr.message);
        await logSyncResult(supabaseAdmin, _source_system, _source_id, existingSync.id, "failed", updateErr.message);
        return jsonResponse({ error: updateErr.message }, 500);
      }

      targetId = existingSync.target_id;
      console.log(`[sync-inbound] Updated supplier ${targetId}`);
    } else {
      // Insert new supplier
      const { data: newSupplier, error: insertErr } = await supabaseAdmin
        .from("fornecedores")
        .insert({
          ...supplierData,
          external_id: _source_id,
          external_system: _source_system,
        })
        .select("id")
        .single();

      if (insertErr || !newSupplier) {
        console.error("[sync-inbound] Insert error:", insertErr?.message);
        const syncId = existingSync?.id;
        if (syncId) {
          await logSyncResult(supabaseAdmin, _source_system, _source_id, syncId, "failed", insertErr?.message);
        }
        return jsonResponse({ error: insertErr?.message || "Insert failed" }, 500);
      }

      targetId = newSupplier.id;
      console.log(`[sync-inbound] Created supplier ${targetId}`);
    }

    // --- Log sync success ---
    if (existingSync) {
      await supabaseAdmin
        .from("integration_sync_log")
        .update({
          target_id: targetId,
          sync_status: "success",
          synced_at: new Date().toISOString(),
          payload,
        })
        .eq("id", existingSync.id);
    } else {
      await supabaseAdmin.from("integration_sync_log").insert({
        source_system: _source_system,
        target_system: "portal_bwild",
        entity_type: "supplier",
        source_id: _source_id,
        target_id: targetId,
        sync_status: "success",
        synced_at: new Date().toISOString(),
        payload,
      });
    }

    return jsonResponse({ success: true, target_id: targetId });
  } catch (error) {
    console.error("[sync-inbound] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ── Subcategory → supplier_type inference ────────────────────
const PRESTADORES_SUBCATEGORIES = [
  'Marcenaria', 'Empreita', 'Vidraçaria Box', 'Vidraçaria Sacada',
  'Eletricista', 'Pintor', 'Instalador de Piso', 'Técnico Ar-Condicionado',
  'Gesseiro', 'Serviços Gerais', 'Limpeza', 'Pedreiro',
  'Instalador Fechadura Digital', 'Cortinas', 'Marmoraria', 'Jardim Vertical',
];

const PRODUTOS_SUBCATEGORIES = [
  'Eletrodomésticos', 'Enxoval', 'Espelhos', 'Decoração', 'Revestimentos',
  'Luminárias', 'Cadeiras e Mesas', 'Camas', 'Sofás e Poltronas',
  'Tapeçaria', 'Torneiras e Cubas', 'Materiais Elétricos',
  'Materiais de Construção', 'Acessórios Banheiro', 'Fechadura Digital', 'Tintas',
];

function inferTypeFromSubcategory(sub: string): string | null {
  if (PRESTADORES_SUBCATEGORIES.includes(sub)) return 'prestadores';
  if (PRODUTOS_SUBCATEGORIES.includes(sub)) return 'produtos';
  return null;
}

const LEGACY_TO_TYPE: Record<string, string> = {
  mao_de_obra: 'prestadores',
  servicos: 'prestadores',
  materiais: 'produtos',
  equipamentos: 'produtos',
  outros: 'produtos',
};

/**
 * Map Envision categoria to Portal BWild supplier_category enum.
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

async function logSyncResult(
  supabase: ReturnType<typeof createClient>,
  sourceSystem: string,
  sourceId: string,
  syncId: string,
  status: string,
  errorMessage?: string | null,
) {
  await supabase
    .from("integration_sync_log")
    .update({
      sync_status: status,
      error_message: errorMessage || null,
    })
    .eq("id", syncId);
}
