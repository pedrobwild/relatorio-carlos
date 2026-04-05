import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-suppliers-outbound
 * 
 * Pushes a Portal BWild supplier (fornecedores) to the Envision Build Guide.
 * Called by staff via the UI or by a trigger/cron.
 * 
 * Body: { supplier_id: string }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // --- Auth: require staff ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization required" }, 401);

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user.id });
    if (!isStaff) return jsonResponse({ error: "Staff access required" }, 403);

    // --- Input ---
    const { supplier_id } = await req.json();
    if (!supplier_id) return jsonResponse({ error: "supplier_id is required" }, 400);

    // --- Fetch supplier ---
    const { data: supplier, error: fetchErr } = await supabaseAdmin
      .from("fornecedores")
      .select("*")
      .eq("id", supplier_id)
      .single();

    if (fetchErr || !supplier) {
      return jsonResponse({ error: "Supplier not found" }, 404);
    }

    // --- Check if already synced ---
    const { data: existing } = await supabaseAdmin
      .from("integration_sync_log")
      .select("id, target_id, sync_status")
      .eq("source_system", "portal_bwild")
      .eq("entity_type", "supplier")
      .eq("source_id", supplier_id)
      .maybeSingle();

    // --- Map fields Portal BWild → Envision ---
    const envisionPayload = {
      name: supplier.nome,
      razao_social: supplier.razao_social,
      cnpj_cpf: supplier.cnpj_cpf,
      categoria: supplier.categoria,
      endereco: supplier.endereco,
      cidade: supplier.cidade,
      estado: supplier.estado,
      email: supplier.email,
      telefone: supplier.telefone,
      site: supplier.site,
      condicoes_pagamento: supplier.condicoes_pagamento,
      prazo_entrega_dias: supplier.prazo_entrega_dias,
      produtos_servicos: supplier.produtos_servicos,
      nota: supplier.nota_avaliacao,
      is_active: supplier.status === "ativo",
      // Pass the Portal BWild ID for the Envision side to store
      _source_system: "portal_bwild",
      _source_id: supplier_id,
    };

    // --- Log sync attempt ---
    if (!existing) {
      await supabaseAdmin.from("integration_sync_log").insert({
        source_system: "portal_bwild",
        target_system: "envision",
        entity_type: "supplier",
        source_id: supplier_id,
        sync_status: "pending",
        payload: envisionPayload,
      });
    } else {
      await supabaseAdmin
        .from("integration_sync_log")
        .update({
          sync_status: "pending",
          payload: envisionPayload,
          attempts: (existing as any).attempts ? (existing as any).attempts + 1 : 1,
          error_message: null,
        })
        .eq("id", existing.id);
    }

    // --- Call Envision inbound endpoint ---
    const envisionUrl = Deno.env.get("ENVISION_SUPABASE_URL");
    const envisionServiceKey = Deno.env.get("ENVISION_SERVICE_ROLE_KEY");
    const integrationKey = Deno.env.get("INTEGRATION_API_KEY");

    if (!envisionUrl || !integrationKey || !envisionServiceKey) {
      await supabaseAdmin
        .from("integration_sync_log")
        .update({ sync_status: "failed", error_message: "Missing integration config" })
        .eq("source_system", "portal_bwild")
        .eq("entity_type", "supplier")
        .eq("source_id", supplier_id);
      return jsonResponse({ error: "Integration not configured" }, 500);
    }

    const response = await fetch(`${envisionUrl}/functions/v1/sync-suppliers-inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${envisionServiceKey}`,
        "x-integration-key": integrationKey,
      },
      body: JSON.stringify(envisionPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      await supabaseAdmin
        .from("integration_sync_log")
        .update({
          sync_status: "failed",
          error_message: result.error || `HTTP ${response.status}`,
        })
        .eq("source_system", "portal_bwild")
        .eq("entity_type", "supplier")
        .eq("source_id", supplier_id);

      return jsonResponse({ error: "Sync failed", details: result }, response.status);
    }

    // --- Mark success ---
    await supabaseAdmin
      .from("integration_sync_log")
      .update({
        sync_status: "success",
        target_id: result.target_id || null,
        synced_at: new Date().toISOString(),
      })
      .eq("source_system", "portal_bwild")
      .eq("entity_type", "supplier")
      .eq("source_id", supplier_id);

    console.log(`[sync-outbound] Supplier ${supplier_id} synced to Envision: ${result.target_id}`);

    return jsonResponse({
      success: true,
      source_id: supplier_id,
      target_id: result.target_id,
    });
  } catch (error) {
    console.error("[sync-outbound] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
