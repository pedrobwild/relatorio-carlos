import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-project-inbound (Portal BWild)
 *
 * Receives project data FROM Envision when a budget reaches contrato_fechado.
 * Validates fields, upserts into the local projects table, and logs the sync.
 *
 * POST body:
 *   { project: { ...fields }, source_id: string }
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
    const { project, source_id } = body;

    // --- Validate required fields ---
    const errors: string[] = [];
    if (!source_id) errors.push("source_id é obrigatório");
    if (!project) errors.push("project é obrigatório");
    if (project && !project.name?.trim()) errors.push("project.name é obrigatório");
    if (project && !project.client_name?.trim()) errors.push("project.client_name é obrigatório");

    if (errors.length > 0) {
      return jsonResponse({ error: "Validation failed", details: errors }, 400);
    }

    // --- Map to local projects schema ---
    const projectPayload: Record<string, unknown> = {
      name: project.name.trim(),
      client_name: project.client_name.trim(),
      client_phone: project.client_phone ?? null,
      client_email: project.client_email ?? null,
      address: project.address ?? null,
      condominium: project.condominium ?? null,
      neighborhood: project.neighborhood ?? null,
      city: project.city ?? null,
      unit_name: project.unit ?? project.unit_name ?? null,
      property_type: project.property_type ?? "Apartamento",
      total_area: project.total_area ?? null,
      estimated_duration_weeks: project.estimated_duration_weeks ?? null,
      budget_value: typeof project.budget_value === "number" ? project.budget_value : null,
      budget_code: project.budget_code ?? null,
      status: "draft",
      notes: project.notes ?? null,
      consultora_comercial: project.consultora_comercial ?? null,
    };

    // --- Upsert: check if already linked ---
    const { data: existing } = await db
      .from("projects")
      .select("id")
      .eq("external_id", source_id)
      .eq("external_system", "envision")
      .maybeSingle();

    let projectId: string;

    if (existing) {
      const { error: updateErr } = await db.from("projects").update(projectPayload).eq("id", existing.id);
      if (updateErr) {
        console.error("[sync-project-inbound] Update error:", updateErr.message);
        return jsonResponse({ error: updateErr.message }, 500);
      }
      projectId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await db
        .from("projects")
        .insert({
          ...projectPayload,
          external_id: source_id,
          external_system: "envision",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      projectId = inserted.id;
    }

    // --- Log sync ---
    await db.from("integration_sync_log").upsert({
      source_system: "envision",
      target_system: "portal_bwild",
      entity_type: "project",
      source_id: source_id,
      target_id: projectId,
      sync_status: "success",
      payload: project,
      attempts: 1,
      synced_at: new Date().toISOString(),
    }, {
      onConflict: "source_system,entity_type,source_id",
    });

    return jsonResponse({
      status: "success",
      project_id: projectId,
      action: existing ? "updated" : "created",
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-project-inbound error:", errMsg);
    return jsonResponse({ error: errMsg }, 500);
  }
});
