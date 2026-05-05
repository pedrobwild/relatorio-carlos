/* eslint-disable no-console */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const toolSchema = {
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
              week: { type: "number" },
              phase: { type: "string" },
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    estimatedDays: { type: "number" },
                    dependencies: { type: "array", items: { type: "string" } },
                    notes: { type: "string" },
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
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              category: { type: "string" },
              quantity: { type: "string" },
              estimatedCost: { type: "string" },
              leadTimeDays: { type: "number" },
              orderByWeek: { type: "number" },
              neededByWeek: { type: "number" },
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
            bufferWeeks: { type: "number" },
            totalActivities: { type: "number" },
            totalPurchaseItems: { type: "number" },
            criticalPath: { type: "array", items: { type: "string" } },
            budgetConcentration: { type: "string" },
            recommendations: { type: "array", items: { type: "string" } },
          },
          required: ["totalWeeks", "bufferWeeks", "totalActivities", "totalPurchaseItems"],
          additionalProperties: false,
        },
        budgetRiskAlerts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["concentracao_orcamentaria", "lead_time_critico", "sequenciamento", "semana_sobrecarregada", "item_sem_cronograma"] },
              severity: { type: "string", enum: ["alta", "media", "baixa"] },
              message: { type: "string" },
              affectedItems: { type: "array", items: { type: "string" } },
              recommendation: { type: "string" },
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
};

function buildUserPrompt(payload: any): string {
  const { budgetItems, budgetFileBase64: _budgetFileBase64, budgetFileName, projectName, startDate, endDate, durationWeeks } = payload;

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

  const hasBudgetItems = budgetItems && Array.isArray(budgetItems) && budgetItems.length > 0;
  let budgetSection = "";
  if (hasBudgetItems) {
    budgetSection = `Itens do orçamento:\n${budgetItems.map((item: any, i: number) =>
      `${i + 1}. ${item.description || item.name}${item.unit ? ` (${item.quantity || ''} ${item.unit})` : ''}${item.value ? ` - R$ ${item.value}` : ''}`
    ).join("\n")}`;
  } else {
    budgetSection = `O orçamento foi enviado como PDF em anexo (${budgetFileName || 'orcamento.pdf'}). Analise o conteúdo completo do PDF para extrair todos os itens, quantidades e valores. Liste cada item encontrado antes de gerar o cronograma.`;
  }

  return `Projeto: ${projectName || "Obra"}\n${durationContext}\n\n${budgetSection}\n\nGere o cronograma semanal otimizado e a lista de compras com prazos.`;
}

async function processScheduleJob(jobId: string, payload: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    await supabaseAdmin.from("schedule_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", jobId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const userPrompt = buildUserPrompt(payload);
    const hasPdfFile = payload.budgetFileBase64 && typeof payload.budgetFileBase64 === "string";

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (hasPdfFile) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${payload.budgetFileBase64}` } },
          { type: "text", text: userPrompt },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "generate_construction_plan" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      const errorMsg = response.status === 429
        ? "Limite de requisições atingido. Tente novamente em alguns minutos."
        : response.status === 402
        ? "Créditos insuficientes."
        : `Erro do gateway IA (${response.status})`;
      throw new Error(errorMsg);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Resposta da IA não contém dados estruturados");
    }

    const plan = JSON.parse(toolCall.function.arguments);

    await supabaseAdmin
      .from("schedule_jobs")
      .update({ status: "completed", result: plan, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    console.log(`Job ${jobId} completed successfully`);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
    console.error(`Job ${jobId} failed:`, errorMessage);
    await supabaseAdmin
      .from("schedule_jobs")
      .update({ status: "failed", error_message: errorMessage, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { projectId } = payload;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasBudgetItems = payload.budgetItems && Array.isArray(payload.budgetItems) && payload.budgetItems.length > 0;
    const hasPdfFile = payload.budgetFileBase64 && typeof payload.budgetFileBase64 === "string";

    if (!hasBudgetItems && !hasPdfFile) {
      return new Response(JSON.stringify({ error: "budgetItems ou budgetFileBase64 é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create job record
    const { data: job, error: insertError } = await supabaseAdmin
      .from("schedule_jobs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: "pending",
        input_payload: { projectName: payload.projectName, startDate: payload.startDate, endDate: payload.endDate, durationWeeks: payload.durationWeeks, hasPdf: hasPdfFile, itemCount: hasBudgetItems ? payload.budgetItems.length : 0 },
      })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("Failed to create job:", insertError);
      return new Response(JSON.stringify({ error: "Falha ao criar job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in background using EdgeRuntime.waitUntil
    // @ts-expect-error EdgeRuntime is a Supabase Edge Functions global not in TS types
    EdgeRuntime.waitUntil(processScheduleJob(job.id, payload));

    return new Response(JSON.stringify({ jobId: job.id, status: "pending" }), {
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
