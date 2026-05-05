import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-monitor-agent
 *
 * AI-powered sync monitor that analyzes failed integration syncs,
 * diagnoses the issue, corrects the payload, and retries automatically.
 *
 * Called by DB trigger when integration_sync_log.sync_status = 'failed'
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const INTEGRATION_API_KEY = Deno.env.get("INTEGRATION_API_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const {
      sync_log_id,
      source_system,
      target_system,
      entity_type,
      source_id,
      error_message,
      payload,
      attempts,
    } = body;

    if (!sync_log_id || !error_message) {
      return jsonResponse({ error: "sync_log_id and error_message required" }, 400);
    }

    if (!LOVABLE_API_KEY) {
      console.error("[sync-monitor] LOVABLE_API_KEY not configured");
      return jsonResponse({ error: "AI not configured" }, 500);
    }

    console.log(
      `[sync-monitor] Analyzing failure for ${entity_type} ${source_id} (attempt ${attempts + 1})`
    );

    // --- Schema info for the target table ---
    const targetTable = entity_type === "supplier" ? "fornecedores" : "projects";

    const schemaInfo = entity_type === "supplier"
      ? `nome (text, NOT NULL), razao_social (text), cnpj_cpf (text), categoria (supplier_category enum: materiais|mao_de_obra|servicos|equipamentos|outros), supplier_type (text), supplier_subcategory (text), endereco (text), cidade (text), estado (text), cep (text), email (text), telefone (text), site (text), condicoes_pagamento (text), prazo_entrega_dias (integer), produtos_servicos (text), nota_avaliacao (numeric), observacoes (text), status (text: ativo/inativo), external_id (text), external_system (text)`
      : `name (text, NOT NULL), client_name (text), client_phone (text), client_email (text), address (text), condominium (text), neighborhood (text), city (text), unit_name (text), property_type (text), total_area (numeric), estimated_duration_weeks (integer), budget_value (numeric), budget_code (text), status (text), notes (text), consultora_comercial (text), external_id (text), external_system (text)`;

    // --- Call AI to diagnose and fix ---
    const systemPrompt = `You are a database integration expert for Portal BWild (construction management platform).
Your job is to analyze failed data sync operations between Envision Build Guide and Portal BWild, 
diagnose the error, and produce a corrected payload.

Target table: ${targetTable}
Target table schema:
${schemaInfo}

RULES:
1. Only use columns that exist in the target table schema
2. Map field names from the source payload to the correct column names
3. Ensure data types match (e.g., numbers for numeric columns)
4. Required fields must not be null
5. For the 'fornecedores' table: 'nome' is required, 'status' should be 'ativo' or 'inativo', 'categoria' MUST be one of: materiais, mao_de_obra, servicos, equipamentos, outros
6. For the 'projects' table: 'name' is required
7. Remove any fields that don't exist in the target table

Respond with a JSON object containing:
{
  "diagnosis": "Brief explanation of what went wrong (in Portuguese)",
  "root_cause": "technical|mapping|validation|schema",
  "corrected_payload": { ... the fixed payload ... },
  "confidence": "high|medium|low",
  "changes_made": ["list of changes in Portuguese"]
}`;

    const userPrompt = `A sync operation failed with this error:

ERROR: ${error_message}

ENTITY TYPE: ${entity_type}
SOURCE SYSTEM: ${source_system}
TARGET SYSTEM: ${target_system}
SOURCE ID: ${source_id}

ORIGINAL PAYLOAD:
${JSON.stringify(payload, null, 2)}

Analyze the error, diagnose the root cause, and produce a corrected payload that will succeed.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "sync_diagnosis",
                description: "Provide diagnosis and corrected payload for a failed sync",
                parameters: {
                  type: "object",
                  properties: {
                    diagnosis: { type: "string", description: "Brief explanation in Portuguese" },
                    root_cause: {
                      type: "string",
                      enum: ["technical", "mapping", "validation", "schema"],
                    },
                    corrected_payload: {
                      type: "object",
                      description: "The corrected payload to retry",
                    },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                    changes_made: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of changes made in Portuguese",
                    },
                  },
                  required: ["diagnosis", "root_cause", "corrected_payload", "confidence", "changes_made"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "sync_diagnosis" } },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[sync-monitor] AI error:", aiResponse.status, errText);

      await db
        .from("integration_sync_log")
        .update({
          sync_status: "needs_manual_review",
          ai_diagnosis: `Falha na análise IA (HTTP ${aiResponse.status})`,
          attempts: (attempts || 0) + 1,
        })
        .eq("id", sync_log_id);

      return jsonResponse({ error: "AI analysis failed", status: aiResponse.status }, 500);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("[sync-monitor] No tool call in AI response");
      await db
        .from("integration_sync_log")
        .update({
          sync_status: "needs_manual_review",
          ai_diagnosis: "IA não retornou diagnóstico estruturado",
          attempts: (attempts || 0) + 1,
        })
        .eq("id", sync_log_id);
      return jsonResponse({ error: "AI returned no structured response" }, 500);
    }

    let diagnosis: {
      diagnosis: string;
      root_cause: string;
      corrected_payload: Record<string, unknown>;
      confidence: string;
      changes_made: string[];
    };
    try {
      diagnosis = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("[sync-monitor] Failed to parse AI response");
      await db
        .from("integration_sync_log")
        .update({
          sync_status: "needs_manual_review",
          ai_diagnosis: "Falha ao interpretar resposta da IA",
          attempts: (attempts || 0) + 1,
        })
        .eq("id", sync_log_id);
      return jsonResponse({ error: "Failed to parse AI diagnosis" }, 500);
    }

    console.log(`[sync-monitor] Diagnosis: ${diagnosis.diagnosis}`);
    console.log(`[sync-monitor] Confidence: ${diagnosis.confidence}`);

    // --- Save AI diagnosis ---
    await db
      .from("integration_sync_log")
      .update({
        ai_diagnosis: diagnosis.diagnosis,
        corrected_payload: diagnosis.corrected_payload,
        attempts: (attempts || 0) + 1,
      })
      .eq("id", sync_log_id);

    // --- If low confidence, don't retry automatically ---
    if (diagnosis.confidence === "low") {
      await db
        .from("integration_sync_log")
        .update({ sync_status: "needs_manual_review" })
        .eq("id", sync_log_id);

      await notifyAdmins(db, entity_type, source_id, diagnosis.diagnosis, "needs_manual_review");
      return jsonResponse({
        status: "needs_manual_review",
        diagnosis: diagnosis.diagnosis,
        confidence: "low",
      });
    }

    // --- Retry with corrected payload ---
    const retryEndpoint =
      entity_type === "supplier"
        ? "/functions/v1/sync-supplier-inbound"
        : "/functions/v1/sync-project-inbound";

    let retryBody: Record<string, unknown>;
    if (entity_type === "supplier") {
      retryBody = {
        fornecedor: diagnosis.corrected_payload,
        source_id: source_id,
      };
    } else {
      retryBody = {
        project: diagnosis.corrected_payload,
        source_id: source_id,
      };
    }

    const retryResponse = await fetch(`${SUPABASE_URL}${retryEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-integration-key": INTEGRATION_API_KEY || "",
      },
      body: JSON.stringify(retryBody),
    });

    const retryResult = await retryResponse.text();

    if (retryResponse.ok) {
      console.log(`[sync-monitor] Retry SUCCESS for ${entity_type} ${source_id}`);

      await db
        .from("integration_sync_log")
        .update({
          ai_diagnosis: `✅ Corrigido automaticamente: ${diagnosis.diagnosis}\n\nAlterações: ${diagnosis.changes_made.join("; ")}`,
          corrected_payload: diagnosis.corrected_payload,
        })
        .eq("source_system", source_system)
        .eq("entity_type", entity_type)
        .eq("source_id", source_id);

      await notifyAdmins(
        db,
        entity_type,
        source_id,
        `Sincronização corrigida automaticamente: ${diagnosis.changes_made.join("; ")}`,
        "auto_corrected"
      );

      return jsonResponse({
        status: "auto_corrected",
        diagnosis: diagnosis.diagnosis,
        changes: diagnosis.changes_made,
      });
    } else {
      console.error(`[sync-monitor] Retry FAILED for ${entity_type} ${source_id}`);

      const newAttempts = (attempts || 0) + 1;
      const finalStatus = newAttempts >= 3 ? "needs_manual_review" : "failed";

      await db
        .from("integration_sync_log")
        .update({
          sync_status: finalStatus,
          error_message: `Retry falhou (tentativa ${newAttempts}/3)`,
          ai_diagnosis: `${diagnosis.diagnosis}\n\n❌ Reenvio falhou (tentativa ${newAttempts}/3)`,
        })
        .eq("id", sync_log_id);

      if (finalStatus === "needs_manual_review") {
        await notifyAdmins(
          db,
          entity_type,
          source_id,
          `Falha após ${newAttempts} tentativas automáticas. Intervenção manual necessária.`,
          "needs_manual_review"
        );
      }

      return jsonResponse({
        status: finalStatus,
        diagnosis: diagnosis.diagnosis,
        retry_error: retryResult,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[sync-monitor] Error:", message);
    return jsonResponse({ error: message }, 500);
  }
});

/**
 * Send notification to admin users about sync issues.
 * Uses 'general' notification type (valid enum value).
 */
async function notifyAdmins(
  db: ReturnType<typeof createClient>,
  entityType: string,
  sourceId: string,
  message: string,
  status: string
) {
  try {
    const { data: admins } = await db
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!admins?.length) return;

    const icon = status === "auto_corrected" ? "✅" : "⚠️";
    const title =
      status === "auto_corrected"
        ? `${icon} Sync corrigido: ${entityType}`
        : `${icon} Sync requer atenção: ${entityType}`;

    for (const admin of admins) {
      await db.from("notifications").insert({
        user_id: admin.user_id,
        title,
        body: message,
        type: "general",
        action_url: "/admin?tab=sistema",
      });
    }
  } catch (err) {
    console.error("[sync-monitor] Failed to notify admins:", err);
  }
}
