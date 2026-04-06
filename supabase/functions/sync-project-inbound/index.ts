import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-project-inbound (Portal BWild)
 *
 * Receives project + budget data FROM Envision when a budget reaches contrato_fechado.
 * Validates fields, upserts into the local projects table, creates budget records, and logs the sync.
 *
 * POST body:
 *   { source_id: string, project: { ...fields }, budget?: { ...fields } }
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
    const { project, source_id, budget } = body;

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

    // --- Process budget if provided ---
    let orcamentoId: string | null = null;
    if (budget && typeof budget === "object") {
      orcamentoId = await processBudget(db, source_id, projectId, project, budget);
    }

    // --- Log sync ---
    await db.from("integration_sync_log").upsert({
      source_system: "envision",
      target_system: "portal_bwild",
      entity_type: "project",
      source_id: source_id,
      target_id: projectId,
      sync_status: "success",
      payload: { project, budget: budget ? { total_value: budget.total_value, sections_count: budget.sections?.length } : null },
      attempts: 1,
      synced_at: new Date().toISOString(),
    }, {
      onConflict: "source_system,entity_type,source_id",
    });

    return jsonResponse({
      status: "success",
      project_id: projectId,
      orcamento_id: orcamentoId,
      action: existing ? "updated" : "created",
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-project-inbound error:", errMsg);
    return jsonResponse({ error: errMsg }, 500);
  }
});

/**
 * Process the budget object from the Envision payload.
 * Upserts into orcamentos, orcamento_sections, orcamento_items, and orcamento_adjustments.
 */
async function processBudget(
  db: any,
  sourceId: string,
  projectId: string,
  project: any,
  budget: any,
): Promise<string> {
  // Upsert main budget record
  const { data: orcamento, error: orcError } = await db
    .from("orcamentos")
    .upsert(
      {
        external_id: sourceId,
        external_system: "envision",
        project_id: projectId,
        sequential_code: project.budget_code ?? null,
        project_name: project.name?.trim() ?? "",
        client_name: project.client_name?.trim() ?? "",
        property_type: project.property_type ?? null,
        city: project.city ?? null,
        bairro: project.neighborhood ?? null,
        metragem: project.total_area ?? null,
        condominio: project.condominium ?? null,
        unit: project.unit ?? null,
        internal_status: "approved",
        priority: "normal",
        total_value: budget.total_value ?? null,
        total_sale: budget.total_sale ?? null,
        total_cost: budget.total_cost ?? null,
        avg_bdi: budget.avg_bdi ?? null,
        net_margin: budget.net_margin ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "external_id,external_system" }
    )
    .select("id")
    .single();

  if (orcError) {
    console.error("[sync-project-inbound] Budget upsert error:", orcError.message);
    throw orcError;
  }

  const orcamentoId = orcamento.id;

  // Replace sections & items
  if (Array.isArray(budget.sections) && budget.sections.length > 0) {
    // Delete existing (cascade deletes items)
    await db.from("orcamento_sections").delete().eq("orcamento_id", orcamentoId);

    for (const sec of budget.sections) {
      const { data: secData, error: secError } = await db
        .from("orcamento_sections")
        .insert({
          orcamento_id: orcamentoId,
          title: sec.title,
          subtitle: sec.subtitle ?? null,
          notes: sec.notes ?? null,
          order_index: sec.order_index ?? 0,
          section_price: sec.section_price ?? null,
          is_optional: sec.is_optional ?? false,
          cover_image_url: sec.cover_image_url ?? null,
          included_bullets: sec.included_bullets ?? null,
          excluded_bullets: sec.excluded_bullets ?? null,
          tags: sec.tags ?? null,
          cost: sec.cost ?? null,
          bdi_percentage: sec.bdi_percentage ?? null,
          item_count: sec.item_count ?? (sec.items?.length ?? 0),
        })
        .select("id")
        .single();

      if (secError) {
        console.error("[sync-project-inbound] Section insert error:", secError.message);
        continue;
      }

      if (Array.isArray(sec.items) && sec.items.length > 0) {
        const itemRows = sec.items.map((item: any, idx: number) => ({
          section_id: secData.id,
          title: item.title,
          description: item.description ?? null,
          qty: item.qty ?? null,
          unit: item.unit ?? null,
          internal_unit_price: item.internal_unit_price ?? null,
          internal_total: item.internal_total ?? null,
          bdi_percentage: item.bdi_percentage ?? 0,
          order_index: item.order_index ?? idx,
          included_rooms: item.included_rooms ?? null,
          excluded_rooms: item.excluded_rooms ?? null,
          coverage_type: item.coverage_type ?? null,
          reference_url: item.reference_url ?? null,
          notes: item.notes ?? null,
          // v1.1 fields:
          item_category: item.item_category ?? null,
          supplier_id: item.supplier_id ?? null,
          supplier_name: item.supplier_name ?? null,
          catalog_item_id: item.catalog_item_id ?? null,
        }));

        const { error: itemsError } = await db
          .from("orcamento_items")
          .insert(itemRows);

        if (itemsError) {
          console.error("[sync-project-inbound] Items insert error:", itemsError.message);
        }
      }
    }
  }

  // Replace adjustments
  await db.from("orcamento_adjustments").delete().eq("orcamento_id", orcamentoId);

  if (Array.isArray(budget.adjustments) && budget.adjustments.length > 0) {
    const adjustmentRows = budget.adjustments.map((adj: any, idx: number) => ({
      orcamento_id: orcamentoId,
      external_id: adj.id ?? null,
      label: adj.label,
      amount: adj.amount ?? 0,
      sign: adj.sign ?? 1,
      order_index: idx,
    }));

    const { error: adjError } = await db
      .from("orcamento_adjustments")
      .insert(adjustmentRows);

    if (adjError) {
      console.error("[sync-project-inbound] Adjustments insert error:", adjError.message);
    }
  }

  // Also log budget sync
  await db.from("integration_sync_log").insert({
    source_system: "envision",
    target_system: "bwild",
    entity_type: "orcamento",
    source_id: sourceId,
    target_id: orcamentoId,
    sync_status: "success",
    synced_at: new Date().toISOString(),
  });

  return orcamentoId;
}
