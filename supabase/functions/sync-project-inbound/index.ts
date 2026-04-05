import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-project-inbound
 * 
 * Receives project data from Envision Build Guide when a budget reaches "contrato_fechado".
 * Creates the project, org (if needed), and customer record in Portal BWild.
 * 
 * Authenticated via x-integration-key header.
 * 
 * Expected payload from Envision:
 * {
 *   _source_system: "envision",
 *   _source_id: "<budget_id>",
 *   project_name: string,
 *   client_name: string,
 *   client_phone: string | null,
 *   client_email: string | null,
 *   condominio: string | null,
 *   bairro: string | null,
 *   city: string | null,
 *   cep: string | null,
 *   address: string | null,
 *   metragem: number | null,
 *   unit: string | null,
 *   total_value: number | null,
 *   planned_start_date: string | null,
 *   planned_end_date: string | null,
 *   contract_signing_date: string | null,
 * }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // --- Validate integration key ---
    const integrationKey = Deno.env.get("INTEGRATION_API_KEY");
    const incomingKey = req.headers.get("x-integration-key");

    if (!integrationKey || !incomingKey || incomingKey !== integrationKey) {
      console.error("[sync-project-inbound] Invalid integration key");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // --- Parse payload ---
    const payload = await req.json();
    const {
      _source_system,
      _source_id,
      project_name,
      client_name,
      client_phone,
      client_email,
      condominio,
      bairro,
      city,
      cep,
      address,
      metragem,
      unit,
      total_value,
      planned_start_date,
      planned_end_date,
      contract_signing_date,
    } = payload;

    if (!_source_system || !_source_id || !project_name) {
      return jsonResponse({ error: "_source_system, _source_id, and project_name are required" }, 400);
    }

    // --- Idempotency: check if already synced ---
    const { data: existingSync } = await supabaseAdmin
      .from("integration_sync_log")
      .select("id, target_id, sync_status")
      .eq("source_system", _source_system)
      .eq("entity_type", "project")
      .eq("source_id", _source_id)
      .maybeSingle();

    if (existingSync?.sync_status === "success" && existingSync.target_id) {
      console.log(`[sync-project-inbound] Already synced: ${existingSync.target_id}`);
      return jsonResponse({
        success: true,
        target_id: existingSync.target_id,
        message: "Already synced",
      });
    }

    // --- Get or create org for the client ---
    const orgName = client_name || "Cliente Envision";
    const orgSlug = orgName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    let orgId: string;

    // Try to find existing org by name
    const { data: existingOrg } = await supabaseAdmin
      .from("orgs")
      .select("id")
      .eq("name", orgName)
      .maybeSingle();

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`[sync-project-inbound] Using existing org: ${orgId}`);
    } else {
      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from("orgs")
        .insert({ name: orgName, slug: orgSlug })
        .select("id")
        .single();

      if (orgError) {
        console.error("[sync-project-inbound] Org creation error:", orgError);
        await logSyncResult(supabaseAdmin, _source_system, _source_id, existingSync?.id, "failed", orgError.message, payload);
        return jsonResponse({ error: "Failed to create org: " + orgError.message }, 500);
      }

      orgId = newOrg.id;
      console.log(`[sync-project-inbound] Created org: ${orgId}`);
    }

    // --- Build address from Envision fields ---
    const fullAddress = [address, condominio, bairro, city]
      .filter(Boolean)
      .join(", ") || null;

    // --- Build unit name ---
    const unitName = unit
      ? `${unit}${metragem ? ` - ${metragem}m²` : ""}`
      : metragem
        ? `${metragem}m²`
        : null;

    // --- Find a system admin as created_by ---
    const { data: adminUser } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminUser) {
      const errMsg = "No admin user found to assign as project creator";
      console.error("[sync-project-inbound]", errMsg);
      await logSyncResult(supabaseAdmin, _source_system, _source_id, existingSync?.id, "failed", errMsg, payload);
      return jsonResponse({ error: errMsg }, 500);
    }

    // --- Create project ---
    const projectData: Record<string, unknown> = {
      name: project_name,
      org_id: orgId,
      created_by: adminUser.user_id,
      status: "active",
      address: fullAddress,
      bairro: bairro || null,
      cep: cep || null,
      unit_name: unitName,
      contract_value: total_value || null,
      planned_start_date: planned_start_date || null,
      planned_end_date: planned_end_date || null,
      contract_signing_date: contract_signing_date || null,
    };

    const { data: newProject, error: projectError } = await supabaseAdmin
      .from("projects")
      .insert(projectData)
      .select("id")
      .single();

    if (projectError) {
      console.error("[sync-project-inbound] Project creation error:", projectError);
      await logSyncResult(supabaseAdmin, _source_system, _source_id, existingSync?.id, "failed", projectError.message, payload);
      return jsonResponse({ error: "Failed to create project: " + projectError.message }, 500);
    }

    const projectId = newProject.id;
    console.log(`[sync-project-inbound] Created project: ${projectId}`);

    // --- Create customer record ---
    if (client_name) {
      const customerData: Record<string, unknown> = {
        project_id: projectId,
        customer_name: client_name,
        customer_email: client_email || null,
        customer_phone: client_phone || null,
      };

      const { error: customerError } = await supabaseAdmin
        .from("project_customers")
        .insert(customerData);

      if (customerError) {
        console.warn("[sync-project-inbound] Customer creation warning:", customerError.message);
        // Don't fail the whole sync for this
      } else {
        console.log(`[sync-project-inbound] Created customer record for project ${projectId}`);
      }
    }

    // --- Initialize project journey ---
    try {
      await supabaseAdmin.rpc("initialize_project_journey", { p_project_id: projectId });
      console.log(`[sync-project-inbound] Initialized journey for project ${projectId}`);
    } catch (journeyError) {
      console.warn("[sync-project-inbound] Journey init warning:", journeyError);
    }

    // --- Log sync success ---
    await logSyncResult(supabaseAdmin, _source_system, _source_id, existingSync?.id, "success", null, payload, projectId);

    // --- Audit log ---
    try {
      await supabaseAdmin.from("auditoria").insert({
        acao: "create",
        entidade: "projects",
        entidade_id: projectId,
        obra_id: null,
        por_user_id: adminUser.user_id,
        diff: {
          source: "envision_integration",
          budget_id: _source_id,
          project_name,
          client_name,
          contract_value: total_value,
        },
      });
    } catch (auditError) {
      console.warn("[sync-project-inbound] Audit log warning:", auditError);
    }

    console.log(`[sync-project-inbound] ✅ Project ${projectId} created from Envision budget ${_source_id}`);

    return jsonResponse({
      success: true,
      target_id: projectId,
      org_id: orgId,
    });
  } catch (error) {
    console.error("[sync-project-inbound] Fatal error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function logSyncResult(
  supabase: ReturnType<typeof createClient>,
  sourceSystem: string,
  sourceId: string,
  existingSyncId: string | null | undefined,
  status: string,
  errorMessage: string | null,
  payload: unknown,
  targetId?: string,
) {
  if (existingSyncId) {
    await supabase
      .from("integration_sync_log")
      .update({
        sync_status: status,
        error_message: errorMessage,
        target_id: targetId || null,
        synced_at: status === "success" ? new Date().toISOString() : null,
        payload,
      })
      .eq("id", existingSyncId);
  } else {
    await supabase.from("integration_sync_log").insert({
      source_system: sourceSystem,
      target_system: "portal_bwild",
      entity_type: "project",
      source_id: sourceId,
      target_id: targetId || null,
      sync_status: status,
      error_message: errorMessage,
      synced_at: status === "success" ? new Date().toISOString() : null,
      payload,
    });
  }
}
