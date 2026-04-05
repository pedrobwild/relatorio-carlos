import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-integration-key",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const integrationKey = req.headers.get("x-integration-key");
    const expectedKey = Deno.env.get("INTEGRATION_API_KEY");

    if (!expectedKey) {
      throw new Error("INTEGRATION_API_KEY not configured");
    }
    if (integrationKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      status: project.status ?? "planning",
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
      await db.from("projects").update(projectPayload).eq("id", existing.id);
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

    return new Response(JSON.stringify({
      status: "success",
      project_id: projectId,
      action: existing ? "updated" : "created",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("sync-project-inbound error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
