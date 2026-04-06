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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { images, text_context } = await req.json();

    // Build content array for multimodal analysis
    const userContent: Array<Record<string, unknown>> = [];

    // Add text context if provided
    if (text_context && text_context.trim()) {
      userContent.push({ type: "text", text: `Contexto adicional fornecido pelo usuário:\n${text_context}` });
    }

    // Add images as base64
    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (img.base64 && img.mime_type) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: `data:${img.mime_type};base64,${img.base64}`,
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

Você DEVE retornar um JSON usando a função fornecida com os seguintes campos preenchidos:
- title: Título claro e conciso da NC (max 100 caracteres)
- description: Descrição detalhada do problema identificado
- severity: Uma das opções: "low", "medium", "high", "critical" — baseie-se no impacto real
- category: Uma das categorias: "Hidráulica", "Elétrica", "Revestimento", "Estrutural", "Impermeabilização", "Carpintaria", "Pintura", "Segurança do Trabalho", "Planejamento", "Outros"
- corrective_action: Plano de ação corretiva sugerido, com passos claros e objetivos
- root_cause: Causa raiz provável do problema

Seja preciso e técnico. Use linguagem de engenharia civil. Se não conseguir determinar algum campo com confiança, use um valor razoável baseado no contexto.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_nc_fields",
              description: "Return suggested non-conformity fields based on the evidence analysis.",
              parameters: {
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
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_nc_fields" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao analisar evidências com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "IA não retornou sugestões estruturadas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let suggestion: Record<string, unknown>;
    try {
      suggestion = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse tool call args:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: "Resposta da IA em formato inválido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
