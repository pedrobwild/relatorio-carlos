import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { user, supabaseAdmin } = await authenticateRequest(req);

    // Verify admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "manager"])
      .limit(1)
      .single();

    if (!roleData) {
      return jsonResponse({ error: "Acesso restrito a administradores" }, 403);
    }

    const { query, searchFocus } = await req.json();

    if (!query) {
      return jsonResponse({ error: "Campo 'query' é obrigatório" }, 400);
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return jsonResponse({ error: "PERPLEXITY_API_KEY não configurada. Conecte o Perplexity nas configurações." }, 500);
    }

    const systemPrompt = `Você é um consultor especialista em software de gestão de obras e reformas residenciais.
Quando o usuário perguntar sobre funcionalidades, features ou referências de mercado, você deve:

1. Pesquisar softwares reais do mercado (ex: Construct, Sienge, Prevision, Obra Prima, Procore, Buildertrend, CoConstruct, Monday.com para construção)
2. Descrever as funcionalidades encontradas com detalhes práticos
3. Sugerir como implementar no contexto de um portal web moderno (React + Supabase)
4. Priorizar por impacto no cliente final (proprietário acompanhando reforma)
5. Incluir screenshots ou URLs de referência quando disponíveis

Formate a resposta em Markdown com headers, listas e destaques.
Responda sempre em Português brasileiro.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        search_domain_filter: searchFocus === "international"
          ? ["procore.com", "buildertrend.com", "coconstruct.com", "monday.com", "g2.com"]
          : searchFocus === "national"
          ? ["sienge.com.br", "prevision.com.br", "obraprimaapp.com.br", "construct.com.br"]
          : undefined,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return jsonResponse({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }, 429);
      }
      if (status === 402) {
        return jsonResponse({ error: "Créditos Perplexity insuficientes." }, 402);
      }
      const errorText = await response.text();
      console.error("Perplexity API error:", status, errorText);
      return jsonResponse({ error: "Erro no serviço Perplexity" }, 500);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    return jsonResponse({ success: true, content, citations });
  } catch (err) {
    console.error("perplexity-research error:", err);
    const status = (err as any)?.status || 500;
    const message = (err as any)?.message || "Erro interno";
    return jsonResponse({ error: message }, status);
  }
});
