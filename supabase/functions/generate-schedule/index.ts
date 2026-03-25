import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { budgetItems, budgetFileBase64, budgetFileName, projectName, startDate, endDate, durationWeeks } = await req.json();

    const hasBudgetItems = budgetItems && Array.isArray(budgetItems) && budgetItems.length > 0;
    const hasPdfFile = budgetFileBase64 && typeof budgetFileBase64 === 'string';

    if (!hasBudgetItems && !hasPdfFile) {
      return new Response(JSON.stringify({ error: "budgetItems ou budgetFileBase64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um engenheiro civil especialista em planejamento de obras residenciais e comerciais no Brasil, treinado com as melhores práticas da Bwild Reformas.

## REGRAS DE SEQUENCIAMENTO TÉCNICO

Regra de ouro: "De cima para baixo, do bruto para o fino."

### Sequência obrigatória para reformas:
1. Mobilização + Alinhamentos + Proteção
2. Demolições + Elétrica + Hidráulica (instalações simultâneas à alvenaria/estrutura)
3. Impermeabilização + Contrapiso + Infraestrutura Ar Condicionado
4. Revestimentos (backsplash) + Medições (Box, Marmoraria)
5. Regularização e Nivelamento de Piso + Medição Marcenaria (ANTECIPAR — não deixar para depois)
6. Emasseamento + Massa Corrida + Lixa
7. Pintura (1a demão paredes/teto) — SEMPRE antes do piso. A 2a demão fica para DEPOIS da marcenaria (etapa 13).
8. Instalação Piso Vinílico + Proteção
9. Instalação Box + Bancadas + Acabamentos Elétricos
10. Luminárias + Metais + Aquecedor + Ar Condicionado
11. Entrega e Início Montagem Marcenaria
12. Finalização Marcenaria + Rodapé (rodapé SEMPRE após marcenaria)
13. Pintura 2a demão + Retoque Pintura + Montagem Móveis + Eletros + Limpeza Grossa
14. Limpeza Fina + Vistoria + Conferência + Fotos/Vídeos
15. BUFFER para imprevistos (15-16 em obras de 16 semanas)

### Regras críticas:
- NUNCA colocar pintura DEPOIS do piso — pintura respinga e suja
- Rodapé SEMPRE após marcenaria — os móveis definem onde o rodapé é interrompido
- NUNCA concentrar mais de 5-6 atividades em uma única semana (irrealista para equipe padrão)
- NUNCA deixar semanas ociosas — redistribuir atividades ou antecipar medições
- Todo item do orçamento DEVE ter correspondência no cronograma

## REGRAS DE LEAD TIME E COMPRAS

- Materiais comuns (tintas, argamassa, tubos): 3-7 dias
- Box de vidro: 15-20 dias após medição
- Marmoraria (bancadas, soleiras): 10-15 dias após medição
- Marcenaria/móveis planejados: 30-45 dias de produção — medição deve ser antecipada (semana 5-6, não semana 8+)
- **REGRA CRÍTICA DE BANCADA DE GRANITO/MÁRMORE + MARCENARIA**: Se o orçamento contiver bancada de granito, mármore ou pedra natural, a MEDIÇÃO DA MARCENARIA só pode ocorrer APÓS a instalação da bancada. Isso porque a marcenaria precisa se ajustar às dimensões reais da bancada instalada. Sequência obrigatória: Medição Marmoraria → Fabricação Bancada → Instalação Bancada → Medição Marcenaria → Fabricação Marcenaria → Montagem Marcenaria.
- Eletrodomésticos: 7-15 dias — coordenar com instalação elétrica
- Ar condicionado: 7-15 dias — coordenar compra com infraestrutura
- Porcelanatos/revestimentos especiais: 15-30 dias
- Esquadrias/vidros: 20-30 dias

### Concentração de risco orçamentário:
- Identificar itens que juntos representam >40% do orçamento (geralmente marcenaria + eletros)
- Estes itens devem ter marcos de compra explícitos, datas de entrega e alertas de antecipação

## REGRA DE BUFFER

Adicionar 20% de margem ao cronograma. Para 80 dias úteis (16 semanas), planejar conclusão real na semana 13-14, deixando semanas 15-16 como buffer.

## DEPENDÊNCIAS

Cada atividade deve indicar suas dependências. Exemplos:
- "Instalação Piso Vinílico" depende de "Regularização do Piso" + "Pintura 2a demão"
- "Marcenaria Montagem" depende de "Piso Vinílico instalado" + "Pintura finalizada"
- "Rodapé" depende de "Marcenaria finalizada"

## OUTPUT

Analise os itens de orçamento fornecidos e gere:
1. **Cronograma Semanal**: Distribua na melhor ordem técnica, respeitando TODAS as regras acima
2. **Lista de Compras**: Para cada material, calcule quando pedir baseado no lead time real
3. **Alertas**: Identifique riscos de concentração orçamentária e sequenciamento

Responda EXCLUSIVAMENTE com JSON válido usando tool calling.`;

    // Build duration context
    let durationContext = "";
    if (startDate && endDate) {
      durationContext = `Data de início: ${startDate}\nData de término: ${endDate}\nIMPORTANTE: O cronograma DEVE ser distribuído dentro deste intervalo de datas. Calcule o número de semanas disponíveis e distribua todas as atividades proporcionalmente, respeitando a sequência técnica obrigatória. Considere apenas dias úteis (segunda a sexta), excluindo feriados nacionais brasileiros e feriados municipais de São Paulo (25/Jan, 9/Jul, 20/Nov).`;
    } else if (startDate && durationWeeks) {
      durationContext = `Data de início: ${startDate}\nDuração estimada: ${durationWeeks} semanas`;
    } else if (startDate) {
      durationContext = `Data de início: ${startDate}\nDuração: A calcular com base nos itens do orçamento`;
    } else {
      durationContext = `Data de início: A definir\nDuração: A calcular com base nos itens do orçamento`;
    }

    let budgetSection = "";
    if (hasBudgetItems) {
      budgetSection = `Itens do orçamento:\n${budgetItems.map((item: any, i: number) => 
        `${i + 1}. ${item.description || item.name}${item.unit ? ` (${item.quantity || ''} ${item.unit})` : ''}${item.value ? ` - R$ ${item.value}` : ''}`
      ).join("\n")}`;
    } else {
      budgetSection = `O orçamento foi enviado como PDF em anexo (${budgetFileName || 'orcamento.pdf'}). Analise o conteúdo completo do PDF para extrair todos os itens, quantidades e valores. Liste cada item encontrado antes de gerar o cronograma.`;
    }

    const userPrompt = `Projeto: ${projectName || "Obra"}
${durationContext}

${budgetSection}

Gere o cronograma semanal otimizado e a lista de compras com prazos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    // Build messages - include PDF as multimodal content if provided
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (hasPdfFile) {
      messages.push({
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: budgetFileName || "orcamento.pdf",
              file_data: `data:application/pdf;base64,${budgetFileBase64}`,
            },
          },
          { type: "text", text: userPrompt },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
                      bufferWeeks: { type: "number", description: "Semanas reservadas como buffer (20% do total)" },
                      totalActivities: { type: "number" },
                      totalPurchaseItems: { type: "number" },
                      criticalPath: { type: "array", items: { type: "string" }, description: "Atividades do caminho crítico" },
                      budgetConcentration: { type: "string", description: "Ex: Marcenaria + Eletros = 52% do orçamento" },
                      recommendations: { type: "array", items: { type: "string" }, description: "Recomendações baseadas nas regras Bwild" },
                    },
                    required: ["totalWeeks", "bufferWeeks", "totalActivities", "totalPurchaseItems"],
                    additionalProperties: false,
                  },
                  budgetRiskAlerts: {
                    type: "array",
                    description: "Alertas de risco orçamentário e sequenciamento",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["concentracao_orcamentaria", "lead_time_critico", "sequenciamento", "semana_sobrecarregada", "item_sem_cronograma"] },
                        severity: { type: "string", enum: ["alta", "media", "baixa"] },
                        message: { type: "string", description: "Descrição do alerta" },
                        affectedItems: { type: "array", items: { type: "string" }, description: "Itens afetados" },
                        recommendation: { type: "string", description: "Recomendação para mitigar o risco" },
                      },
                      required: ["type", "severity", "message", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["weeklySchedule", "purchaseList", "summary", "budgetRiskAlerts"],
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
