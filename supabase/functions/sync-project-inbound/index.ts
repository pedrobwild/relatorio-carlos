import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-project-inbound (Portal BWild)
 *
 * Receives project + budget data FROM Envision when a budget reaches contrato_fechado.
 * Validates fields, upserts into the local projects table, creates budget records,
 * and enriches project data via AI from the contract PDF.
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
    const { project, source_id, budget, client } = body;

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
    const { data: adminUser } = await db
      .from("users_profile")
      .select("id")
      .eq("perfil", "admin")
      .eq("status", "ativo")
      .limit(1)
      .single();

    if (!adminUser) {
      console.error("[sync-project-inbound] No active admin user found for created_by");
      return jsonResponse({ error: "No active admin user found to assign as project creator" }, 500);
    }

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
      is_project_phase: true,
      notes: project.notes ?? null,
      consultora_comercial: project.consultora_comercial ?? null,
      contract_value: typeof project.budget_value === "number" ? project.budget_value : null,
    };

    // --- Upsert: check if already linked ---
    const { data: existing } = await db
      .from("projects")
      .select("id, deleted_at")
      .eq("external_id", source_id)
      .eq("external_system", "envision")
      .maybeSingle();

    let projectId: string;
    let isNewProject = false;
    let wasRestored = false;

    if (existing) {
      // If the project was soft-deleted, restore it on re-sync — otherwise the
      // update would land on a hidden row and the obra would silently "not be created".
      if (existing.deleted_at) {
        projectPayload.deleted_at = null;
        wasRestored = true;
        console.log(`[sync-project-inbound] Restoring soft-deleted project ${existing.id} for source_id ${source_id}`);
      }
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
          created_by: adminUser.id,
        })
        .select("id")
        .single();
      if (insertErr) {
        console.error("[sync-project-inbound] Insert error:", JSON.stringify(insertErr));
        throw insertErr;
      }
      projectId = inserted.id;
      isNewProject = true;

      // --- Auto-assign team members for new synced projects ---
      await assignDefaultTeamMembers(db, projectId);

      // --- Initialize project journey (Boas-vindas, Briefing, etc.) ---
      try {
        await db.rpc("initialize_project_journey", { p_project_id: projectId });
        console.log(`[sync-project-inbound] Journey initialized for project ${projectId}`);
      } catch (journeyErr) {
        console.error("[sync-project-inbound] Journey init error:", journeyErr instanceof Error ? journeyErr.message : journeyErr);
      }

      // --- Auto-create customer user account (resilient: always upserts project_customers) ---
      const clientEmail = (client?.email ?? project.client_email)?.trim()?.toLowerCase();
      const clientName = (client?.name ?? project.client_name)?.trim();
      const clientPhone = client?.phone ?? project.client_phone ?? null;
      if (clientEmail && clientName) {
        try {
          const customerUserId = await createCustomerUser(db, projectId, clientEmail, clientName, clientPhone, adminUser.id);
          console.log(`[sync-project-inbound] Customer linked to project: ${customerUserId ?? "no auth user (record-only)"}`);
        } catch (custErr) {
          console.error("[sync-project-inbound] Customer creation error:", custErr instanceof Error ? custErr.message : custErr);
        }
      }

      // --- Seed project_customers with rich client data from CRM (RG, profession, etc.) ---
      if (client && typeof client === "object") {
        try {
          await seedClientDetails(db, projectId, clientEmail ?? "", client);
        } catch (clientErr) {
          console.error("[sync-project-inbound] Client details seed error:", clientErr instanceof Error ? clientErr.message : clientErr);
        }
      }

      // --- Seed project_studio_info from initial payload (will be enriched later by AI) ---
      // Prefer property_* fields from `client` block (richer CRM data) over project payload
      try {
        await db.from("project_studio_info").upsert({
          project_id: projectId,
          nome_do_empreendimento: client?.property_empreendimento ?? project.condominium ?? null,
          endereco_completo: client?.property_address ?? project.address ?? null,
          complemento: client?.property_address_complement ?? null,
          bairro: client?.property_bairro ?? project.neighborhood ?? null,
          cidade: client?.property_city ?? project.city ?? null,
          cep: client?.property_zip_code ?? project.cep ?? null,
          tamanho_imovel_m2: parseMetragemNumber(client?.property_metragem) ?? project.total_area ?? null,
          tipo_de_locacao: project.property_type ?? null,
        }, { onConflict: "project_id" });
      } catch (studioErr) {
        console.error("[sync-project-inbound] Studio info seed error:", studioErr instanceof Error ? studioErr.message : studioErr);
      }

      // --- Download and store property floor plan if provided ---
      if (client?.property_floor_plan_url) {
        try {
          await downloadAndStoreFloorPlan(db, projectId, client.property_floor_plan_url, project.name?.trim() ?? "Projeto");
          console.log(`[sync-project-inbound] Floor plan stored for project ${projectId}`);
        } catch (planErr) {
          console.error("[sync-project-inbound] Floor plan storage error:", planErr instanceof Error ? planErr.message : planErr);
        }
      }
    }

    // --- Process budget if provided ---
    let orcamentoId: string | null = null;
    if (budget && typeof budget === "object") {
      orcamentoId = await processBudget(db, source_id, projectId, project, budget);
    }

    // --- Store contract PDF as project document ---
    const contractFileUrl = project.contract_file_url;
    let contractPdfBytes: Uint8Array | null = null;

    if (contractFileUrl) {
      try {
        contractPdfBytes = await downloadAndStoreContract(db, projectId, contractFileUrl, project.name?.trim() ?? "Contrato");
        console.log(`[sync-project-inbound] Contract PDF stored for project ${projectId}`);
      } catch (docErr) {
        console.error("[sync-project-inbound] Contract storage error:", docErr instanceof Error ? docErr.message : docErr);
      }
    }

    // --- AI Enrichment: reuse already-downloaded PDF bytes to avoid double download ---
    let aiEnrichment: Record<string, unknown> | null = null;
    if (contractFileUrl && isNewProject) {
      try {
        aiEnrichment = await enrichProjectWithAI(db, projectId, project, contractFileUrl, contractPdfBytes);
        console.log(`[sync-project-inbound] AI enrichment completed for project ${projectId}`);
      } catch (aiErr) {
        // Non-critical: don't fail the sync if AI enrichment fails
        console.error("[sync-project-inbound] AI enrichment error:", aiErr instanceof Error ? aiErr.message : aiErr);
      }
    }

    // --- Log sync ---
    await db.from("integration_sync_log").upsert({
      source_system: "envision",
      target_system: "portal_bwild",
      entity_type: "project",
      source_id: source_id,
      target_id: projectId,
      sync_status: "success",
      payload: {
        project,
        budget: budget ? { total_value: budget.total_value, sections_count: budget.sections?.length } : null,
        ai_enrichment: aiEnrichment ? "completed" : contractFileUrl ? "failed_or_skipped" : "no_contract",
      },
      attempts: 1,
      synced_at: new Date().toISOString(),
    }, {
      onConflict: "source_system,entity_type,source_id",
    });

    return jsonResponse({
      status: "success",
      project_id: projectId,
      orcamento_id: orcamentoId,
      action: existing ? (wasRestored ? "restored" : "updated") : "created",
      ai_enrichment: aiEnrichment ? "completed" : null,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    const errStack = error instanceof Error ? error.stack : "";
    console.error("[sync-project-inbound] error:", errMsg, errStack);
    return jsonResponse({ error: errMsg }, 500);
  }
});

// ─── Contract PDF Storage ───────────────────────────────────────────────────

/**
 * Download the contract PDF from the Envision URL and store it in
 * the project-documents bucket + project_documents table.
 */
async function downloadAndStoreContract(
  db: ReturnType<typeof createClient>,
  projectId: string,
  contractFileUrl: string,
  projectName: string,
): Promise<Uint8Array> {
  console.log(`[contract-store] Downloading from: ${contractFileUrl.substring(0, 80)}...`);
  const pdfResponse = await fetch(contractFileUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download contract PDF: ${pdfResponse.status}`);
  }

  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfBytes = new Uint8Array(pdfBuffer);

  if (pdfBytes.length > 50 * 1024 * 1024) {
    throw new Error("Contract PDF too large (>50MB)");
  }

  // Check if a contract document already exists for this project
  const { data: existingDoc } = await db
    .from("project_documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("document_type", "contrato")
    .maybeSingle();

  if (existingDoc) {
    console.log(`[contract-store] Contract document already exists for project ${projectId}, skipping`);
    return pdfBytes;
  }

  // Build a clean file name
  const sanitizedName = `Contrato_${projectName.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
  const storagePath = `${projectId}/contratos/${Date.now()}_${sanitizedName}`;
  const bucket = "project-documents";

  // Upload to storage
  const { error: uploadErr } = await db.storage
    .from(bucket)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  // Find an admin user for uploaded_by
  const { data: adminUser } = await db
    .from("users_profile")
    .select("id")
    .eq("perfil", "admin")
    .eq("status", "ativo")
    .limit(1)
    .single();

  // Create project_documents record
  const { error: docErr } = await db
    .from("project_documents")
    .insert({
      project_id: projectId,
      document_type: "contrato",
      name: sanitizedName,
      description: "Contrato do cliente recebido automaticamente via integração Envision",
      storage_path: storagePath,
      storage_bucket: bucket,
      mime_type: "application/pdf",
      size_bytes: pdfBytes.length,
      status: "approved",
      uploaded_by: adminUser?.id ?? "00000000-0000-0000-0000-000000000000",
    });

  if (docErr) {
    // Cleanup uploaded file on failure
    await db.storage.from(bucket).remove([storagePath]);
    throw new Error(`Document record failed: ${docErr.message}`);
  }

  console.log(`[contract-store] Stored contract: ${storagePath} (${pdfBytes.length} bytes)`);
  return pdfBytes;
}

// ─── AI Enrichment ──────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `Você é um extrator de dados de projetos de reforma/construção civil da BWild Arquitetura e Reformas.

Você receberá:
1. Dados já coletados do sistema de orçamentos (payload JSON)
2. O contrato PDF do cliente (quando disponível)

Seu objetivo: Extrair e COMPLETAR todos os campos faltantes do cadastro do projeto, cruzando informações do contrato com os dados já existentes.

REGRAS:
- Retorne APENAS JSON válido, sem markdown ou texto adicional.
- Use null para qualquer campo que não tenha informação confiável — NUNCA invente dados.
- Datas no formato YYYY-MM-DD.
- Valores monetários numéricos (sem R$ ou pontos de milhar).
- CPF/RG: manter formato original.
- Metragem: apenas número.
- NÃO sobrescreva campos já preenchidos no payload com valores vazios.
- NÃO confunda endereço residencial do contratante com endereço do imóvel da obra.

CAMPOS DO PROJETO A EXTRAIR/COMPLETAR:

project_fields (campos do projeto):
- name: nome do projeto (ex: "Erik Zip Brooklin 20m")
- client_name: nome completo do contratante
- client_email: e-mail do contratante
- client_phone: telefone/celular do contratante  
- address: endereço completo do imóvel da obra
- condominium: nome do condomínio/empreendimento
- neighborhood: bairro do imóvel
- bairro: bairro (redundante, preencher igual neighborhood)
- city: cidade do imóvel
- cep: CEP do imóvel
- unit_name: identificação da unidade (ex: "Apto 502", "1014")
- property_type: Apartamento, Casa, Studio, Cobertura, Sala Comercial, Residencial
- total_area: metragem m² (apenas número)
- estimated_duration_weeks: duração estimada em semanas
- contract_value: valor do contrato (numérico)
- contract_signing_date: data de assinatura YYYY-MM-DD
- consultora_comercial: nome da consultora comercial
- notes: observações relevantes do contrato

customer_details (dados extras do contratante para referência):
- cpf: CPF do contratante
- rg: RG do contratante
- nacionalidade: nacionalidade
- estado_civil: estado civil
- profissao: profissão
- endereco_residencial: endereço residencial (pode diferir do imóvel)

payment_schedule (parcelas de pagamento):
- array de { description: string, value: number, due_date: string | null }

Retorne o JSON com estas 3 chaves: project_fields, customer_details, payment_schedule.`;

/**
 * Download the contract PDF, send to AI for extraction, and update the project.
 */
async function enrichProjectWithAI(
  db: ReturnType<typeof createClient>,
  projectId: string,
  existingData: Record<string, unknown>,
  contractFileUrl: string,
  cachedPdfBytes?: Uint8Array | null,
): Promise<Record<string, unknown>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[AI-enrich] LOVABLE_API_KEY not configured, skipping");
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // 1. Use cached PDF bytes or download if not available
  let pdfBytes: Uint8Array;
  if (cachedPdfBytes && cachedPdfBytes.length > 0) {
    console.log(`[AI-enrich] Using cached PDF bytes (${cachedPdfBytes.length} bytes)`);
    pdfBytes = cachedPdfBytes;
  } else {
    console.log(`[AI-enrich] Downloading contract from: ${contractFileUrl.substring(0, 80)}...`);
    const pdfResponse = await fetch(contractFileUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download contract PDF: ${pdfResponse.status}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    pdfBytes = new Uint8Array(pdfBuffer);
  }

  // Validate size (max 20MB for AI processing)
  if (pdfBytes.length > 20 * 1024 * 1024) {
    throw new Error("Contract PDF too large for AI processing (>20MB)");
  }

  // Convert to base64
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i++) {
    binary += String.fromCharCode(pdfBytes[i]);
  }
  const pdfBase64 = btoa(binary);

  // 2. Build the prompt with existing data context
  const existingContext = JSON.stringify({
    name: existingData.name,
    client_name: existingData.client_name,
    client_email: existingData.client_email,
    client_phone: existingData.client_phone,
    address: existingData.address,
    condominium: existingData.condominium,
    neighborhood: existingData.neighborhood,
    city: existingData.city,
    unit: existingData.unit,
    unit_name: existingData.unit_name,
    property_type: existingData.property_type,
    total_area: existingData.total_area,
    budget_value: existingData.budget_value,
    budget_code: existingData.budget_code,
    estimated_duration_weeks: existingData.estimated_duration_weeks,
    consultora_comercial: existingData.consultora_comercial,
    notes: existingData.notes,
  }, null, 2);

  // 3. Call Lovable AI (Gemini) with PDF + context
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Dados já coletados do sistema de orçamentos:\n\n${existingContext}\n\nAnalise o contrato PDF anexado e complete/enriqueça os dados faltantes. Retorne APENAS o JSON.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.05,
      max_tokens: 4096,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("[AI-enrich] AI gateway error:", aiResponse.status, errText.substring(0, 300));
    throw new Error(`AI gateway error: ${aiResponse.status}`);
  }

  const aiResult = await aiResponse.json();
  const content = aiResult.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from AI");
  }

  // 4. Parse AI response
  let parsed: {
    project_fields?: Record<string, unknown>;
    customer_details?: Record<string, unknown>;
    payment_schedule?: Array<{ description: string; value: number; due_date: string | null }>;
  };

  try {
    const cleanContent = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch {
    console.error("[AI-enrich] Failed to parse AI response:", content.substring(0, 500));
    throw new Error("Invalid AI response format");
  }

  const projectFields = parsed.project_fields ?? {};

  // 5. Build update payload — only fill in empty/null fields from the existing project
  const updatePayload: Record<string, unknown> = {};

  const fieldMap: Record<string, string> = {
    client_name: "client_name",
    client_email: "client_email",
    client_phone: "client_phone",
    address: "address",
    condominium: "condominium",
    neighborhood: "neighborhood",
    bairro: "bairro",
    city: "city",
    cep: "cep",
    unit_name: "unit_name",
    property_type: "property_type",
    total_area: "total_area",
    estimated_duration_weeks: "estimated_duration_weeks",
    contract_value: "contract_value",
    contract_signing_date: "contract_signing_date",
    consultora_comercial: "consultora_comercial",
    notes: "notes",
  };

  for (const [aiField, dbField] of Object.entries(fieldMap)) {
    const aiValue = projectFields[aiField];
    const existingValue = existingData[aiField];
    // Only fill if AI has a value and existing is empty/null
    if (aiValue != null && aiValue !== "" && (existingValue == null || existingValue === "" || existingValue === "null")) {
      updatePayload[dbField] = aiValue;
    }
  }

  // 6. Update project if we have new data
  if (Object.keys(updatePayload).length > 0) {
    console.log(`[AI-enrich] Updating project ${projectId} with ${Object.keys(updatePayload).length} fields:`, Object.keys(updatePayload));
    const { error: updateErr } = await db
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId);

    if (updateErr) {
      console.error("[AI-enrich] Update error:", updateErr.message);
    }
  } else {
    console.log("[AI-enrich] No new fields to update");
  }

  // 7. Persist customer details into project_customers (CPF, RG, profissão, endereço, etc)
  if (parsed.customer_details && Object.keys(parsed.customer_details).length > 0) {
    const cd = parsed.customer_details as Record<string, unknown>;
    const customerUpdate: Record<string, unknown> = {};
    if (cd.cpf) customerUpdate.cpf = String(cd.cpf);
    if (cd.rg) customerUpdate.rg = String(cd.rg);
    if (cd.nacionalidade) customerUpdate.nacionalidade = String(cd.nacionalidade);
    if (cd.estado_civil) customerUpdate.estado_civil = String(cd.estado_civil);
    if (cd.profissao) customerUpdate.profissao = String(cd.profissao);
    if (cd.endereco_residencial) customerUpdate.endereco_residencial = String(cd.endereco_residencial);

    if (Object.keys(customerUpdate).length > 0) {
      const { error: custErr } = await db
        .from("project_customers")
        .update(customerUpdate)
        .eq("project_id", projectId);
      if (custErr) {
        console.error("[AI-enrich] project_customers update error:", custErr.message);
      } else {
        console.log(`[AI-enrich] Updated project_customers with ${Object.keys(customerUpdate).join(", ")}`);
      }
    }
  }

  // 8. Persist property details into project_studio_info
  const studioUpdate: Record<string, unknown> = { project_id: projectId };
  const pf = projectFields as Record<string, unknown>;
  if (pf.condominium) studioUpdate.nome_do_empreendimento = pf.condominium;
  if (pf.address) studioUpdate.endereco_completo = pf.address;
  if (pf.bairro || pf.neighborhood) studioUpdate.bairro = pf.bairro ?? pf.neighborhood;
  if (pf.city) studioUpdate.cidade = pf.city;
  if (pf.cep) studioUpdate.cep = pf.cep;
  if (pf.total_area != null) studioUpdate.tamanho_imovel_m2 = pf.total_area;
  if (pf.property_type) studioUpdate.tipo_de_locacao = pf.property_type;

  if (Object.keys(studioUpdate).length > 1) {
    const { error: studioErr } = await db
      .from("project_studio_info")
      .upsert(studioUpdate, { onConflict: "project_id" });
    if (studioErr) {
      console.error("[AI-enrich] project_studio_info upsert error:", studioErr.message);
    } else {
      console.log(`[AI-enrich] Upserted project_studio_info with ${Object.keys(studioUpdate).filter(k => k !== "project_id").join(", ")}`);
    }
  }

  // 9. Append a compact audit trail to project notes (payment schedule + IA marker)
  const enrichmentNotes: string[] = [];
  if (parsed.payment_schedule && parsed.payment_schedule.length > 0) {
    const scheduleLines = parsed.payment_schedule.map((p, i) =>
      `${i + 1}. ${p.description}: R$ ${typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}${p.due_date ? ` (venc: ${p.due_date})` : ""}`
    );
    enrichmentNotes.push("CRONOGRAMA DE PAGAMENTO:\n" + scheduleLines.join("\n"));
  }

  if (enrichmentNotes.length > 0) {
    const { data: currentProject } = await db
      .from("projects")
      .select("notes")
      .eq("id", projectId)
      .single();

    const existingNotes = currentProject?.notes || "";
    const separator = existingNotes ? "\n\n---\n[Dados extraídos automaticamente do contrato via IA]\n" : "[Dados extraídos automaticamente do contrato via IA]\n";
    const newNotes = existingNotes + separator + enrichmentNotes.join("\n\n");

    await db.from("projects").update({ notes: newNotes }).eq("id", projectId);
  }

  return {
    fields_updated: Object.keys(updatePayload),
    customer_details_extracted: !!parsed.customer_details,
    payment_schedule_items: parsed.payment_schedule?.length ?? 0,
  };
}

// ─── Budget Processing ──────────────────────────────────────────────────────

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
          item_category: item.item_category ?? null,
          supplier_id: item.supplier_id ?? null,
          supplier_name: item.supplier_name ?? null,
          catalog_item_id: item.catalog_item_id ?? null,
        }));

        const { error: itemsError } = await db.from("orcamento_items").insert(itemRows);
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

    const { error: adjError } = await db.from("orcamento_adjustments").insert(adjustmentRows);
    if (adjError) {
      console.error("[sync-project-inbound] Adjustments insert error:", adjError.message);
    }
  }

  // Log budget sync
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

// ─── Team Assignment ────────────────────────────────────────────────────────

/**
 * Auto-assign default team members when a project is created via sync.
 * NOTE: The DB trigger `trg_auto_assign_default_members` already handles
 * admins + lucas.serra + guilherme on INSERT. This function adds any
 * sync-specific members that the trigger doesn't cover.
 * Kept as a no-op safety net; the trigger does the real work.
 */
async function assignDefaultTeamMembers(
  _db: ReturnType<typeof createClient>,
  _projectId: string,
) {
  // The DB trigger auto_assign_default_project_members handles this now.
  console.log(`[sync-project-inbound] Team assignment handled by DB trigger for project ${_projectId}`);
}

// ─── Customer User Auto-Creation ────────────────────────────────────────────

const DEFAULT_CUSTOMER_PASSWORD = "512451";

/**
 * Auto-create a customer user account when a project is synced from Envision.
 *
 * RESILIENT: Always upserts the project_customers record (so the data appears
 * in the "Dados do Cliente" tab) even if the auth user creation fails. The
 * customer_user_id will be linked later, when the cliente is invited / signs up.
 *
 * Returns the customer user ID, or null if no auth user could be linked yet
 * (in which case the project_customers record exists but is unlinked).
 */
async function createCustomerUser(
  db: ReturnType<typeof createClient>,
  projectId: string,
  email: string,
  displayName: string,
  phone: string | null,
  _adminUserId: string,
): Promise<string | null> {
  let userId: string | null = null;

  // 1. Check if user already exists by email
  try {
    const { data: existingProfile } = await db
      .from("users_profile")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
      console.log(`[customer-create] User already exists for ${email.substring(0, 3)}***: ${userId}`);
    }
  } catch (lookupErr) {
    console.error("[customer-create] Profile lookup failed:", lookupErr instanceof Error ? lookupErr.message : lookupErr);
  }

  // 2. If no existing user, try to create one (non-fatal on failure)
  if (!userId) {
    try {
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email,
        password: DEFAULT_CUSTOMER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: displayName || email.split("@")[0],
          role: "customer",
        },
      });

      if (createErr) {
        console.error("[customer-create] Auth createUser error:", createErr.message);
        if (createErr.message?.includes("already been registered")) {
          const { data: fallback } = await db
            .from("users_profile")
            .select("id")
            .eq("email", email)
            .limit(1)
            .maybeSingle();
          if (fallback) userId = fallback.id;
        }
      } else if (newUser?.user) {
        userId = newUser.user.id;
        console.log(`[customer-create] Created new user for ${email.substring(0, 3)}***: ${userId}`);
      }
    } catch (authErr) {
      console.error("[customer-create] Auth createUser threw:", authErr instanceof Error ? authErr.message : authErr);
    }
  }

  // 3. ALWAYS upsert project_customers (with or without userId)
  const customerRecord: Record<string, unknown> = {
    project_id: projectId,
    customer_name: displayName || email.split("@")[0],
    customer_email: email,
    customer_phone: phone,
  };
  if (userId) customerRecord.customer_user_id = userId;

  const { error: custErr } = await db
    .from("project_customers")
    .upsert(customerRecord, { onConflict: "project_id,customer_email" });
  if (custErr) {
    console.error("[customer-create] project_customers upsert error:", custErr.message);
  } else {
    console.log(`[customer-create] project_customers upserted (linked=${!!userId})`);
  }

  // 4. Add as project member (viewer) only if we have a userId
  if (userId) {
    const { error: memberErr } = await db
      .from("project_members")
      .upsert(
        { project_id: projectId, user_id: userId, role: "viewer" },
        { onConflict: "project_id,user_id" }
      );
    if (memberErr) {
      console.error("[customer-create] project_members upsert error:", memberErr.message);
    }
  }

  return userId;
}

// ─── Rich client data from Envision CRM ─────────────────────────────────────

/**
 * Seed project_customers with rich CRM fields from the Envision `client` block.
 * This runs BEFORE AI enrichment, so AI only fills in what is missing.
 */
async function seedClientDetails(
  db: ReturnType<typeof createClient>,
  projectId: string,
  customerEmail: string,
  client: Record<string, unknown>,
): Promise<void> {
  if (!customerEmail) return;

  const residencialParts = [
    client.address,
    client.address_complement,
    client.zip_code ? `CEP ${client.zip_code}` : null,
  ].filter(Boolean) as string[];
  const enderecoResidencial = residencialParts.length > 0 ? residencialParts.join(" — ") : null;

  const updatePayload: Record<string, unknown> = {};
  if (client.cpf) updatePayload.cpf = String(client.cpf);
  if (client.rg) updatePayload.rg = String(client.rg);
  if (client.nationality) updatePayload.nacionalidade = String(client.nationality);
  if (client.marital_status) updatePayload.estado_civil = String(client.marital_status);
  if (client.profession) updatePayload.profissao = String(client.profession);
  if (enderecoResidencial) updatePayload.endereco_residencial = enderecoResidencial;
  if (client.city) updatePayload.cidade = String(client.city);
  if (client.state) updatePayload.estado = String(client.state);

  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await db
    .from("project_customers")
    .update(updatePayload)
    .eq("project_id", projectId)
    .eq("customer_email", customerEmail);

  if (error) {
    console.error("[client-seed] Update error:", error.message);
  } else {
    console.log(`[client-seed] Seeded project_customers with ${Object.keys(updatePayload).join(", ")}`);
  }
}

/** Convert "120 m²", "85,5", "1.250,50 m2" etc to a numeric value, or null. */
function parseMetragemNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const str = String(value).trim();
  if (!str) return null;
  const match = str.replace(/\./g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return Number.isFinite(num) ? num : null;
}

/**
 * Download the property floor plan from the Envision URL and store it in
 * project_documents (category: plano_reforma) so it shows in the Documents tab.
 */
async function downloadAndStoreFloorPlan(
  db: ReturnType<typeof createClient>,
  projectId: string,
  floorPlanUrl: string,
  projectName: string,
): Promise<void> {
  console.log(`[floor-plan-store] Downloading from: ${floorPlanUrl.substring(0, 80)}...`);
  const response = await fetch(floorPlanUrl);
  if (!response.ok) {
    throw new Error(`Failed to download floor plan: ${response.status}`);
  }
  const buf = new Uint8Array(await response.arrayBuffer());
  if (buf.length > 50 * 1024 * 1024) {
    throw new Error("Floor plan too large (>50MB)");
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const urlExt = (floorPlanUrl.split("?")[0].split(".").pop() ?? "").toLowerCase();
  const ext = ["pdf", "png", "jpg", "jpeg", "dwg", "dxf"].includes(urlExt) ? urlExt : "pdf";
  const mimeType = contentType.startsWith("application/") || contentType.startsWith("image/")
    ? contentType
    : (ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg");

  const { data: existingDoc } = await db
    .from("project_documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("document_type", "plano_reforma")
    .ilike("name", "Planta_%")
    .maybeSingle();

  if (existingDoc) {
    console.log(`[floor-plan-store] Floor plan already exists, skipping`);
    return;
  }

  const sanitizedName = `Planta_${projectName.replace(/[^a-zA-Z0-9._-]/g, "_")}.${ext}`;
  const storagePath = `${projectId}/plantas/${Date.now()}_${sanitizedName}`;
  const bucket = "project-documents";

  const { error: uploadErr } = await db.storage
    .from(bucket)
    .upload(storagePath, buf, { contentType: mimeType, upsert: false });
  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  const { data: adminUser } = await db
    .from("users_profile")
    .select("id")
    .eq("perfil", "admin")
    .eq("status", "ativo")
    .limit(1)
    .single();

  const { error: docErr } = await db
    .from("project_documents")
    .insert({
      project_id: projectId,
      document_type: "plano_reforma",
      name: sanitizedName,
      description: "Planta do imóvel recebida automaticamente via integração Envision",
      storage_path: storagePath,
      storage_bucket: bucket,
      mime_type: mimeType,
      size_bytes: buf.length,
      status: "approved",
      uploaded_by: adminUser?.id ?? "00000000-0000-0000-0000-000000000000",
    });

  if (docErr) {
    await db.storage.from(bucket).remove([storagePath]);
    throw new Error(`Document record failed: ${docErr.message}`);
  }
  console.log(`[floor-plan-store] Stored floor plan: ${storagePath} (${buf.length} bytes)`);
}
