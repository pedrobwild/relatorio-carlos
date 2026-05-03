// Dispatcher para steps externos (v4).
//
// Decide entre:
//   - fetchMarketData (api_official | api_aggregator) → BCB SGS, Receita Federal
//   - perplexity (web_search)                        → CUB, regulação, fornecedores
//
// Lê do cache antes de chamar; grava após chamar; converte tudo numa
// `ExternalEvidence` validada.

import { findExternalSource } from "./externalSources.ts";
import { fetchMarketData, MarketDataResult } from "./marketData.ts";
import {
  evidenceFromMarketData,
  ExternalEvidence,
  validateExternalEvidence,
} from "./researcher.ts";
import {
  hashQuery,
  lookupCache,
  storeCache,
} from "../../_shared/externalCache.ts";

export interface DispatchResult {
  evidence: ExternalEvidence | null;
  cached: boolean;
  error?: string;
  /** quanto custou a chamada (¢) — 0 quando hit no cache */
  cost_cents: number;
}

export interface DispatchInput {
  source_id: string;
  /** params para fetch_market_data (BCB n=, CNPJ cnpj=) */
  params?: Record<string, unknown>;
  /** query natural para web_research */
  query?: string;
}

/**
 * Roda um step externo: cache → fetch → evidência validada.
 * Erros não lançam — devolvem evidence: null + error string para o orquestrador
 * degradar a resposta sem derrubar a sessão.
 */
export async function dispatchExternalStep(
  input: DispatchInput,
  opts: { perplexityFnUrl?: string; authHeader?: string } = {},
): Promise<DispatchResult> {
  const source = findExternalSource(input.source_id);
  if (!source) {
    return {
      evidence: null,
      cached: false,
      cost_cents: 0,
      error: `source desconhecida: ${input.source_id}`,
    };
  }

  const cacheParams: Record<string, unknown> = source.kind === "web_search"
    ? { query: input.query ?? "" }
    : { ...(input.params ?? {}) };

  let queryHash: string;
  try {
    queryHash = await hashQuery(source.id, cacheParams);
  } catch (e) {
    return {
      evidence: null,
      cached: false,
      cost_cents: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 1. Cache lookup.
  try {
    const hit = await lookupCache(source.id, queryHash);
    if (hit.hit && hit.value) {
      const evidence = adaptCachedToEvidence(source.id, hit.value, hit.fetched_at);
      const v = validateExternalEvidence(evidence);
      if (!v.valid) evidence.warnings.push(...v.issues);
      return { evidence, cached: true, cost_cents: 0 };
    }
  } catch (e) {
    // Cache lookup miss não é fatal — segue pra fetch.
    console.warn("[dispatcher] cache lookup falhou:", e);
  }

  // 2. Fetch fresco.
  try {
    if (source.kind === "api_official" || source.kind === "api_aggregator") {
      const data = await fetchMarketData(source.id, input.params ?? {});
      await storeCache({
        sourceId: source.id,
        queryHash,
        queryRaw: cacheParams,
        result: data,
        ttlHours: source.cache_ttl_hours,
      });
      const evidence = evidenceFromMarketData(data);
      const v = validateExternalEvidence(evidence);
      if (!v.valid) evidence.warnings.push(...v.issues);
      return { evidence, cached: false, cost_cents: 0 };
    }

    if (source.kind === "web_search") {
      if (!opts.perplexityFnUrl || !opts.authHeader) {
        return {
          evidence: null,
          cached: false,
          cost_cents: 0,
          error:
            "perplexityFnUrl/authHeader ausentes — web_research não disponível",
        };
      }
      if (!input.query) {
        return {
          evidence: null,
          cached: false,
          cost_cents: 0,
          error: "web_research exige `query`",
        };
      }
      // perplexity-research já cuida do cache internamente quando recebe source_id.
      const r = await fetch(opts.perplexityFnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: opts.authHeader,
        },
        body: JSON.stringify({
          source_id: source.id,
          query: input.query,
        }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return {
          evidence: null,
          cached: false,
          cost_cents: 0,
          error: `perplexity ${r.status}: ${t.slice(0, 160)}`,
        };
      }
      const data = await r.json() as {
        content?: string;
        citations?: string[];
        cached?: boolean;
      };
      const evidence = adaptPerplexityToEvidence(source.id, data);
      const v = validateExternalEvidence(evidence);
      if (!v.valid) evidence.warnings.push(...v.issues);
      return {
        evidence,
        cached: Boolean(data.cached),
        cost_cents: data.cached ? 0 : 1,
      };
    }

    return {
      evidence: null,
      cached: false,
      cost_cents: 0,
      error: `kind ${source.kind} não suportado pelo dispatcher`,
    };
  } catch (e) {
    return {
      evidence: null,
      cached: false,
      cost_cents: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function adaptCachedToEvidence(
  sourceId: string,
  cached: unknown,
  fetchedAt?: string,
): ExternalEvidence {
  // Cache de fetch_market_data → MarketDataResult inteiro.
  const m = cached as Partial<MarketDataResult>;
  if (m && typeof m === "object" && "summary" in m && "url" in m) {
    const evidence = evidenceFromMarketData(m as MarketDataResult);
    if (fetchedAt) evidence.access_date = fetchedAt.slice(0, 10);
    return evidence;
  }
  // Cache de web_research → { content, citations }.
  return adaptPerplexityToEvidence(
    sourceId,
    cached as { content?: string; citations?: string[] },
    fetchedAt,
  );
}

function adaptPerplexityToEvidence(
  sourceId: string,
  data: { content?: string; citations?: string[] },
  fetchedAt?: string,
): ExternalEvidence {
  const source = findExternalSource(sourceId);
  const url = data.citations?.[0] ?? "";
  const content = (data.content ?? "").trim();
  const claim = content.length > 240 ? content.slice(0, 240) + "…" : content;
  const verbatim = content.length > 200 ? content.slice(0, 200) + "…" : content;
  const accessDate = (fetchedAt ?? new Date().toISOString()).slice(0, 10);

  // Tier deduzido pelo source; Researcher refinaria com LLM, mas o caminho
  // determinístico já protege contra alucinação grosseira.
  const tier = source?.confidence === "high"
    ? 1
    : source?.confidence === "medium"
    ? 2
    : 3;
  const warnings: string[] = [];
  if (!url) warnings.push("sem_url_canonica");
  if (!claim) warnings.push("conteudo_vazio");

  return {
    source_id: sourceId,
    claim: claim || "[sem dados]",
    numeric_value: null,
    numeric_unit: null,
    url: url || `[no-url:${sourceId}]`,
    publisher: source?.name ?? sourceId,
    access_date: accessDate,
    published_at: null,
    tier: tier as 1 | 2 | 3,
    confidence: source?.confidence ?? "low",
    verbatim_quote: verbatim || "[sem trecho]",
    warnings,
  };
}
