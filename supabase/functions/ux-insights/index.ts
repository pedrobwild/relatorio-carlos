import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const SYSTEM_PROMPT = `Você é um especialista sênior em UX/UI para portais de gestão de obras e reformas residenciais. 
Seu público-alvo são CLIENTES (proprietários de imóveis acompanhando a reforma) e EQUIPE INTERNA (engenheiros, gestores).

Ao receber o contexto de uma funcionalidade ou área do sistema, gere sugestões ACIONÁVEIS e ESPECÍFICAS organizadas em 3 categorias:

## 1. 🏗️ Hierarquia & Navegação Estrutural
- Como organizar a informação para reduzir carga cognitiva
- Priorização visual de elementos críticos (prazos, pendências, alertas)
- Fluxos de navegação que minimizam cliques desnecessários
- Agrupamento lógico de funcionalidades operacionais
- Breadcrumbs, tabs, sub-navegação — quando usar cada padrão

## 2. ✍️ Copywriting & Microcopy
- Textos de botões, labels, placeholders que comunicam claramente a ação
- Mensagens de estado vazio (empty states) que orientam o próximo passo
- Notificações e alertas com tom adequado (urgência vs informativo)
- Tooltips e textos de ajuda contextuais
- Linguagem inclusiva e acessível para clientes não-técnicos

## 3. 🎯 Melhorias Gerais de UX
- Padrões de interação mobile-first (touch targets, gestos, bottom sheets)
- Feedback visual para ações (loading states, confirmações, transições)
- Redução de fricção em fluxos críticos (aprovações, assinaturas, pagamentos)
- Acessibilidade (contraste, tamanhos de fonte, navegação por teclado)
- Progressive disclosure — revelar complexidade gradualmente

Para cada sugestão, forneça:
- **Problema atual** (o que pode estar causando confusão ou atrito)
- **Solução proposta** (ação concreta e específica)
- **Impacto esperado** (benefício mensurável ou qualitativo)
- **Prioridade**: 🔴 Alta | 🟡 Média | 🟢 Baixa

Responda sempre em Português brasileiro. Seja direto e prático — nada genérico.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { user, supabaseAdmin } = await authenticateRequest(req);

    // Verify user is admin/staff
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "manager", "engineer"])
      .limit(1)
      .single();

    if (!roleData) {
      return jsonResponse({ error: "Acesso restrito a administradores" }, 403);
    }

    const { area, context } = await req.json();

    if (!area) {
      return jsonResponse({ error: "Campo 'area' é obrigatório" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    const userPrompt = `Analise a seguinte área/funcionalidade do portal de gestão de obras e gere sugestões de melhoria de UX:

**Área:** ${area}

${context ? `**Contexto adicional:** ${context}` : ""}

Gere entre 5 e 10 sugestões organizadas nas 3 categorias. Foque em melhorias que tenham impacto real na experiência do cliente e da equipe.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse(
          { error: "Limite de requisições excedido. Tente novamente em alguns minutos." },
          429
        );
      }
      if (response.status === 402) {
        return jsonResponse(
          { error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." },
          402
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return jsonResponse({ error: "Erro no serviço de IA" }, 500);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("ux-insights error:", err);
    const status = (err as any)?.status || 500;
    const message = (err as any)?.message || "Erro interno";
    return jsonResponse({ error: message }, status);
  }
});
