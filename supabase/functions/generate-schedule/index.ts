import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { budgetItems, projectName, startDate, durationWeeks } = await req.json();

    if (!budgetItems || !Array.isArray(budgetItems) || budgetItems.length === 0) {
      return new Response(JSON.stringify({ error: "budgetItems é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um engenheiro civil especialista em planejamento de obras residenciais e comerciais no Brasil.
Sua tarefa é analisar os itens de orçamento fornecidos e gerar:

1. **Cronograma Semanal**: Distribua as atividades por semana na melhor ordem técnica de execução, respeitando dependências reais de construção civil (ex: fundação antes de alvenaria, estrutura antes de cobertura, instalações antes de acabamentos).

2. **Lista de Compras**: Para cada atividade, liste os materiais que precisam ser comprados, com estimativa de lead time (prazo para entrega) e a semana em que devem ser pedidos para chegar a tempo.

Regras:
- Agrupe serviços correlatos na mesma semana quando possível
- Considere que atividades de instalações (elétrica, hidráulica) são simultâneas à alvenaria/estrutura
- Acabamentos sempre no final
- Lead time padrão: 7 dias para materiais comuns, 15-30 dias para materiais especiais (porcelanatos, esquadrias, vidros, marcenaria)
- Se houver valor no orçamento, use como referência para estimar custo dos materiais

Responda EXCLUSIVAMENTE com JSON válido usando tool calling.`;

    const userPrompt = `Projeto: ${projectName || "Obra"}
Data de início prevista: ${startDate || "A definir"}
Duração estimada: ${durationWeeks || "A calcular"} semanas

Itens do orçamento:
${budgetItems.map((item: any, i: number) => 
  `${i + 1}. ${item.description || item.name}${item.unit ? ` (${item.quantity || ''} ${item.unit})` : ''}${item.value ? ` - R$ ${item.value}` : ''}`
).join("\n")}

Gere o cronograma semanal otimizado e a lista de compras com prazos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_construction_plan",
              description: "Gera cronograma semanal e lista de compras para uma obra",
              parameters: {
                type: "object",
                properties: {
                  weeklySchedule: {
                    type: "array",
                    description: "Cronograma distribuído por semana",
                    items: {
                      type: "object",
                      properties: {
                        week: { type: "number", description: "Número da semana (1, 2, 3...)" },
                        phase: { type: "string", description: "Nome da fase (ex: Fundação, Alvenaria)" },
                        activities: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              description: { type: "string" },
                              estimatedDays: { type: "number", description: "Duração estimada em dias" },
                              dependencies: { type: "array", items: { type: "string" }, description: "Atividades que devem ser concluídas antes" },
                              notes: { type: "string", description: "Observações técnicas" },
                            },
                            required: ["description", "estimatedDays"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["week", "phase", "activities"],
                      additionalProperties: false,
                    },
                  },
                  purchaseList: {
                    type: "array",
                    description: "Lista de compras com prazos",
                    items: {
                      type: "object",
                      properties: {
                        item: { type: "string", description: "Nome do material" },
                        category: { type: "string", description: "Categoria (ex: Elétrica, Hidráulica, Acabamento)" },
                        quantity: { type: "string", description: "Quantidade estimada com unidade" },
                        estimatedCost: { type: "string", description: "Custo estimado em R$" },
                        leadTimeDays: { type: "number", description: "Prazo de entrega em dias" },
                        orderByWeek: { type: "number", description: "Semana em que deve ser pedido" },
                        neededByWeek: { type: "number", description: "Semana em que precisa estar disponível" },
                        priority: { type: "string", enum: ["alta", "media", "baixa"] },
                        notes: { type: "string" },
                      },
                      required: ["item", "category", "leadTimeDays", "orderByWeek", "neededByWeek", "priority"],
                      additionalProperties: false,
                    },
                  },
                  summary: {
                    type: "object",
                    properties: {
                      totalWeeks: { type: "number" },
                      totalActivities: { type: "number" },
                      totalPurchaseItems: { type: "number" },
                      criticalPath: { type: "array", items: { type: "string" }, description: "Atividades do caminho crítico" },
                      recommendations: { type: "array", items: { type: "string" }, description: "Recomendações gerais para o engenheiro" },
                    },
                    required: ["totalWeeks", "totalActivities", "totalPurchaseItems"],
                    additionalProperties: false,
                  },
                },
                required: ["weeklySchedule", "purchaseList", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_construction_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione fundos nas configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao gerar cronograma" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta da IA não contém dados estruturados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-schedule error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
