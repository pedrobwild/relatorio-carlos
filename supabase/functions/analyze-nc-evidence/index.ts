import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { images, text_context } = await req.json();

    // Build content array for Claude multimodal analysis
    const userContent: Array<Record<string, unknown>> = [];

    // Add text context if provided
    if (text_context && text_context.trim()) {
      userContent.push({ type: "text", text: `Contexto adicional fornecido pelo usuário:\n${text_context}` });
    }

    // Add images as base64 (Claude format)
    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (img.base64 && img.mime_type) {
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mime_type,
              data: img.base64,
            },
          });
        }
      }
    }

    if (userContent.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma evidência fornecida (imagens ou texto)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add the instruction text at the beginning
    userContent.unshift({
      type: "text",
      text: "Analise as evidências acima (prints de conversas, fotos de obra, textos) e extraia informações para registrar uma Não Conformidade (NC) em um sistema de gestão de obras civis.",
    });

    const systemPrompt = `Você é um especialista em gestão de qualidade de obras civis. 
Analise as evidências fornecidas (prints de conversas do WhatsApp, fotos de problemas na obra, textos descritivos) e sugira os campos para registrar uma Não Conformidade (NC).

Você DEVE retornar os campos usando a ferramenta fornecida:
- title: Título claro e conciso da NC (max 100 caracteres)
- description: Descrição detalhada do problema identificado
- severity: Uma das opções: "low", "medium", "high", "critical" — baseie-se no impacto real
- category: Uma das categorias: "Hidráulica", "Elétrica", "Revestimento", "Estrutural", "Impermeabilização", "Carpintaria", "Pintura", "Segurança do Trabalho", "Planejamento", "Outros"
- corrective_action: Plano de ação corretiva sugerido, com passos claros e objetivos
- root_cause: Causa raiz provável do problema

Seja preciso e técnico. Use linguagem de engenharia civil. Se não conseguir determinar algum campo com confiança, use um valor razoável baseado no contexto.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: userContent },
        ],
        tools: [
          {
            name: "suggest_nc_fields",
            description: "Return suggested non-conformity fields based on the evidence analysis.",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título da NC" },
                description: { type: "string", description: "Descrição detalhada" },
                severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                category: {
                  type: "string",
                  enum: [
                    "Hidráulica", "Elétrica", "Revestimento", "Estrutural",
                    "Impermeabilização", "Carpintaria", "Pintura",
                    "Segurança do Trabalho", "Planejamento", "Outros",
                  ],
                },
                corrective_action: { type: "string", description: "Plano de ação corretiva sugerido" },
                root_cause: { type: "string", description: "Causa raiz provável" },
              },
              required: ["title", "description", "severity", "category", "corrective_action"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "suggest_nc_fields" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao analisar evidências com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract tool use result from Claude response
    const toolUseBlock = data.content?.find((block: any) => block.type === "tool_use" && block.name === "suggest_nc_fields");
    if (!toolUseBlock?.input) {
      console.error("No tool_use block in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "IA não retornou sugestões estruturadas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestion = toolUseBlock.input;

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-nc-evidence error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
