import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * One-off: enrich an existing project with AI from its contract PDF.
 * POST { project_id, contract_file_url }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // Accept either integration key or service role key
    const integrationKey = req.headers.get("x-integration-key");
    const authHeader = req.headers.get("authorization");
    const expectedKey = Deno.env.get("INTEGRATION_API_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    const isIntegrationAuth = expectedKey && integrationKey === expectedKey;
    const isServiceAuth = serviceKey && authHeader === `Bearer ${serviceKey}`;
    
    if (!isIntegrationAuth && !isServiceAuth) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { project_id, contract_file_url } = await req.json();

    if (!project_id || !contract_file_url) {
      return jsonResponse({ error: "project_id and contract_file_url required" }, 400);
    }

    // Get current project data
    const { data: project, error: projErr } = await db
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return jsonResponse({ error: "Project not found" }, 404);
    }

    // Download PDF
    console.log("Downloading PDF...");
    const pdfResp = await fetch(contract_file_url);
    if (!pdfResp.ok) {
      return jsonResponse({ error: `PDF download failed: ${pdfResp.status}` }, 500);
    }

    const pdfBuffer = await pdfResp.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);
    console.log(`PDF downloaded: ${pdfBytes.length} bytes`);

    const SYSTEM_PROMPT = `Você é um extrator de dados de projetos de reforma/construção civil da BWild Arquitetura e Reformas.

Você receberá:
1. Dados já coletados do sistema de orçamentos (payload JSON)
2. O contrato PDF do cliente

Seu objetivo: Extrair e COMPLETAR todos os campos faltantes do cadastro do projeto, cruzando informações do contrato com os dados já existentes.

REGRAS:
- Retorne APENAS JSON válido, sem markdown ou texto adicional.
- Use null para qualquer campo que não tenha informação confiável — NUNCA invente dados.
- Datas no formato YYYY-MM-DD.
- Valores monetários numéricos (sem R$ ou pontos de milhar).
- NÃO confunda endereço residencial do contratante com endereço do imóvel da obra.

CAMPOS A EXTRAIR:

project_fields:
- client_name, client_email, client_phone
- address (endereço do imóvel da obra)
- condominium (nome do condomínio/empreendimento)
- neighborhood, bairro, city, cep
- unit_name (identificação da unidade)
- property_type, total_area
- contract_value (numérico), contract_signing_date (YYYY-MM-DD)
- consultora_comercial, notes

customer_details:
- cpf, rg, nacionalidade, estado_civil, profissao, endereco_residencial

payment_schedule:
- array de { description: string, value: number, due_date: string | null }

Retorne JSON com 3 chaves: project_fields, customer_details, payment_schedule.`;

    const existingContext = JSON.stringify({
      name: project.name,
      client_name: project.client_name,
      client_email: project.client_email,
      client_phone: project.client_phone,
      address: project.address,
      condominium: project.condominium,
      neighborhood: project.neighborhood,
      city: project.city,
      unit_name: project.unit_name,
      property_type: project.property_type,
      total_area: project.total_area,
      budget_value: project.budget_value,
      contract_value: project.contract_value,
    }, null, 2);

    console.log("Calling AI...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Dados existentes:\n${existingContext}\n\nAnalise o contrato PDF e complete os dados faltantes. APENAS JSON.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
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
      console.error("AI error:", aiResponse.status, errText.substring(0, 300));
      return jsonResponse({ error: `AI error: ${aiResponse.status}` }, 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ error: "Empty AI response" }, 500);
    }

    let parsed: any;
    try {
      const clean = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Parse error:", content.substring(0, 500));
      return jsonResponse({ error: "Invalid AI JSON", raw: content.substring(0, 1000) }, 500);
    }

    const pf = parsed.project_fields ?? {};
    const updatePayload: Record<string, unknown> = {};

    const fields = ["client_name", "client_email", "client_phone", "address", "condominium",
      "neighborhood", "bairro", "city", "cep", "unit_name", "property_type", "total_area",
      "estimated_duration_weeks", "contract_value", "contract_signing_date", "consultora_comercial", "notes"];

    for (const f of fields) {
      const aiVal = pf[f];
      const dbVal = project[f];
      if (aiVal != null && aiVal !== "" && (dbVal == null || dbVal === "")) {
        updatePayload[f] = aiVal;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: upErr } = await db.from("projects").update(updatePayload).eq("id", project_id);
      if (upErr) console.error("Update error:", upErr.message);
    }

    // Append customer details to notes
    const enrichNotes: string[] = [];
    if (parsed.customer_details) {
      const cd = parsed.customer_details;
      const parts: string[] = [];
      if (cd.cpf) parts.push(`CPF: ${cd.cpf}`);
      if (cd.rg) parts.push(`RG: ${cd.rg}`);
      if (cd.nacionalidade) parts.push(`Nacionalidade: ${cd.nacionalidade}`);
      if (cd.estado_civil) parts.push(`Estado Civil: ${cd.estado_civil}`);
      if (cd.profissao) parts.push(`Profissão: ${cd.profissao}`);
      if (cd.endereco_residencial) parts.push(`Endereço Residencial: ${cd.endereco_residencial}`);
      if (parts.length > 0) enrichNotes.push("DADOS DO CONTRATANTE:\n" + parts.join("\n"));
    }
    if (parsed.payment_schedule?.length > 0) {
      const lines = parsed.payment_schedule.map((p: any, i: number) =>
        `${i + 1}. ${p.description}: R$ ${p.value}${p.due_date ? ` (venc: ${p.due_date})` : ""}`
      );
      enrichNotes.push("CRONOGRAMA DE PAGAMENTO:\n" + lines.join("\n"));
    }
    if (enrichNotes.length > 0) {
      const currentNotes = updatePayload.notes || project.notes || "";
      const fullNotes = currentNotes + "\n\n---\n[Dados extraídos do contrato via IA]\n" + enrichNotes.join("\n\n");
      await db.from("projects").update({ notes: fullNotes }).eq("id", project_id);
    }

    return jsonResponse({
      success: true,
      fields_updated: Object.keys(updatePayload),
      ai_data: parsed,
    });
  } catch (e) {
    console.error("Error:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
