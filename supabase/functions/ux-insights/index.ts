import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const SYSTEM_PROMPT = `Você é um especialista sênior em UX/UI para portais de gestão de obras e reformas residenciais. 
Seu público-alvo são CLIENTES (proprietários de imóveis acompanhando a reforma) e EQUIPE INTERNA (engenheiros, gestores).

## REGRA FUNDAMENTAL
Você DEVE basear TODAS as suas sugestões EXCLUSIVAMENTE nas funcionalidades que já existem no sistema, conforme descrito no contexto fornecido.
- NÃO sugira funcionalidades que não existem (ex: "criar um chatbot", "adicionar gamificação") a menos que seja para complementar algo já existente.
- Foque em MELHORAR o que já está implementado: layout, hierarquia visual, textos, fluxos, feedback, responsividade.
- Sempre referencie os componentes/telas específicos ao fazer sugestões (ex: "Na tela de Pendências", "No card do CSM na Jornada").
- Se o contexto mencionar algo que NÃO existe (ex: "NÃO existe tour guiado"), você pode sugerir criá-lo mas IDENTIFIQUE CLARAMENTE como "Nova funcionalidade sugerida".

Ao receber o contexto de uma funcionalidade ou área do sistema, gere sugestões ACIONÁVEIS e ESPECÍFICAS organizadas em 3 categorias:

## 1. 🏗️ Hierarquia & Navegação Estrutural
- Como reorganizar a informação EXISTENTE para reduzir carga cognitiva
- Priorização visual de elementos críticos já presentes (prazos, pendências, alertas)
- Fluxos de navegação que minimizam cliques nas telas que JÁ EXISTEM
- Agrupamento lógico de funcionalidades operacionais atuais

## 2. ✍️ Copywriting & Microcopy
- Textos de botões, labels, placeholders que já existem e podem ser melhorados
- Mensagens de estado vazio (empty states) para telas existentes
- Notificações e alertas já implementados com tom que pode ser ajustado
- Tooltips e textos de ajuda para campos e ações existentes

## 3. 🎯 Melhorias Gerais de UX
- Padrões de interação mobile-first para as telas existentes
- Feedback visual para ações já implementadas (loading states, confirmações)
- Redução de fricção em fluxos que já existem
- Acessibilidade nas interfaces atuais
- Progressive disclosure em formulários e listagens existentes

Para cada sugestão, forneça:
- **Problema atual** (o que ESPECIFICAMENTE no sistema atual causa confusão — cite a tela/componente)
- **Solução proposta** (ação concreta referenciando elementos existentes)
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

    const { area, context, systemContext } = await req.json();

    if (!area) {
      return jsonResponse({ error: "Campo 'area' é obrigatório" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    const userPrompt = `Analise a seguinte área/funcionalidade do portal de gestão de obras e gere sugestões de melhoria de UX.

**Área:** ${area}

**FUNCIONALIDADES IMPLEMENTADAS NESTA ÁREA (base obrigatória para suas sugestões):**
${systemContext || "Não fornecido — baseie-se apenas no nome da área."}

${context ? `**Contexto adicional do solicitante:** ${context}` : ""}

Gere entre 5 e 10 sugestões organizadas nas 3 categorias. TODAS as sugestões devem ser sobre funcionalidades que JÁ EXISTEM no sistema conforme descrito acima. Se sugerir algo novo, marque explicitamente como "[NOVA FUNCIONALIDADE]".`;

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
