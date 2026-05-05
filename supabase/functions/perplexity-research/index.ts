import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  hashQuery,
  lookupCache,
  storeCache,
} from "../_shared/externalCache.ts";
import {
  EXTERNAL_SOURCES,
  findExternalSource,
} from "../assistant-chat/_lib/externalSources.ts";

const LEGACY_SYSTEM_PROMPT =
  `Você é um consultor especialista em software de gestão de obras e reformas residenciais.
Quando o usuário perguntar sobre funcionalidades, features ou referências de mercado, você deve:

1. Pesquisar softwares reais do mercado (ex: Construct, Sienge, Prevision, Obra Prima, Procore, Buildertrend, CoConstruct, Monday.com para construção)
2. Descrever as funcionalidades encontradas com detalhes práticos
3. Sugerir como implementar no contexto de um portal web moderno (React + Supabase)
4. Priorizar por impacto no cliente final (proprietário acompanhando reforma)
5. Incluir screenshots ou URLs de referência quando disponíveis

Formate a resposta em Markdown com headers, listas e destaques.
Responda sempre em Português brasileiro.`;

const V4_SYSTEM_PROMPT =
  `Você está pesquisando dado de mercado para o Assistente BWild.
Responda em Português brasileiro, com fatos verificáveis e URL específica para cada afirmação numérica.

Regras:
- Sempre cite a fonte primária (gov.br, BCB, Sinduscon, .org.br oficial). Evite blogs e fóruns.
- Quando der número, traga ele LITERAL como aparece na fonte e a data da publicação.
- Se a pesquisa não encontrar dado claro, responda "não foi possível confirmar" — NÃO invente.
- Não use conhecimento de treinamento para preencher buracos.`;

interface PerplexityResponse {
  content: string;
  citations: string[];
  raw?: unknown;
}

async function callPerplexity(opts: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  domainFilter?: string[];
}): Promise<PerplexityResponse> {
  const body: Record<string, unknown> = {
    model: "sonar-pro",
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
  };
  if (opts.domainFilter && opts.domainFilter.length > 0) {
    body.search_domain_filter = opts.domainFilter;
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      throw { status: 429, message: "Limite de requisições excedido. Tente novamente em alguns minutos." };
    }
    if (status === 402) {
      throw { status: 402, message: "Créditos Perplexity insuficientes." };
    }
    const errorText = await response.text();
    console.error("Perplexity API error:", status, errorText);
    throw { status: 500, message: "Erro no serviço Perplexity" };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const citations: string[] = data.citations || [];
  return { content, citations, raw: data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { user, supabaseAdmin } = await authenticateRequest(req);

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return jsonResponse(
        { error: "PERPLEXITY_API_KEY não configurada. Conecte o Perplexity nas configurações." },
        500,
      );
    }

    const body = await req.json();
    const query = (body?.query ?? "").toString().trim();
    if (!query) {
      return jsonResponse({ error: "Campo 'query' é obrigatório" }, 400);
    }

    // ---------- v4 mode: source_id presente → web_research do assistente ----------
    if (body?.source_id) {
      const source = findExternalSource(String(body.source_id));
      if (!source) {
        return jsonResponse(
          { error: `source_id desconhecido. Use um de: ${EXTERNAL_SOURCES.map((s) => s.id).join(", ")}` },
          400,
        );
      }
      if (source.kind !== "web_search") {
        return jsonResponse(
          {
            error:
              `source ${source.id} é ${source.kind}; use fetch_market_data em vez de web_research`,
          },
          400,
        );
      }

      const cacheParams = { query };
      const queryHash = await hashQuery(source.id, cacheParams);
      const hit = await lookupCache<PerplexityResponse>(source.id, queryHash);
      if (hit.hit && hit.value) {
        return jsonResponse({
          success: true,
          source_id: source.id,
          cached: true,
          fetched_at: hit.fetched_at,
          content: hit.value.content,
          citations: hit.value.citations,
        });
      }

      const result = await callPerplexity({
        apiKey: PERPLEXITY_API_KEY,
        systemPrompt: V4_SYSTEM_PROMPT,
        userPrompt: query,
        domainFilter: source.perplexity_focus,
      });

      await storeCache({
        sourceId: source.id,
        queryHash,
        queryRaw: cacheParams,
        result: { content: result.content, citations: result.citations },
        ttlHours: source.cache_ttl_hours,
        // Perplexity sonar-pro ~= 1¢ por chamada (estimativa grossa)
        costCents: 1,
      });

      // Telemetria opcional (não bloqueia resposta).
      try {
        await supabaseAdmin.from("assistant_logs").insert({
          user_id: user.id,
          question: `[external:${source.id}] ${query.slice(0, 240)}`,
          domain: "external",
          status: "success",
          model: "perplexity-sonar-pro",
          external_calls_count: 1,
          external_cache_hits: 0,
          external_cost_cents: 1,
          external_sources_used: [source.id],
        });
      } catch (_) { /* swallow — telemetria não crítica */ }

      return jsonResponse({
        success: true,
        source_id: source.id,
        cached: false,
        content: result.content,
        citations: result.citations,
      });
    }

    // ---------- legacy mode: AdminResearch (mantém comportamento atual) ----------
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

    const searchFocus = body?.searchFocus;
    const domainFilter = searchFocus === "international"
      ? ["procore.com", "buildertrend.com", "coconstruct.com", "monday.com", "g2.com"]
      : searchFocus === "national"
      ? ["sienge.com.br", "prevision.com.br", "obraprimaapp.com.br", "construct.com.br"]
      : undefined;

    const result = await callPerplexity({
      apiKey: PERPLEXITY_API_KEY,
      systemPrompt: LEGACY_SYSTEM_PROMPT,
      userPrompt: query,
      domainFilter,
    });

    return jsonResponse({
      success: true,
      content: result.content,
      citations: result.citations,
    });
  } catch (err) {
    console.error("perplexity-research error:", err);
    const status = (err as { status?: number })?.status || 500;
    const message = (err as { message?: string })?.message || "Erro interno";
    return jsonResponse({ error: message }, status);
  }
});
