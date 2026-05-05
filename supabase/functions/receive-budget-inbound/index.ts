import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * receive-budget-inbound
 * 
 * Receives budget data from Envision Guide and upserts it into the
 * orcamentos, orcamento_sections, and orcamento_items tables.
 * 
 * Authentication: x-integration-key header validated against INTEGRATION_API_KEY secret.
 * 
 * Payload:
 * {
 *   "budget_id": "envision-budget-uuid",
 *   "sequential_code": "ORC-0122",
 *   "project_name": "André Mathiazzi",
 *   "client_name": "André Mathiazzi",
 *   "property_type": "Apartamento",
 *   "city": "São Paulo",
 *   "bairro": "Vila Clementino",
 *   "metragem": "26",
 *   "condominio": "Trinity Vila Clementino",
 *   "unit": "123",
 *   "briefing": "...",
 *   "demand_context": "...",
 *   "internal_notes": "...",
 *   "reference_links": ["https://..."],
 *   "internal_status": "sent_to_client",
 *   "priority": "normal",
 *   "due_at": "2026-04-15T00:00:00Z",
 *   "commercial_owner_email": "amanda@bwild.com.br",
 *   "estimator_owner_email": "laisa@bwild.com.br",
 *   "project_external_id": "envision-project-uuid",
 *   "sections": [
 *     {
 *       "title": "Marcenaria",
 *       "order_index": 0,
 *       "section_price": 24900,
 *       "is_optional": false,
 *       "items": [
 *         {
 *           "title": "Armário cozinha",
 *           "qty": 1,
 *           "unit": "un",
 *           "internal_unit_price": 3500,
 *           "internal_total": 3500,
 *           "bdi_percentage": 0,
 *           "order_index": 0
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // Validate integration key
    const integrationKey = req.headers.get("x-integration-key");
    const expectedKey = Deno.env.get("INTEGRATION_API_KEY");
    if (!expectedKey || integrationKey !== expectedKey) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    const {
      budget_id,
      sequential_code,
      project_name,
      client_name,
      property_type,
      city,
      bairro,
      metragem,
      condominio,
      unit,
      briefing,
      demand_context,
      internal_notes,
      reference_links,
      internal_status,
      priority,
      due_at,
      commercial_owner_email,
      estimator_owner_email,
      project_external_id,
      sections,
    } = body;

    if (!budget_id || !project_name || !client_name) {
      return jsonResponse({ error: "budget_id, project_name, and client_name are required" }, 400);
    }

    // Resolve owner IDs from emails
    let commercialOwnerId: string | null = null;
    let estimatorOwnerId: string | null = null;

    if (commercial_owner_email) {
      const { data } = await supabaseAdmin
        .from("users_profile")
        .select("id")
        .eq("email", commercial_owner_email)
        .maybeSingle();
      commercialOwnerId = data?.id ?? null;
    }

    if (estimator_owner_email) {
      const { data } = await supabaseAdmin
        .from("users_profile")
        .select("id")
        .eq("email", estimator_owner_email)
        .maybeSingle();
      estimatorOwnerId = data?.id ?? null;
    }

    // Resolve project_id from external_id
    let projectId: string | null = null;
    if (project_external_id) {
      const { data } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("external_id", project_external_id)
        .maybeSingle();
      projectId = data?.id ?? null;
    }

    // Upsert budget
    const { data: orcamento, error: orcError } = await supabaseAdmin
      .from("orcamentos")
      .upsert(
        {
          external_id: budget_id,
          external_system: "envision",
          sequential_code,
          project_name,
          client_name,
          property_type: property_type || null,
          city: city || null,
          bairro: bairro || null,
          metragem: metragem || null,
          condominio: condominio || null,
          unit: unit || null,
          briefing: briefing || null,
          demand_context: demand_context || null,
          internal_notes: internal_notes || null,
          reference_links: reference_links || [],
          internal_status: internal_status || "requested",
          priority: priority || "normal",
          due_at: due_at || null,
          commercial_owner_id: commercialOwnerId,
          estimator_owner_id: estimatorOwnerId,
          project_id: projectId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_id,external_system" }
      )
      .select("id")
      .single();

    if (orcError) {
      console.error("Upsert budget error:", orcError);
      return jsonResponse({ error: orcError.message }, 500);
    }

    const orcamentoId = orcamento.id;

    // If sections provided, replace all existing sections & items
    if (Array.isArray(sections) && sections.length > 0) {
      // Delete existing sections (cascade deletes items)
      const { error: deleteErr } = await supabaseAdmin
        .from("orcamento_sections")
        .delete()
        .eq("orcamento_id", orcamentoId);

      if (deleteErr) {
        console.error("Delete existing sections error:", deleteErr);
        // Continue anyway - new sections will still be inserted
      }

      // Insert sections and items
      for (const sec of sections) {
        if (!sec.title?.trim()) {
          console.warn("Skipping section with empty title");
          continue;
        }

        const { data: secData, error: secError } = await supabaseAdmin
          .from("orcamento_sections")
          .insert({
            orcamento_id: orcamentoId,
            title: sec.title,
            order_index: sec.order_index ?? 0,
            section_price: sec.section_price ?? null,
            is_optional: sec.is_optional ?? false,
          })
          .select("id")
          .single();

        if (secError) {
          console.error("Insert section error:", secError);
          continue;
        }

        if (Array.isArray(sec.items) && sec.items.length > 0) {
          const itemRows = sec.items
            .filter((item: any) => item.title?.trim())
            .map((item: any, idx: number) => ({
              section_id: secData.id,
              title: item.title,
              qty: item.qty ?? null,
              unit: item.unit ?? null,
              internal_unit_price: item.internal_unit_price ?? null,
              internal_total: item.internal_total ?? null,
              bdi_percentage: item.bdi_percentage ?? 0,
              order_index: item.order_index ?? idx,
            }));

          if (itemRows.length > 0) {
            const { error: itemsError } = await supabaseAdmin
              .from("orcamento_items")
              .insert(itemRows);

            if (itemsError) {
              console.error("Insert items error:", itemsError);
            }
          }
        }
      }
    }

    // Log sync
    await supabaseAdmin.from("integration_sync_log").insert({
      source_system: "envision",
      target_system: "bwild",
      entity_type: "orcamento",
      source_id: budget_id,
      target_id: orcamentoId,
      sync_status: "success",
      synced_at: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      orcamento_id: orcamentoId,
      sections_count: sections?.length ?? 0,
    });
  } catch (err: any) {
    console.error("receive-budget-inbound error:", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
